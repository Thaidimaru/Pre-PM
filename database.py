"""
NBTC Microwave — Survey Control Room (Pre-PM)
Modular Standalone Backend Server (Python 3 + SQLite)
"""

import base64
import datetime as dt
import json
import mimetypes
import os
from pathlib import Path
import secrets
import sqlite3
import threading
from urllib.parse import unquote
import xml.etree.ElementTree as ET
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


# ==============================================================================
# 1. Configuration & Paths
# ==============================================================================

class AppConfig:
    ROOT = Path(__file__).resolve().parent
    DB_PATH = ROOT / "survey.db"
    HTML_PATH = ROOT / "index.html"
    PASSWORD_PATH = ROOT / "access-password.txt"
    DATABASE_XLSX = ROOT / "DATABASE.xlsx"
    PHOTOS_DIR = ROOT / "photos"
    ASSETS_DIR = ROOT / "assets"
    
    HOST = "0.0.0.0"
    PORT = int(os.environ.get("PORT", 8765))
    TOKEN_LIFETIME_HOURS = 8
    XML_NAMESPACES = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


# ==============================================================================
# 2. Authentication Service
# ==============================================================================

class AuthService:
    def __init__(self):
        self._tokens = {}
        self._lock = threading.Lock()

    def get_configured_password(self) -> str:
        """Get password from environment variable or access-password.txt."""
        env_pass = os.environ.get("FORM_PASSWORD")
        if env_pass:
            return env_pass.strip()
        if AppConfig.PASSWORD_PATH.exists():
            return AppConfig.PASSWORD_PATH.read_text(encoding="utf-8-sig").strip()
        return "admin"

    def verify_password(self, attempt: str) -> bool:
        """Verify the user-provided password."""
        return bool(attempt and secrets.compare_digest(attempt.strip(), self.get_configured_password()))

    def create_token(self) -> str:
        """Generate a new secure authentication token."""
        token = secrets.token_urlsafe(32)
        expiry = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=AppConfig.TOKEN_LIFETIME_HOURS)
        with self._lock:
            self._tokens[token] = expiry
        return token

    def is_authorized(self, auth_header: str) -> bool:
        """Validate bearer token and clean up expired tokens."""
        if not auth_header:
            return False
        token = auth_header.removeprefix("Bearer ").strip()
        now = dt.datetime.now(dt.timezone.utc)
        with self._lock:
            expiry = self._tokens.get(token)
            if expiry and expiry > now:
                return True
            self._tokens.pop(token, None)
        return False


# ==============================================================================
# 3. Database & Storage Service
# ==============================================================================

class DatabaseService:
    @staticmethod
    def connect() -> sqlite3.Connection:
        """Create a connection with sqlite3.Row factory."""
        conn = sqlite3.connect(AppConfig.DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    @classmethod
    def initialize(cls):
        """Create tables and seed station / legacy survey data if missing."""
        AppConfig.PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

        with cls.connect() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS stations (
                    id INTEGER PRIMARY KEY,
                    village TEXT NOT NULL,
                    subdistrict TEXT,
                    district TEXT,
                    province TEXT,
                    installation_place TEXT,
                    equipment_place TEXT,
                    contact_name TEXT,
                    contact_position TEXT
                );

                CREATE TABLE IF NOT EXISTS surveys (
                    id INTEGER PRIMARY KEY,
                    record_id TEXT NOT NULL UNIQUE,
                    saved_at TEXT NOT NULL,
                    fields_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS survey_photos (
                    id INTEGER PRIMARY KEY,
                    survey_id INTEGER NOT NULL REFERENCES surveys(id),
                    name TEXT NOT NULL,
                    content_type TEXT NOT NULL,
                    data BLOB NOT NULL
                );
            """)

            # Seed stations from DATABASE.xlsx if empty
            if conn.execute("SELECT COUNT(*) FROM stations").fetchone()[0] == 0:
                cls._seed_stations_from_xlsx(conn)

            # Seed legacy survey JSON files if empty
            if conn.execute("SELECT COUNT(*) FROM surveys").fetchone()[0] == 0:
                cls._seed_surveys_from_json(conn)

    @classmethod
    def _seed_stations_from_xlsx(cls, conn: sqlite3.Connection):
        """Parse master station records from DATABASE.xlsx."""
        if not AppConfig.DATABASE_XLSX.exists():
            return
        rows = cls._read_xlsx_rows(AppConfig.DATABASE_XLSX)
        for row in rows[2:]:
            if len(row) > 2 and row[2]:
                values = (
                    str(row[2]).strip(),
                    str(row[3]).strip() if len(row) > 3 else "",
                    str(row[4]).strip() if len(row) > 4 else "",
                    str(row[5]).strip() if len(row) > 5 else "",
                    str(row[9]).strip() if len(row) > 9 else "",
                    str(row[10]).strip() if len(row) > 10 else "",
                    str(row[11]).strip() if len(row) > 11 else "",
                    str(row[12]).strip() if len(row) > 12 else ""
                )
                conn.execute("""
                    INSERT INTO stations
                    (village, subdistrict, district, province, installation_place,
                     equipment_place, contact_name, contact_position)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, values)

    @classmethod
    def _seed_surveys_from_json(cls, conn: sqlite3.Connection):
        """Import pre-existing survey-*.json files into SQLite."""
        for path in sorted(AppConfig.ROOT.glob("survey-*.json")):
            try:
                record = json.loads(path.read_text(encoding="utf-8-sig"))
                record_id = record.get("recordId") or path.stem
                saved_at = record.get("savedAt") or dt.datetime.fromtimestamp(
                    path.stat().st_mtime, dt.timezone.utc
                ).isoformat()
                fields = record.get("fields", {})
                conn.execute(
                    "INSERT OR IGNORE INTO surveys(record_id, saved_at, fields_json) VALUES (?, ?, ?)",
                    (record_id, saved_at, json.dumps(fields, ensure_ascii=False))
                )
            except Exception as e:
                print(f"Warning: Failed to seed {path.name}: {e}")

    @staticmethod
    def _read_xlsx_rows(path: Path) -> list:
        """Fast OpenXML spreadsheet parser without third-party dependencies."""
        ns = AppConfig.XML_NAMESPACES
        with zipfile.ZipFile(path) as archive:
            shared_strings = []
            if "xl/sharedStrings.xml" in archive.namelist():
                shared = ET.fromstring(archive.read("xl/sharedStrings.xml"))
                shared_strings = ["".join(item.itertext()) for item in shared.findall("m:si", ns)]

            sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
            rows = []
            for row in sheet.findall(".//m:sheetData/m:row", ns):
                values = {}
                for cell in row.findall("m:c", ns):
                    ref = cell.get("r", "")
                    col_letters = "".join(char for char in ref if char.isalpha())
                    if col_letters:
                        col_idx = 0
                        for char in col_letters:
                            col_idx = col_idx * 26 + ord(char.upper()) - 64
                        
                        val_elem = cell.find("m:v", ns)
                        if val_elem is not None and val_elem.text:
                            text = val_elem.text
                            values[col_idx - 1] = shared_strings[int(text)] if cell.get("t") == "s" else text
                        else:
                            values[col_idx - 1] = ""
                
                max_col = max(values.keys(), default=-1)
                rows.append([values.get(i, "") for i in range(max_col + 1)])
            return rows

    @classmethod
    def get_stations(cls) -> list:
        """Return all station records."""
        with cls.connect() as conn:
            rows = conn.execute("SELECT * FROM stations ORDER BY id").fetchall()
            return [dict(row) for row in rows]

    @classmethod
    def get_dashboard_payload(cls) -> dict:
        """Compile live dashboard KPI statistics, province bars, and recent entries."""
        with cls.connect() as conn:
            stations = [dict(s) for s in conn.execute("SELECT * FROM stations").fetchall()]
            surveys = [dict(r) for r in conn.execute("SELECT record_id, saved_at, fields_json FROM surveys ORDER BY saved_at DESC").fetchall()]

        # Map stations by village name for accurate lookup
        station_map = {s["village"].strip(): s for s in stations if s.get("village")}

        allowed = 0
        denied = 0
        province_counts = {}
        recent = []

        for survey in surveys:
            try:
                fields = json.loads(survey["fields_json"])
            except Exception:
                fields = {}

            permit = fields.get("permit", "")
            if permit in ("อนุญาต", "on"):
                allowed += 1
            elif permit == "ไม่อนุญาต":
                denied += 1

            station_name = str(fields.get("station") or fields.get("stationSelect") or "").strip()
            station_info = station_map.get(station_name, {})
            province = station_info.get("province") or fields.get("province") or "ไม่ระบุจังหวัด"
            province_counts[province] = province_counts.get(province, 0) + 1

            if len(recent) < 10:
                permit_label = "อนุญาต" if permit in ("อนุญาต", "on") else (permit or "ยังไม่ระบุ")
                recent.append({
                    "recordId": survey["record_id"],
                    "savedAt": survey["saved_at"],
                    "station": station_name or "ไม่ระบุสถานี",
                    "province": province,
                    "permit": permit_label
                })

        top_provinces = sorted(
            [{"name": name, "count": count} for name, count in province_counts.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:8]

        return {
            "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "stats": {
                "surveys": len(surveys),
                "stations": len(stations),
                "allowed": allowed,
                "denied": denied
            },
            "provinces": top_provinces,
            "recent": recent
        }

    @classmethod
    def save_survey(cls, fields: dict, photos: list) -> str:
        """Save survey record to SQLite, store photos, and create backup JSON."""
        timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        record_id = f"PM-{timestamp}-{secrets.token_hex(2)}"
        saved_at = dt.datetime.now(dt.timezone.utc).isoformat()

        with cls.connect() as conn:
            cursor = conn.execute(
                "INSERT INTO surveys (record_id, saved_at, fields_json) VALUES (?, ?, ?)",
                (record_id, saved_at, json.dumps(fields, ensure_ascii=False))
            )
            survey_id = cursor.lastrowid

            for photo in photos:
                raw_b64 = photo.get("data", "")
                if raw_b64:
                    photo_bytes = base64.b64decode(raw_b64)
                    conn.execute(
                        "INSERT INTO survey_photos (survey_id, name, content_type, data) VALUES (?, ?, ?, ?)",
                        (survey_id, photo.get("name", "photo"), photo.get("type", "image/jpeg"), photo_bytes)
                    )

        # Write local backup JSON for compatibility with export scripts
        backup_file = AppConfig.ROOT / f"survey-{timestamp}.json"
        try:
            backup_data = {
                "recordId": record_id,
                "savedAt": saved_at,
                "fields": fields
            }
            backup_file.write_text(json.dumps(backup_data, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"Warning: Failed to write backup {backup_file.name}: {e}")

        return record_id


# Initialize Singletons
auth_service = AuthService()


# ==============================================================================
# 4. HTTP Request Handler & Static Router
# ==============================================================================

class SurveyRequestHandler(BaseHTTPRequestHandler):
    def send_json_response(self, status_code: int, payload: dict):
        """Send JSON response with UTF-8 encoding."""
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def serve_file(self, file_path: Path, content_type: str = None):
        """Send static file with correct content type and caching."""
        if not file_path.is_file():
            self.send_json_response(404, {"error": "File not found"})
            return

        if not content_type:
            content_type, _ = mimetypes.guess_type(str(file_path))
            content_type = content_type or "application/octet-stream"

        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        """Handle GET requests for static assets, pages, and API endpoints."""
        parsed_path = unquote(self.path).split("?", 1)[0].rstrip("/")
        if parsed_path == "":
            parsed_path = "/"

        # 1. Main Application Pages (SPA)
        if parsed_path in ("/", "/html", "/dashboard"):
            self.serve_file(AppConfig.HTML_PATH, "text/html; charset=utf-8")
            return

        # 2. Static Assets (/assets/css/..., /assets/js/..., /assets/icons/...)
        if parsed_path.startswith("/assets/"):
            rel_path = parsed_path.removeprefix("/assets/").lstrip("/")
            target_path = (AppConfig.ASSETS_DIR / rel_path).resolve()
            
            # Guard against path traversal outside the assets directory
            if AppConfig.ASSETS_DIR in target_path.parents and target_path.is_file():
                self.serve_file(target_path)
                return
            self.send_json_response(404, {"error": "Asset not found"})
            return

        # 3. API: Live Dashboard Metrics
        if parsed_path == "/api/dashboard":
            payload = DatabaseService.get_dashboard_payload()
            self.send_json_response(200, payload)
            return

        # 4. API: Station Master Database
        if parsed_path == "/database":
            auth_header = self.headers.get("Authorization", "")
            if not auth_service.is_authorized(auth_header):
                self.send_json_response(401, {"error": "Unauthorized"})
                return
            stations = DatabaseService.get_stations()
            self.send_json_response(200, {"stations": stations})
            return

        # 5. Not Found
        self.send_json_response(404, {"error": "Not found"})

    def do_POST(self):
        """Handle POST requests for login and survey submission."""
        path = self.path.rstrip("/")
        content_length = int(self.headers.get("Content-Length", 0))

        try:
            body_bytes = self.rfile.read(content_length) if content_length > 0 else b"{}"
            payload = json.loads(body_bytes.decode("utf-8") or "{}")

            # 1. Login Endpoint
            if path == "/login":
                password = payload.get("password", "")
                if not auth_service.verify_password(password):
                    self.send_json_response(401, {"error": "invalid password"})
                    return
                token = auth_service.create_token()
                self.send_json_response(200, {"token": token})
                return

            # 2. Save Survey Endpoint
            if path == "/save":
                auth_header = self.headers.get("Authorization", "")
                if not auth_service.is_authorized(auth_header):
                    self.send_json_response(401, {"error": "Unauthorized"})
                    return

                fields = payload.get("fields", {})
                photos = payload.get("photos", [])
                record_id = DatabaseService.save_survey(fields, photos)
                self.send_json_response(200, {"saved": True, "recordId": record_id})
                return

            self.send_json_response(404, {"error": "Not found"})

        except Exception as err:
            self.send_json_response(500, {"error": str(err)})

    def log_message(self, fmt, *args):
        """Clean single-line request logging."""
        pass


# ==============================================================================
# 5. Application Entry Point
# ==============================================================================

def run_server():
    DatabaseService.initialize()
    server = ThreadingHTTPServer((AppConfig.HOST, AppConfig.PORT), SurveyRequestHandler)
    print("=" * 60)
    print(" NBTC Microwave — Survey Control Room Server")
    print(f" Address : http://localhost:{AppConfig.PORT}")
    print(f" Pages   : http://localhost:{AppConfig.PORT}/ (Dashboard & Field Form)")
    print("=" * 60)
    server.serve_forever()


if __name__ == "__main__":
    run_server()
