const API_BASE = "http://localhost:5000";

// DOM Elements
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");

const loaderEl = document.getElementById("loader");
const errorBox = document.getElementById("error");
const errorText = document.getElementById("errorText");

const currentCard = document.getElementById("currentWeather");
const hourlySection = document.getElementById("hourlySection");
const hourlyDiv = document.getElementById("hourly");
const forecastSection = document.getElementById("forecastSection");
const forecastDiv = document.getElementById("forecast");

const cityDateEl = document.getElementById("cityDate");
const greetingEl = document.getElementById("greeting");
const timeEl = document.getElementById("currentTime");

// Slider buttons
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// Live clock + greeting
function updateLiveTimeAndGreeting() {
  const now = new Date();
  const hours24 = now.getHours();
  const minutes = now.getMinutes();

  const ampm = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  timeEl.textContent = `${hours12}:${minutes.toString().padStart(2, "0")} ${ampm}`;

  if (hours24 >= 5 && hours24 < 12) {
    greetingEl.textContent = "Good Morning";
  } else if (hours24 >= 12 && hours24 < 17) {
    greetingEl.textContent = "Good Afternoon";
  } else if (hours24 >= 17 && hours24 < 21) {
    greetingEl.textContent = "Good Evening";
  } else {
    greetingEl.textContent = "Good Night";
  }
}

setInterval(updateLiveTimeAndGreeting, 60000);
updateLiveTimeAndGreeting();

// Helpers
function showLoader() { loaderEl.classList.remove("hidden"); }
function hideLoader() { loaderEl.classList.add("hidden"); }

function showError(message) {
  errorText.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() { errorBox.classList.add("hidden"); }

function clearPreviousResults() {
  currentCard.classList.add("hidden");
  hourlySection.classList.add("hidden");
  forecastSection.classList.add("hidden");
}

// Fetch Weather
async function getWeatherData(city) {
  const trimmed = city.trim();
  if (!trimmed) {
    showError("Please enter a city name");
    return;
  }

  clearPreviousResults();
  hideError();
  showLoader();

  try {
    const response = await fetch(`${API_BASE}/weather?city=${encodeURIComponent(trimmed)}`);

    if (!response.ok) throw new Error(`Server error ${response.status}`);

    const data = await response.json();

    if (data.cod && data.cod !== "200") {
      throw new Error(data.message || "City not found");
    }

    renderWeather(data);

  } catch (error) {
    const msg = error.message.includes("fetch")
      ? "Cannot connect to server. Make sure backend is running."
      : error.message;

    showError(msg);
  } finally {
    hideLoader();
  }
}

// Render
function renderWeather(data) {
  const current = data.list[0];
  const cityName = data.city.name;
  const country = data.city.country ? `, ${data.city.country}` : "";

  const now = new Date();
  const dateFormatted = `${now.getDate().toString().padStart(2,'0')}.${(now.getMonth()+1).toString().padStart(2,'0')}.${now.getFullYear()}`;

  cityDateEl.innerHTML = `<strong>${cityName}${country}</strong> <span style="color:#888">${dateFormatted}</span>`;

  renderCurrentWeather(current, cityName);
  renderHourlyForecast(data.list);
  renderFiveDayForecast(data);
}

function renderCurrentWeather(item, cityName) {
  const temp = Math.round(item.main.temp);
  const desc = item.weather[0].description;
  const icon = item.weather[0].icon;
  const windKmh = (item.wind.speed * 3.6).toFixed(1);

  currentCard.innerHTML = `
    <h2>${cityName}</h2>
    <img src="https://openweathermap.org/img/wn/${icon}@4x.png" class="weather-icon">
    <div class="temp">${temp}°</div>
    <p class="desc">${desc}</p>
    <div class="current-stats">
      <div><i class="fa-solid fa-wind"></i><span>${windKmh} km/h</span></div>
      <div><i class="fa-solid fa-droplet"></i><span>${item.main.humidity}%</span></div>
    </div>
  `;
  currentCard.classList.remove("hidden");
}

function renderHourlyForecast(list) {
  const next8Hours = list.slice(0, 8);

  hourlyDiv.innerHTML = next8Hours.map(slot => {
    const time = new Date(slot.dt_txt);
    const hour = time.getHours();
    const displayHour = hour % 12 || 12;
    const ampm = hour >= 12 ? "PM" : "AM";

    return `
      <div class="hourly-card">
        <div class="time">${displayHour} ${ampm}</div>
        <img src="https://openweathermap.org/img/wn/${slot.weather[0].icon}.png">
        <div class="temp">${Math.round(slot.main.temp)}°</div>
      </div>
    `;
  }).join("");

  hourlySection.classList.remove("hidden");
}

function renderFiveDayForecast(data) {
  const daily = data.list.filter((_, i) => i % 8 === 0).slice(0, 5);

  forecastDiv.innerHTML = daily.map((day, index) => {
    const date = new Date(day.dt_txt);
    const dayName = index === 0 ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" });

    return `
      <div class="forecast-card">
        <small>${dayName}</small>
        <img src="https://openweathermap.org/img/wn/${day.weather[0].icon}.png">
        <div class="temp">${Math.round(day.main.temp)}°</div>
      </div>
    `;
  }).join("");

  forecastSection.classList.remove("hidden");
}

// Slider
if (prevBtn && nextBtn) {
  prevBtn.addEventListener("click", () => {
    hourlyDiv.scrollBy({ left: -220, behavior: "smooth" });
  });

  nextBtn.addEventListener("click", () => {
    hourlyDiv.scrollBy({ left: 220, behavior: "smooth" });
  });
}

// Events
cityInput.addEventListener("keydown", e => {
  if (e.key === "Enter") getWeatherData(cityInput.value);
});
searchBtn.addEventListener("click", () => getWeatherData(cityInput.value));