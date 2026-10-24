const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());

// const path = require("path");

// app.use(express.static(path.join(__dirname, "../client")));

// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "../client/index.html"));
// });

const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 5000;

//test route
app.get("/", (req, res) => {
  res.json({
    message: "Weather API is running"
  });
});

app.get("/weather", async (req, res) => {
  const { city, lat, lon } = req.query;
  if (!city && (!lat || !lon)) {
    return res.status(400).json({ cod: "400", message: "City or coordinates (lat and lon) are required" });
  }

  try {
    const url = (lat && lon)
      ? `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&appid=${API_KEY}&units=metric`
      : `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;

    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({ cod: "404", message: "Location not found" });
    }
    console.error(error);
    res.status(500).json({ cod: "500", message: "Failed to fetch weather data" });
  }
});

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;