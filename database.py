import base64
import datetime as dt
import json
import os
import secrets
import sqlite3
import threading
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "survey.db"
HTML_PATH = ROOT / "Index.html"
PASSWORD_PATH = ROOT / "access-password.txt"
TOKENS = {}
TOKEN_LOCK = threading.Lock()
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def cell_value(cell, shared_strings):
    value = cell.find("m:v", NS)
    if value is None:
        return ""
    text = value.text or ""
    return shared_strings[int(text)] if cell.get("t") == "s" else text


def read_database_xlsx(path):
    with zipfile.ZipFile(path) as archive:
        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = ["".join(item.itertext()) for item in shared.findall("m:si", NS)]
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall(".//m:sheetData/m:row", NS):
            values = {}
            for cell in row.findall("m:c", NS):
                ref = cell.get("r", "")
                column = "".join(char for char in ref if char.isalpha())
                if column:
                    index = 0
                    for char in column:
                        index = index * 26 + ord(char.upper()) - 64
                    values[index - 1] = cell_value(cell, shared_strings)
            rows.append([values.get(index, "") for index in range(max(values.keys(), default=-1) + 1)])
        return rows


def connect():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with connect() as connection:
        connection.executescript("""
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
        if connection.execute("SELECT COUNT(*) FROM stations").fetchone()[0] == 0:
            rows = read_database_xlsx(ROOT / "DATABASE.xlsx")
            for row in rows[2:]:
                if len(row) > 2 and row[2]:
                    values = (row[2], row[3] if len(row) > 3 else "", row[4] if len(row) > 4 else "",
                              row[5] if len(row) > 5 else "", row[9] if len(row) > 9 else "",
                              row[10] if len(row) > 10 else "", row[11] if len(row) > 11 else "",
                              row[12] if len(row) > 12 else "")
                    connection.execute("""INSERT INTO stations
                        (village, subdistrict, district, province, installation_place,
                         equipment_place, contact_name, contact_position)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", values)
        if connection.execute("SELECT COUNT(*) FROM surveys").fetchone()[0] == 0:
            for path in sorted(ROOT.glob("survey-*.json")):
                record = json.loads(path.read_text(encoding="utf-8-sig"))
                record_id = record.get("recordId") or path.stem
                saved_at = record.get("savedAt") or dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone.utc).isoformat()
                connection.execute("INSERT OR IGNORE INTO surveys(record_id, saved_at, fields_json) VALUES (?, ?, ?)",
                                   (record_id, saved_at, json.dumps(record.get("fields", {}), ensure_ascii=False)))


def authorized(handler):
    token = handler.headers.get("Authorization", "").removeprefix("Bearer ")
    with TOKEN_LOCK:
        expiry = TOKENS.get(token)
        if expiry and expiry > dt.datetime.now(dt.timezone.utc):
            return True
        TOKENS.pop(token, None)
    return False


def send_json(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


def send_html(handler, body):
    encoded = body.encode("utf-8")
    handler.send_response(200)
    handler.send_header("Content-Type", "text/html; charset=utf-8")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(encoded)


def dashboard_payload():
    with connect() as connection:
        stations = connection.execute("SELECT id, village, province FROM stations ORDER BY id").fetchall()
        surveys = connection.execute("SELECT record_id, saved_at, fields_json FROM surveys ORDER BY saved_at DESC").fetchall()

    station_by_index = {str(index): dict(station) for index, station in enumerate(stations)}
    recent = []
    province_counts = {}
    allowed = denied = 0
    for survey in surveys:
        fields = json.loads(survey["fields_json"])
        permit = fields.get("permit", "")
        if permit in ("อนุญาต", "on"):
            allowed += 1
        elif permit in ("ไม่อนุญาต",):
            denied += 1
        permit_label = "อนุญาต" if permit == "on" else permit
        station = station_by_index.get(str(fields.get("contactVillage", "")), {})
        province = station.get("province") or "ไม่ระบุจังหวัด"
        province_counts[province] = province_counts.get(province, 0) + 1
        if len(recent) < 10:
            recent.append({
                "recordId": survey["record_id"],
                "savedAt": survey["saved_at"],
                "station": station.get("village") or fields.get("stationSelect") or "ไม่ระบุสถานี",
                "province": province,
                "permit": permit_label or "ยังไม่ระบุ"
            })
    return {
        "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "stats": {"surveys": len(surveys), "stations": len(stations), "allowed": allowed, "denied": denied},
        "provinces": sorted(({"name": name, "count": count} for name, count in province_counts.items()),
                             key=lambda item: item["count"], reverse=True)[:8],
        "recent": recent
    }


DASHBOARD_HTML = r"""<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Survey Control Room</title>
<style>
:root{--ink:#20354d;--muted:#71849b;--line:#c5d9ed;--teal:#79a9d3;--red:#d96774}
.wrap{max-width:1180px;margin:auto;padding:34px 22px 58px;border-top:5px solid #d87882}.top{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:28px}.kicker{color:#86a9c9;font-size:12px;letter-spacing:2px;font-weight:700}.top h1{font-size:clamp(2rem,4vw,3.4rem);line-height:1;margin:9px 0 0;letter-spacing:0}.stamp{color:var(--muted);font-size:13px;text-align:right}.pulse{display:inline-block;width:8px;height:8px;border-radius:50%;background:#d87882;box-shadow:0 0 0 6px #d8788233;margin-right:7px}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}.card,.panel{background:#25313de8;border:1px solid #455667;box-shadow:0 16px 40px #0008}.card{padding:18px 20px;border-radius:10px}.card small{color:#9aa9b8;display:block}.value{display:block;font-size:2.2rem;font-weight:700;margin-top:3px}.teal{color:#86a9c9}.gold{color:#d87882}.red{color:#ed9299}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}.card,.panel{background:#ffffffd9;border:1px solid #c5d9ed;box-shadow:0 16px 40px #7898b533}.card{padding:18px 20px;border-radius:10px}.card small{color:#71849b;display:block}.value{display:block;font-size:2.2rem;font-weight:700;margin-top:3px}.teal{color:#527eae}.gold{color:#e9828d}.red{color:#d96774}
.grid{display:grid;grid-template-columns:1fr 1.35fr;gap:14px}.panel{border-radius:10px;padding:20px}.panel h2{font-size:1.05rem;margin:0 0 18px}.bars{display:grid;gap:13px}.barline{display:grid;grid-template-columns:minmax(110px,1fr) 2fr 30px;gap:10px;align-items:center;font-size:14px}.track{height:9px;background:#07181c;border-radius:8px;overflow:hidden}.fill{height:100%;background:linear-gradient(90deg,var(--teal),#8de4cf);border-radius:8px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:600px}th,td{padding:11px 9px;border-bottom:1px solid #28515988;text-align:left;white-space:nowrap}th{color:var(--muted);font-size:12px;font-weight:600}td{font-size:14px}.badge{display:inline-block;padding:3px 8px;border-radius:20px;font-size:12px;background:#ffffff12}.ok{color:var(--teal)}.no{color:var(--red)}.empty{color:var(--muted);padding:25px 0;text-align:center}
@media(max-width:760px){.wrap{padding:24px 14px 40px}.top{display:block}.stamp{text-align:left;margin-top:14px}.cards{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.card{padding:14px}.value{font-size:1.8rem}}
body{background:linear-gradient(135deg,#111820 0%,#202b36 52%,#344353 100%);color:#e5ebf0}
.wrap{border-top-color:#d87882}.kicker{color:#86a9c9}.pulse{background:#d87882;box-shadow:0 0 0 6px #d8788233}
.card,.panel{background:#25313de8;border-color:#455667;box-shadow:0 16px 40px #0008}.card small{color:#9aa9b8}.teal{color:#86a9c9}.gold{color:#d87882}.red{color:#ed9299}.track{background:#18222c}.fill{background:linear-gradient(90deg,#668bab,#86a9c9)}th,td{border-bottom-color:#455667}th{color:#e5ebf0;background:#3a5269}.badge{background:#ffffff12}
</style></head><body><main class="wrap"><header class="top"><div><div class="kicker">FIELD SERVICE / LIVE OPERATIONS</div><h1>Survey Dashboard</h1></div><div class="stamp"><span class="pulse"></span>ข้อมูลอัปเดตอัตโนมัติ<br><span id="updated">กำลังโหลด...</span></div></header>
<section class="cards"><article class="card"><small>ผลสำรวจทั้งหมด</small><span class="value teal" id="surveys">-</span></article><article class="card"><small>สถานีในระบบ</small><span class="value" id="stations">-</span></article><article class="card"><small>อนุญาตเข้าพื้นที่</small><span class="value gold" id="allowed">-</span></article><article class="card"><small>ไม่อนุญาตเข้าพื้นที่</small><span class="value red" id="denied">-</span></article></section>
<section class="grid"><article class="panel"><h2>พื้นที่ที่มีการสำรวจสูงสุด</h2><div class="bars" id="provinces"></div></article><article class="panel"><h2>รายการสำรวจล่าสุด</h2><div class="table-wrap"><table><thead><tr><th>รหัสรายการ</th><th>สถานี</th><th>จังหวัด</th><th>ผลอนุญาต</th><th>เวลาบันทึก</th></tr></thead><tbody id="recent"></tbody></table></div></article></section>
</main><script>
const fmt = value => new Intl.NumberFormat('th-TH').format(value);
const dateFmt = value => new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
async function refresh(){
  const response=await fetch('/api/dashboard',{cache:'no-store'}); if(!response.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
  const data=await response.json();
  for(const key of ['surveys','stations','allowed','denied']) document.getElementById(key).textContent=fmt(data.stats[key]);
  document.getElementById('updated').textContent='อัปเดต '+dateFmt(data.updatedAt);
  const max=Math.max(...data.provinces.map(item=>item.count),1);
  document.getElementById('provinces').innerHTML=data.provinces.length?data.provinces.map(item=>`<div class="barline"><span>${item.name}</span><span class="track"><span class="fill" style="width:${item.count/max*100}%"></span></span><strong>${item.count}</strong></div>`).join(''):'<div class="empty">ยังไม่มีข้อมูล</div>';
  document.getElementById('recent').innerHTML=data.recent.length?data.recent.map(item=>`<tr><td>${item.recordId}</td><td>${item.station}</td><td>${item.province}</td><td><span class="badge ${item.permit==='อนุญาต'?'ok':item.permit==='ไม่อนุญาต'?'no':''}">${item.permit}</span></td><td>${dateFmt(item.savedAt)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">ยังไม่มีผลสำรวจ</td></tr>';
}
refresh().catch(error=>document.getElementById('updated').textContent=error.message);setInterval(()=>refresh().catch(()=>{}),5000);
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        path = unquote(self.path).split("?", 1)[0].rstrip("/")
        if path == "/html":
            body = HTML_PATH.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif path == "/dashboard":
            send_html(self, DASHBOARD_HTML)
        elif path == "/api/dashboard":
            send_json(self, 200, dashboard_payload())
        elif path == "/database" and authorized(self):
            with connect() as connection:
                stations = [dict(row) for row in connection.execute("SELECT * FROM stations ORDER BY id")]
            send_json(self, 200, {"stations": stations})
        elif path == "/database":
            send_json(self, 401, {"error": "Unauthorized"})
        else:
            send_json(self, 404, {"error": "Not found"})

    def do_POST(self):
        path = self.path.rstrip("/")
        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
            if path == "/login":
                password = PASSWORD_PATH.read_text(encoding="utf-8-sig").strip()
                if payload.get("password") != password:
                    send_json(self, 401, {"error": "invalid password"})
                    return
                token = secrets.token_urlsafe(32)
                with TOKEN_LOCK:
                    TOKENS[token] = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=8)
                send_json(self, 200, {"token": token})
                return
            if path != "/save" or not authorized(self):
                send_json(self, 401, {"error": "Unauthorized"})
                return
            stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
            record_id = f"PM-{stamp}-{secrets.token_hex(2)}"
            saved_at = dt.datetime.now(dt.timezone.utc).isoformat()
            fields = payload.get("fields", {})
            photos = payload.get("photos", [])
            with connect() as connection:
                cursor = connection.execute("INSERT INTO surveys(record_id, saved_at, fields_json) VALUES (?, ?, ?)",
                                            (record_id, saved_at, json.dumps(fields, ensure_ascii=False)))
                survey_id = cursor.lastrowid
                for photo in photos:
                    connection.execute("INSERT INTO survey_photos(survey_id, name, content_type, data) VALUES (?, ?, ?, ?)",
                                       (survey_id, photo.get("name", "photo"), photo.get("type", "image/jpeg"),
                                        base64.b64decode(photo.get("data", ""))))
            send_json(self, 200, {"saved": True, "recordId": record_id})
        except Exception as error:
            send_json(self, 500, {"error": str(error)})

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    initialize_database()
    port = int(os.environ.get("PORT", 8765))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"SQLite survey server running at http://0.0.0.0:{port}", flush=True)
    server.serve_forever()
