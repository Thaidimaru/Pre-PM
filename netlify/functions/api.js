/** NBTC Microwave — Survey Control Room API (Netlify Function) */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { getStore } = require("@netlify/blobs");
const XLSX = require("xlsx");

const ROOT = path.join(__dirname, "../..");
const PASSWORD_PATH = path.join(ROOT, "access-password.txt");
const DATABASE_XLSX = path.join(ROOT, "DATABASE.xlsx");
const STORE_NAME = "survey-control-room";
const STATIONS_KEY = "stations.json";
const LEGACY_SURVEYS_KEY = "surveys.json";
const SURVEY_PREFIX = "survey/";
const MAX_PHOTO_DATA_CHARS = 5600000;
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function readPassword() {
  if (process.env.FORM_PASSWORD) return process.env.FORM_PASSWORD.trim();
  if (fs.existsSync(PASSWORD_PATH)) {
    return fs.readFileSync(PASSWORD_PATH, "utf8").replace(/^\ufeff/, "").trim();
  }
  return "admin";
}

function issueToken() {
  const payload = Buffer.from(JSON.stringify({
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(12).toString("hex"),
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", readPassword()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function isAuthorized(event) {
  const headers = event.headers || {};
  const authHeader = headers.authorization || headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  try {
    const expected = crypto.createHmac("sha256", readPassword()).update(parts[0]).digest("base64url");
    const a = Buffer.from(parts[1]);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

const memoryStore = new Map();

function getBlobStore() {
  try {
    return getStore(STORE_NAME);
  } catch {
    return null;
  }
}

async function readJson(key, fallback = null) {
  try {
    const store = getBlobStore();
    if (store) {
      const value = await store.get(key, { type: "json" });
      return value == null ? fallback : value;
    }
  } catch {
    // Fall back to memory store
  }
  return memoryStore.has(key) ? memoryStore.get(key) : fallback;
}

async function writeJson(key, value) {
  try {
    const store = getBlobStore();
    if (store) {
      await store.setJSON(key, value);
      return;
    }
  } catch {
    // Fall back to memory store
  }
  memoryStore.set(key, value);
}

function loadLocalSurveys() {
  const localSurveys = [];
  try {
    const files = fs.readdirSync(ROOT).filter((f) => f.startsWith("survey-") && f.endsWith(".json"));
    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
        const recordId = file.replace(/\.json$/, "");
        localSurveys.push({
          recordId: content.recordId || recordId,
          savedAt: content.savedAt || new Date().toISOString(),
          fields: content.fields || {},
          photos: content.photos || [],
        });
      } catch {}
    }
  } catch {}
  return localSurveys;
}

async function getStations() {
  const cached = await readJson(STATIONS_KEY, null);
  if (Array.isArray(cached) && cached.length) return cached;
  if (!fs.existsSync(DATABASE_XLSX)) return [];

  const workbook = XLSX.readFile(DATABASE_XLSX, { cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
  const stations = [];

  for (const row of rows.slice(2)) {
    if (!row[2]) continue;
    stations.push({
      id: stations.length + 1,
      village: String(row[2]).trim(),
      subdistrict: String(row[3] || "").trim(),
      district: String(row[4] || "").trim(),
      province: String(row[5] || "").trim(),
      installation_place: String(row[9] || "").trim(),
      equipment_place: String(row[10] || "").trim(),
      contact_name: String(row[11] || "").trim(),
      contact_position: String(row[12] || "").trim(),
    });
  }

  if (stations.length) await writeJson(STATIONS_KEY, stations);
  return stations;
}

async function getAllSurveys() {
  const surveys = [];
  try {
    const store = getBlobStore();
    if (store) {
      const result = await store.list({ prefix: SURVEY_PREFIX });
      const items = Array.isArray(result) ? result : (result?.blobs || []);
      const blobSurveys = (await Promise.all(items.map(async (item) => {
        const key = typeof item === "string" ? item : item?.key;
        return key ? await readJson(key, null) : null;
      }))).filter(Boolean);
      surveys.push(...blobSurveys);

      const legacy = await readJson(LEGACY_SURVEYS_KEY, []);
      if (Array.isArray(legacy)) surveys.push(...legacy);
    }
  } catch {}

  for (const [key, val] of memoryStore.entries()) {
    if (key.startsWith(SURVEY_PREFIX) && val && typeof val === "object") {
      surveys.push(val);
    }
  }

  if (surveys.length === 0) {
    surveys.push(...loadLocalSurveys());
  }

  return surveys.sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
}

function findStation(stations, fields) {
  const name = String(fields.station || fields.stationSelect || "").trim();
  return name ? (stations.find((s) => String(s.village).trim() === name) || null) : null;
}

async function getDashboardData() {
  const [stations, surveys] = await Promise.all([getStations(), getAllSurveys()]);
  const provinceCounts = new Map();
  let allowed = 0;
  let denied = 0;

  for (const survey of surveys) {
    const fields = survey.fields || {};
    const station = findStation(stations, fields);
    const province = station?.province || String(fields.province || "ไม่ระบุจังหวัด");
    provinceCounts.set(province, (provinceCounts.get(province) || 0) + 1);
    if (fields.permit === "อนุญาต" || fields.permit === "on") allowed++;
    else if (fields.permit === "ไม่อนุญาต") denied++;
  }

  const recent = surveys.slice(0, 10).map((survey) => {
    const fields = survey.fields || {};
    const station = findStation(stations, fields);
    return {
      recordId: survey.recordId,
      savedAt: survey.savedAt,
      station: station?.village || fields.station || fields.stationSelect || "ไม่ระบุสถานี",
      province: station?.province || fields.province || "ไม่ระบุจังหวัด",
      permit: fields.permit === "on" ? "อนุญาต" : fields.permit || "ยังไม่ระบุ",
    };
  });

  return {
    updatedAt: new Date().toISOString(),
    stats: { surveys: surveys.length, stations: stations.length, allowed, denied },
    provinces: [...provinceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count })),
    recent,
  };
}

exports.handler = async (event) => {
  try {
    const route = (event.path || "").split("/").filter(Boolean).pop() || "";

    if (event.httpMethod === "POST" && route === "login") {
      const payload = JSON.parse(event.body || "{}");
      if (payload.password !== readPassword()) {
        return json(401, { error: "invalid_password", message: "รหัสผ่านไม่ถูกต้อง" });
      }
      return json(200, { token: issueToken() });
    }

    if (event.httpMethod === "GET" && route === "dashboard") {
      return json(200, await getDashboardData());
    }

    if (!isAuthorized(event)) {
      return json(401, { error: "unauthorized", message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" });
    }

    if (event.httpMethod === "GET" && route === "database") {
      return json(200, { stations: await getStations() });
    }

    if (event.httpMethod === "POST" && route === "save") {
      const payload = JSON.parse(event.body || "{}");
      const fields = payload.fields && typeof payload.fields === "object" ? payload.fields : {};
      const photos = Array.isArray(payload.photos) ? payload.photos : [];
      const sanitizedPhotos = photos.map((photo) => ({
        name: String(photo?.name || "photo"),
        type: String(photo?.type || "image/jpeg"),
        data: String(photo?.data || ""),
      }));

      const totalPhotoChars = sanitizedPhotos.reduce((sum, photo) => sum + photo.data.length, 0);
      if (totalPhotoChars > MAX_PHOTO_DATA_CHARS) {
        return json(413, {
          error: "photos_too_large",
          message: "รูปภาพมีขนาดรวมใหญ่เกินไป กรุณาลดจำนวนหรือขนาดรูปภาพ",
        });
      }

      const recordId = `PM-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 15)}-${crypto.randomBytes(2).toString("hex")}`;
      const savedAt = new Date().toISOString();
      await writeJson(`${SURVEY_PREFIX}${recordId}.json`, {
        recordId,
        savedAt,
        fields,
        photos: sanitizedPhotos,
      });

      return json(200, { saved: true, recordId, savedAt });
    }

    return json(404, { error: "not_found", message: "Endpoint not found" });
  } catch (error) {
    console.error("Survey Control Room API Error:", error);
    return json(500, { error: "server_error", message: error?.message || "Internal server error" });
  }
};
