const app = document.getElementById("app");
const statusEl = document.getElementById("status");
const offlineBadge = document.getElementById("offlineBadge");
const suggestionsEl = document.getElementById("suggestions");
const favoritesEl = document.getElementById("favorites");
const inputEl = document.getElementById("locationInput");
const searchForm = document.getElementById("searchForm");
const unitMetric = document.getElementById("unitMetric");
const unitImperial = document.getElementById("unitImperial");
const geoBtn = document.getElementById("geoBtn");
const saveFavorite = document.getElementById("saveFavorite");

const locationName = document.getElementById("locationName");
const tempEl = document.getElementById("temp");
const conditionEl = document.getElementById("condition");
const conditionIcon = document.getElementById("conditionIcon");
const feelsLike = document.getElementById("feelsLike");
const hiLo = document.getElementById("hiLo");
const localTime = document.getElementById("localTime");
const humidity = document.getElementById("humidity");
const wind = document.getElementById("wind");
const visibility = document.getElementById("visibility");
const pressure = document.getElementById("pressure");
const uv = document.getElementById("uv");
const precip = document.getElementById("precip");
const aqi = document.getElementById("aqi");
const sun = document.getElementById("sun");
const moon = document.getElementById("moon");
const hourlyList = document.getElementById("hourlyList");
const dailyList = document.getElementById("dailyList");
const alertsCard = document.getElementById("alertsCard");
const alertsList = document.getElementById("alertsList");

const state = {
  unit: localStorage.getItem("weather_unit") || "metric",
  favorites: JSON.parse(localStorage.getItem("weather_favorites") || "[]"),
  lastData: JSON.parse(localStorage.getItem("weather_last") || "null"),
  lastQuery: localStorage.getItem("weather_last_query") || ""
};

function setStatus(message) {
  statusEl.textContent = message || "";
}

function setLoading(isLoading) {
  app.classList.toggle("loading", isLoading);
}

function setUnit(unit) {
  state.unit = unit;
  localStorage.setItem("weather_unit", unit);
  unitMetric.classList.toggle("active", unit === "metric");
  unitImperial.classList.toggle("active", unit === "imperial");
  if (state.lastData) renderWeather(state.lastData);
}

function saveState() {
  localStorage.setItem("weather_favorites", JSON.stringify(state.favorites));
}

function isMetric() {
  return state.unit === "metric";
}

function formatTemp(value) {
  const unit = isMetric() ? "C" : "F";
  return `${Math.round(value)}\u00b0${unit}`;
}

function formatSpeed(value) {
  return isMetric() ? `${Math.round(value)} km/h` : `${Math.round(value)} mph`;
}

function formatDistance(value) {
  return isMetric() ? `${Math.round(value)} km` : `${Math.round(value)} mi`;
}

function formatPressure(value) {
  return isMetric() ? `${Math.round(value)} mb` : `${value.toFixed(2)} in`;
}

function formatPrecip(value) {
  return isMetric() ? `${value.toFixed(1)} mm` : `${value.toFixed(2)} in`;
}

function formatHour(epoch, tz) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    timeZone: tz
  }).format(new Date(epoch * 1000));
}

function formatDay(epoch, tz) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz
  }).format(new Date(epoch * 1000));
}

function aqiInfo(index) {
  const map = {
    1: { label: "Good", color: "#10b981" },
    2: { label: "Moderate", color: "#f59e0b" },
    3: { label: "Unhealthy (Sensitive)", color: "#f97316" },
    4: { label: "Unhealthy", color: "#ef4444" },
    5: { label: "Very Unhealthy", color: "#a855f7" },
    6: { label: "Hazardous", color: "#7f1d1d" }
  };
  return map[index] || { label: "N/A", color: "var(--muted)" };
}

function setTheme(current) {
  if (!current || current.is_day === 0) {
    document.body.setAttribute("data-theme", "night");
    return;
  }
  const text = (current.condition && current.condition.text || "").toLowerCase();
  if (text.includes("snow") || text.includes("ice")) return document.body.setAttribute("data-theme", "snow");
  if (text.includes("thunder") || text.includes("storm")) return document.body.setAttribute("data-theme", "storm");
  if (text.includes("rain") || text.includes("drizzle")) return document.body.setAttribute("data-theme", "rain");
  if (text.includes("mist") || text.includes("fog")) return document.body.setAttribute("data-theme", "mist");
  if (text.includes("cloud")) return document.body.setAttribute("data-theme", "clear");
  document.body.setAttribute("data-theme", "clear");
}

function renderFavorites() {
  favoritesEl.innerHTML = "";
  if (!state.favorites.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No favorites yet. Save a city to quick switch.";
    favoritesEl.appendChild(empty);
    return;
  }
  state.favorites.forEach((fav) => {
    const btn = document.createElement("button");
    btn.className = "fav-chip";
    btn.textContent = fav;
    btn.addEventListener("click", () => fetchWeather(fav));
    favoritesEl.appendChild(btn);
  });
}

function addFavorite(name) {
  if (!name) return;
  if (state.favorites.includes(name)) return;
  state.favorites.unshift(name);
  state.favorites = state.favorites.slice(0, 8);
  saveState();
  renderFavorites();
}

function removeSuggestions() {
  suggestionsEl.innerHTML = "";
}

function renderSuggestions(items) {
  suggestionsEl.innerHTML = "";
  if (!items || !items.length) return;
  items.slice(0, 5).forEach((item) => {
    const div = document.createElement("div");
    div.className = "suggestion";
    div.textContent = `${item.name}, ${item.region}, ${item.country}`.replace(/,\s*,/g, ",");
    div.addEventListener("click", () => {
      inputEl.value = item.name;
      removeSuggestions();
      fetchWeather(item.name);
    });
    suggestionsEl.appendChild(div);
  });
}

function renderWeather(data, fromCache = false) {
  state.lastData = data;
  localStorage.setItem("weather_last", JSON.stringify(data));
  setTheme(data.current);

  const unitTemp = isMetric() ? data.current.temp_c : data.current.temp_f;
  const feels = isMetric() ? data.current.feelslike_c : data.current.feelslike_f;
  const hi = isMetric() ? data.forecast.forecastday[0].day.maxtemp_c : data.forecast.forecastday[0].day.maxtemp_f;
  const lo = isMetric() ? data.forecast.forecastday[0].day.mintemp_c : data.forecast.forecastday[0].day.mintemp_f;
  const windVal = isMetric() ? data.current.wind_kph : data.current.wind_mph;
  const visVal = isMetric() ? data.current.vis_km : data.current.vis_miles;
  const pressVal = isMetric() ? data.current.pressure_mb : data.current.pressure_in;
  const precipVal = isMetric() ? data.current.precip_mm : data.current.precip_in;

  locationName.textContent = `${data.location.name}, ${data.location.country}`;
  tempEl.textContent = formatTemp(unitTemp);
  conditionEl.textContent = data.current.condition.text;
  conditionIcon.src = data.current.condition.icon.startsWith("//")
    ? `https:${data.current.condition.icon}`
    : data.current.condition.icon;
  conditionIcon.alt = data.current.condition.text;
  feelsLike.textContent = formatTemp(feels);
  hiLo.textContent = `${formatTemp(hi)} / ${formatTemp(lo)}`;
  localTime.textContent = data.location.localtime;

  humidity.textContent = `${data.current.humidity}%`;
  wind.textContent = formatSpeed(windVal);
  visibility.textContent = formatDistance(visVal);
  pressure.textContent = formatPressure(pressVal);
  uv.textContent = String(data.current.uv);
  precip.textContent = formatPrecip(precipVal);

  const aqiIndex = data.current.air_quality ? data.current.air_quality["us-epa-index"] : null;
  const aqiMeta = aqiInfo(aqiIndex);
  aqi.textContent = aqiIndex ? `${aqiIndex} - ${aqiMeta.label}` : "N/A";
  aqi.style.color = aqiMeta.color;

  const astro = data.forecast.forecastday[0].astro;
  sun.textContent = `${astro.sunrise} / ${astro.sunset}`;
  moon.textContent = astro.moon_phase;

  const tz = data.location.tz_id;
  const nowEpoch = data.location.localtime_epoch;
  const hours = data.forecast.forecastday[0].hour.filter(h => h.time_epoch >= nowEpoch).slice(0, 12);

  hourlyList.innerHTML = "";
  hours.forEach((h) => {
    const card = document.createElement("div");
    card.className = "hour-card";
    const temp = isMetric() ? h.temp_c : h.temp_f;
    const icon = h.condition.icon.startsWith("//") ? `https:${h.condition.icon}` : h.condition.icon;
    card.innerHTML = `
      <div class="label">${formatHour(h.time_epoch, tz)}</div>
      <img src="${icon}" alt="${h.condition.text}" width="40" height="40" />
      <div>${formatTemp(temp)}</div>
    `;
    hourlyList.appendChild(card);
  });

  dailyList.innerHTML = "";
  data.forecast.forecastday.forEach((day) => {
    const row = document.createElement("div");
    row.className = "daily-row";
    const icon = day.day.condition.icon.startsWith("//") ? `https:${day.day.condition.icon}` : day.day.condition.icon;
    const hiTemp = isMetric() ? day.day.maxtemp_c : day.day.maxtemp_f;
    const loTemp = isMetric() ? day.day.mintemp_c : day.day.mintemp_f;
    row.innerHTML = `
      <div>
        <div class="label">${formatDay(day.date_epoch, tz)}</div>
        <div>${day.day.condition.text}</div>
      </div>
      <img src="${icon}" alt="${day.day.condition.text}" width="38" height="38" />
      <div>${formatTemp(hiTemp)} / ${formatTemp(loTemp)}</div>
    `;
    dailyList.appendChild(row);
  });

  alertsList.innerHTML = "";
  const alerts = data.alerts && data.alerts.alert ? data.alerts.alert : [];
  if (alerts.length) {
    alertsCard.hidden = false;
    alerts.forEach((alert) => {
      const div = document.createElement("div");
      div.className = "alert";
      div.innerHTML = `
        <div class="label">${alert.headline || "Alert"}</div>
        <div>${alert.desc || ""}</div>
        <div class="muted">${alert.effective || ""} - ${alert.expires || ""}</div>
      `;
      alertsList.appendChild(div);
    });
  } else {
    alertsCard.hidden = true;
  }

  offlineBadge.hidden = !fromCache;
  setStatus(fromCache ? "Showing cached data." : "Updated just now.");
}

async function fetchWeather(query) {
  if (!query) return;
  setLoading(true);
  setStatus("Loading...");
  removeSuggestions();
  try {
    const resp = await fetch(`/api/weather?query=${encodeURIComponent(query)}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Weather fetch failed");
    state.lastQuery = query;
    localStorage.setItem("weather_last_query", query);
    renderWeather(data, false);
  } catch (err) {
    if (state.lastData) {
      renderWeather(state.lastData, true);
      setStatus(`${err.message}. Showing cached data.`);
    } else {
      setStatus(err.message || "Could not fetch weather.");
    }
  } finally {
    setLoading(false);
  }
}

async function fetchSuggestions(query) {
  if (query.length < 2) {
    removeSuggestions();
    return;
  }
  try {
    const resp = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error();
    renderSuggestions(data);
  } catch {
    removeSuggestions();
  }
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  fetchWeather(inputEl.value.trim());
});

inputEl.addEventListener("input", debounce((event) => {
  const value = event.target.value.trim();
  fetchSuggestions(value);
}, 300));

unitMetric.addEventListener("click", () => setUnit("metric"));
unitImperial.addEventListener("click", () => setUnit("imperial"));

geoBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Geolocation not supported.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      fetchWeather(`${latitude},${longitude}`);
    },
    () => setStatus("Unable to access location.")
  );
});

saveFavorite.addEventListener("click", () => {
  const name = locationName.textContent.trim();
  addFavorite(name);
});

window.addEventListener("offline", () => {
  offlineBadge.hidden = false;
});

window.addEventListener("online", () => {
  offlineBadge.hidden = true;
});

renderFavorites();
setUnit(state.unit);

if (state.lastQuery) {
  fetchWeather(state.lastQuery);
} else {
  fetchWeather("New York");
}
