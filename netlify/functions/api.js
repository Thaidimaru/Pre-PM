const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { getStore } = require("@netlify/blobs");
const XLSX = require("xlsx");

const root = path.join(__dirname, "../..");
const passwordPath = path.join(root, "access-password.txt");
const databaseXlsx = path.join(root, "DATABASE.xlsx");
const STORE_NAME = "survey-control-room";
const STATIONS_KEY = "stations.json";
const LEGACY_SURVEYS_KEY = "surveys.json";
const SURVEY_PREFIX = "survey/";
const MAX_PHOTO_DATA_CHARS = 5600000;

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}
function readPassword() { return process.env.FORM_PASSWORD || fs.readFileSync(passwordPath, "utf8").replace(/^\ufeff/, "").trim(); }
function issueToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000, nonce: crypto.randomBytes(12).toString("hex") })).toString("base64url");
  const signature = crypto.createHmac("sha256", readPassword()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function authorized(event) {
  const token = (event.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  try {
    const expected = crypto.createHmac("sha256", readPassword()).update(parts[0]).digest("base64url");
    const a = Buffer.from(parts[1]); const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    return Number(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")).exp) > Date.now();
  } catch { return false; }
}
function store() { return getStore({ name: STORE_NAME, consistency: "strong" }); }
async function readJson(key, fallback) { const value = await store().get(key, { type: "json" }); return value == null ? fallback : value; }
async function writeJson(key, value) { await store().setJSON(key, value); }

async function stationsPayload() {
  const existing = await readJson(STATIONS_KEY, null);
  if (Array.isArray(existing) && existing.length) return existing;
  if (!fs.existsSync(databaseXlsx)) return [];
  const workbook = XLSX.readFile(databaseXlsx, { cellDates: false });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
  const stations = [];
  for (const row of rows.slice(2)) {
    if (row[2]) stations.push({ id: stations.length + 1, village: String(row[2]), subdistrict: String(row[3] || ""), district: String(row[4] || ""), province: String(row[5] || ""), installation_place: String(row[9] || ""), equipment_place: String(row[10] || ""), contact_name: String(row[11] || ""), contact_position: String(row[12] || "") });
  }
  if (stations.length) await writeJson(STATIONS_KEY, stations);
  return stations;
}

async function allSurveys() {
  const result = await store().list({ prefix: SURVEY_PREFIX });
  const items = Array.isArray(result) ? result : (result.blobs || []);
  const current = await Promise.all(items.map(async item => {
    const key = typeof item === "string" ? item : item.key;
    return key ? await readJson(key, null) : null;
  }));
  const surveys = current.filter(Boolean);
  const legacy = await readJson(LEGACY_SURVEYS_KEY, []);
  if (Array.isArray(legacy) && legacy.length) surveys.push(...legacy);
  return surveys.sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
}

function findStation(stations, fields) {
  const stationName = String(fields.station || fields.stationSelect || "").trim();
  if (!stationName) return null;
  return stations.find(s => String(s.village).trim() === stationName) || null;
}

async function dashboardPayload() {
  const stations = await stationsPayload();
  const surveys = await allSurveys();
  const provinces = new Map();
  let allowed = 0;
  let denied = 0;

  for (const survey of surveys) {
    const fields = survey.fields || {};
    const station = findStation(stations, fields);
    const province = station?.province || String(fields.province || "ไม่ระบุจังหวัด");
    provinces.set(province, (provinces.get(province) || 0) + 1);
    if (fields.permit === "อนุญาต" || fields.permit === "on") allowed++;
    if (fields.permit === "ไม่อนุญาต") denied++;
  }

  const recent = surveys.slice(0, 10).map(s => {
    const f = s.fields || {};
    const st = findStation(stations, f);
    return {
      recordId: s.recordId,
      savedAt: s.savedAt,
      station: st?.village || f.station || f.stationSelect || "ไม่ระบุสถานี",
      province: st?.province || f.province || "ไม่ระบุจังหวัด",
      permit: f.permit === "on" ? "อนุญาต" : f.permit || "ยังไม่ระบุ"
    };
  });

  return {
    updatedAt: new Date().toISOString(),
    stats: { surveys: surveys.length, stations: stations.length, allowed, denied },
    provinces: [...provinces.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count })),
    recent
  };
}

exports.handler = async event => {
  try {
    const route = (event.path || "").split("/").filter(Boolean).pop() || "";

    if (event.httpMethod === "POST" && route === "login") {
      const p = JSON.parse(event.body || "{}");
      if (p.password !== readPassword()) return json(401, { error: "invalid password" });
      return json(200, { token: issueToken() });
    }

    if (event.httpMethod === "GET" && route === "dashboard") {
      return json(200, await dashboardPayload());
    }

    if (!authorized(event)) return json(401, { error: "Unauthorized" });

    if (event.httpMethod === "GET" && route === "database") {
      return json(200, { stations: await stationsPayload() });
    }

    if (event.httpMethod === "POST" && route === "save") {
      const payload = JSON.parse(event.body || "{}");
      const fields = payload.fields || {};
      const photos = Array.isArray(payload.photos) ? payload.photos : [];
      const safePhotos = photos.map(p => ({ name: String(p.name || "photo"), type: String(p.type || "image/jpeg"), data: String(p.data || "") }));
      const photoChars = safePhotos.reduce((sum, p) => sum + p.data.length, 0);
      if (photoChars > MAX_PHOTO_DATA_CHARS) return json(413, { error: "photos_too_large", message: "รูปภาพมีขนาดรวมใหญ่เกินไป กรุณาลดจำนวนหรือขนาดรูปภาพ" });

      const recordId = `PM-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0,15)}-${crypto.randomBytes(2).toString("hex")}`;
      const savedAt = new Date().toISOString();
      await writeJson(`${SURVEY_PREFIX}${recordId}.json`, { recordId, savedAt, fields, photos: safePhotos });
      return json(200, { saved: true, recordId, savedAt });
    }

    return json(404, { error: "Not found" });
  } catch (error) {
    console.error("Survey API error:", error);
    return json(500, { error: error?.message || "Internal server error" });
  }
};
