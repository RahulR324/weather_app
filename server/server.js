const express = require("express");
const axios = require("axios");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pino = require("pino");
require("dotenv").config();

const app = express();

const isProduction = process.env.NODE_ENV === "production";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://weather-app-5mg5.vercel.app";

const logger = pino({
  level: isProduction ? "info" : "debug",
  transport: isProduction
    ? undefined
    : { target: "pino-pretty", options: { colorize: true } },
  base: { service: "weather-api" },
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https://openweathermap.org", "https://fonts.gstatic.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        connectSrc: ["'self'", FRONTEND_URL, "https://api.openweathermap.org", "https://api.bigdatacloud.net"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

const corsOptions = {
  origin: FRONTEND_URL,
  methods: ["GET"],
  allowedHeaders: ["Content-Type"],
  credentials: false,
  maxAge: 86400,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

const weatherLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { cod: "429", message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip, path: req.path }, "Rate limit exceeded");
    res.status(429).json({ cod: "429", message: "Too many requests. Please try again later." });
  },
});

app.use("/weather", weatherLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
    });
  });
  next();
});

const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 5000;

if (!API_KEY) {
  logger.error("API_KEY environment variable is not set");
  process.exit(1);
}

function validateCoordinates(lat, lon) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  return (
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

app.get("/", (req, res) => {
  res.json({ message: "Weather API is running", version: "1.0.0" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/weather", async (req, res) => {
  const { city, lat, lon } = req.query;

  if (!city && (!lat || !lon)) {
    logger.warn({ ip: req.ip, query: req.query }, "Missing required parameters");
    return res.status(400).json({ cod: "400", message: "City or coordinates (lat and lon) are required" });
  }

  if (lat && lon && !validateCoordinates(lat, lon)) {
    logger.warn({ ip: req.ip, lat, lon }, "Invalid coordinates provided");
    return res.status(400).json({ cod: "400", message: "Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180" });
  }

  try {
    const url = lat && lon
      ? `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&appid=${API_KEY}&units=metric`
      : `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;

    const response = await axios.get(url, { timeout: 10000 });
    res.json(response.data);
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message || "Failed to fetch weather data";

    if (status === 404) {
      logger.info({ ip: req.ip, city, lat, lon }, "Location not found");
      return res.status(404).json({ cod: "404", message: "Location not found" });
    }

    if (status === 401) {
      logger.error({ ip: req.ip }, "Invalid API key");
      return res.status(500).json({ cod: "500", message: "Weather service configuration error" });
    }

    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      logger.error({ ip: req.ip, error: error.message }, "Upstream timeout");
      return res.status(504).json({ cod: "504", message: "Weather service timeout" });
    }

    logger.error({ ip: req.ip, error: isProduction ? error.message : error.stack }, "Weather API error");
    res.status(500).json({ cod: "500", message: "Failed to fetch weather data" });
  }
});

app.use((req, res) => {
  logger.warn({ ip: req.ip, path: req.path, method: req.method }, "404 - Route not found");
  res.status(404).json({ cod: "404", message: "Endpoint not found" });
});

app.use((err, req, res, next) => {
  logger.error({ ip: req.ip, path: req.path, error: isProduction ? err.message : err.stack }, "Unhandled error");
  res.status(500).json({ cod: "500", message: "Internal server error" });
});

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;