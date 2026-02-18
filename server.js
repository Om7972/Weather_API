const express = require("express");
const path = require("path");

try {
  require("dotenv").config();
} catch {
  // dotenv is optional; fall back to process.env if not installed
}

const API_KEY = process.env.WEATHER_API_KEY;
const DEFAULT_COUNTRIES = (process.env.WEATHER_DEFAULT_COUNTRIES || "IN,US")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);
const PORT = process.env.PORT || 3004;

if (!API_KEY) {
  console.error("Missing WEATHER_API_KEY. Create a .env file or set the environment variable.");
  process.exit(1);
}

const app = express();
const publicDir = path.join(__dirname, "public");

app.use(express.static(publicDir));

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

const rate = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQ = 60;

function getIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function rateLimit(req, res, next) {
  const ip = getIp(req);
  const now = Date.now();
  const entry = rate.get(ip);

  if (!entry || now > entry.reset) {
    rate.set(ip, { count: 1, reset: now + WINDOW_MS });
    return next();
  }

  if (entry.count >= MAX_REQ) {
    const retryAfter = Math.ceil((entry.reset - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({ error: "Too many requests. Please try again shortly." });
  }

  entry.count += 1;
  return next();
}

async function fetchJson(url) {
  const resp = await fetch(url);
  const data = await resp.json();
  if (!resp.ok) {
    const message = data && data.error && data.error.message ? data.error.message : "Weather API error";
    const error = new Error(message);
    error.status = resp.status;
    throw error;
  }
  return data;
}

function buildQueryCandidates(query) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return [];
  const hasCountrySuffix = /,\s*[A-Za-z]{2}$/.test(trimmed);
  const isNumeric = /^[0-9]{5,6}$/.test(trimmed);
  if (isNumeric && !hasCountrySuffix && DEFAULT_COUNTRIES.length) {
    const prioritized = DEFAULT_COUNTRIES.map((c) => `${trimmed},${c}`);
    prioritized.push(trimmed);
    return prioritized;
  }
  return [trimmed];
}

function getCached(key) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expires) {
    cache.delete(key);
    return null;
  }
  return cached.data;
}

function setCached(key, data) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

app.get("/api/search", rateLimit, async (req, res) => {
  const query = String(req.query.query || req.query.q || "").trim();
  if (!query) return res.status(400).json({ error: "Missing query parameter" });

  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = new URL("https://api.weatherapi.com/v1/search.json");
    url.searchParams.set("key", API_KEY);
    url.searchParams.set("q", query);
    const data = await fetchJson(url.toString());
    setCached(cacheKey, data);
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || "Search failed" });
  }
});

app.get("/api/weather", rateLimit, async (req, res) => {
  const query = String(req.query.query || req.query.q || "").trim();
  if (!query) return res.status(400).json({ error: "Missing query parameter" });

  try {
    const candidates = buildQueryCandidates(query);
    let lastError = null;

    for (const candidate of candidates) {
      const cacheKey = `weather:${candidate.toLowerCase()}`;
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);

      const url = new URL("https://api.weatherapi.com/v1/forecast.json");
      url.searchParams.set("key", API_KEY);
      url.searchParams.set("q", candidate);
      url.searchParams.set("days", "7");
      url.searchParams.set("aqi", "yes");
      url.searchParams.set("alerts", "yes");

      try {
        const data = await fetchJson(url.toString());
        setCached(cacheKey, data);
        return res.json(data);
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("Weather fetch failed");
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || "Weather fetch failed" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
