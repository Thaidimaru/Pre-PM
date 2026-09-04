/**
 * NBTC Microwave — Survey Control Room (Pre-PM)
 * Netlify Serverless API Function (Node.js + Netlify Blobs)
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { getStore } = require("@netlify/blobs");
const XLSX = require("xlsx");

// --------------------------------------------------------------------------
// 1. Constants & Configurations
// --------------------------------------------------------------------------
const ROOT = path.join(__dirname, "../..");
const PASSWORD_PATH = path.join(ROOT, "access-password.txt");
const DATABASE_XLSX = path.join(ROOT, "DATABASE.xlsx");

const STORE_NAME = "survey-control-room";
const STATIONS_KEY = "stations.json";
const LEGACY_SURVEYS_KEY = "surveys.json";
const SURVEY_PREFIX = "survey/";
const MAX_PHOTO_DATA_CHARS = 5600000; // ~4.2 MB raw binary payload
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// --------------------------------------------------------------------------
// 2. Helpers & Authentication
// --------------------------------------------------------------------------

/** Return standard JSON response */
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

/** Retrieve configured secret password */
function readPassword() {
  if (process.env.FORM_PASSWORD) {
    return process.env.FORM_PASSWORD.trim();
  }
  if (fs.existsSync(PASSWORD_PATH)) {
    return fs.readFileSync(PASSWORD_PATH, "utf8").replace(/^\ufeff/, "").trim();
  }
  return "admin";
}

/** Generate HMAC-SHA256 signed bearer token */
function issueToken() {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Date.now() + TOKEN_TTL_MS,
      nonce: crypto.randomBytes(12).toString("hex"),
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", readPassword())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

/** Verify HMAC-SHA256 signature and token expiry */
function isAuthorized(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  try {
    const expected = crypto
      .createHmac("sha256", readPassword())
      .update(parts[0])
      .digest("base64url");

    const a = Buffer.from(parts[1]);
    const b = Buffer.from(expected);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return false;
    }

    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

// --------------------------------------------------------------------------
// 3. Blob Storage Service
// --------------------------------------------------------------------------

function getBlobStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

async function readJson(key, fallback = null) {
  try {
    const val = await getBlobStore().get(key, { type: "json" });
    return val == null ? fallback : val;
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  await getBlobStore().setJSON(key, value);
}

// --------------------------------------------------------------------------
// 4. Data Operations: Stations & Surveys
// --------------------------------------------------------------------------

/** Load stations from Blobs cache or extract from DATABASE.xlsx */
async function getStations() {
  const cached = await readJson(STATIONS_KEY, null);
  if (Array.isArray(cached) && cached.length > 0) {
    return cached;
  }

  if (!fs.existsSync(DATABASE_XLSX)) {
    return [];
  }

  const workbook = XLSX.readFile(DATABASE_XLSX, { cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

  const stations = [];
  for (const row of rows.slice(2)) {
    if (row[2]) {
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
  }

  if (stations.length > 0) {
    await writeJson(STATIONS_KEY, stations);
  }

  return stations;
}

/** Retrieve all survey records sorted newest first */
async function getAllSurveys() {
  const result = await getBlobStore().list({ prefix: SURVEY_PREFIX });
  const items = Array.isArray(result) ? result : result.blobs || [];

  const currentSurveys = await Promise.all(
    items.map(async (item) => {
      const key = typeof item === "string" ? item : item.key;
      return key ? await readJson(key, null) : null;
    })
  );

  const surveys = currentSurveys.filter(Boolean);

  // Include legacy surveys if any exist in single blob
  const legacy = await readJson(LEGACY_SURVEYS_KEY, []);
  if (Array.isArray(legacy) && legacy.length > 0) {
    surveys.push(...legacy);
  }

  return surveys.sort((a, b) =>
    String(b.savedAt || "").localeCompare(String(a.savedAt || ""))
  );
}

function findStation(stations, fields) {
  const name = String(fields.station || fields.stationSelect || "").trim();
  if (!name) return null;
  return stations.find((s) => String(s.village).trim() === name) || null;
}

/** Compile live statistics for dashboard */
async function getDashboardData() {
  const [stations, surveys] = await Promise.all([getStations(), getAllSurveys()]);
  const provinceCounts = new Map();
  let allowedCount = 0;
  let deniedCount = 0;

  for (const survey of surveys) {
    const fields = survey.fields || {};
    const station = findStation(stations, fields);
    const province = station?.province || String(fields.province || "ไม่ระบุจังหวัด");

    provinceCounts.set(province, (provinceCounts.get(province) || 0) + 1);

    if (fields.permit === "อนุญาต" || fields.permit === "on") {
      allowedCount++;
    } else if (fields.permit === "ไม่อนุญาต") {
      deniedCount++;
    }
  }

  const recentList = surveys.slice(0, 10).map((s) => {
    const f = s.fields || {};
    const st = findStation(stations, f);
    return {
      recordId: s.recordId,
      savedAt: s.savedAt,
      station: st?.village || f.station || f.stationSelect || "ไม่ระบุสถานี",
      province: st?.province || f.province || "ไม่ระบุจังหวัด",
      permit: f.permit === "on" ? "อนุญาต" : f.permit || "ยังไม่ระบุ",
    };
  });

  const sortedProvinces = [...provinceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  return {
    updatedAt: new Date().toISOString(),
    stats: {
      surveys: surveys.length,
      stations: stations.length,
      allowed: allowedCount,
      denied: deniedCount,
    },
    provinces: sortedProvinces,
    recent: recentList,
  };
}

// --------------------------------------------------------------------------
// 5. Netlify Serverless Handler Router
// --------------------------------------------------------------------------

exports.handler = async (event) => {
  try {
    const route = (event.path || "").split("/").filter(Boolean).pop() || "";

    // 1. POST /login
    if (event.httpMethod === "POST" && route === "login") {
      const payload = JSON.parse(event.body || "{}");
      if (payload.password !== readPassword()) {
        return json(401, { error: "invalid_password", message: "รหัสผ่านไม่ถูกต้อง" });
      }
      return json(200, { token: issueToken() });
    }

    // 2. GET /dashboard (or /api/dashboard)
    if (event.httpMethod === "GET" && (route === "dashboard" || route === "api")) {
      return json(200, await getDashboardData());
    }

    // Guard all subsequent endpoints with authentication
    if (!isAuthorized(event)) {
      return json(401, { error: "unauthorized", message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" });
    }

    // 3. GET /database
    if (event.httpMethod === "GET" && route === "database") {
      const stations = await getStations();
      return json(200, { stations });
    }

    // 4. POST /save
    if (event.httpMethod === "POST" && route === "save") {
      const payload = JSON.parse(event.body || "{}");
      const fields = payload.fields || {};
      const photos = Array.isArray(payload.photos) ? payload.photos : [];

      const sanitizedPhotos = photos.map((p) => ({
        name: String(p.name || "photo"),
        type: String(p.type || "image/jpeg"),
        data: String(p.data || ""),
      }));

      const totalPhotoChars = sanitizedPhotos.reduce((acc, p) => acc + p.data.length, 0);
      if (totalPhotoChars > MAX_PHOTO_DATA_CHARS) {
        return json(413, {
          error: "photos_too_large",
          message: "รูปภาพมีขนาดรวมใหญ่เกินไป กรุณาลดจำนวนหรือขนาดรูปภาพ",
        });
      }

      const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 15);
      const randomSuffix = crypto.randomBytes(2).toString("hex");
      const recordId = `PM-${timestamp}-${randomSuffix}`;
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
