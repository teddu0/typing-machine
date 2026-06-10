const ROW = ["ф", "ы", "в", "а", "п", "р", "о", "л", "д", "ж", "э"];
const COURSE_VERSION = 2;
const FINGERS = {
  ф: "Мизинец левой руки",
  ы: "Безымянный палец левой руки",
  в: "Средний палец левой руки",
  а: "Указательный палец левой руки",
  п: "Указательный палец левой руки",
  р: "Указательный палец правой руки",
  о: "Указательный палец правой руки",
  л: "Средний палец правой руки",
  д: "Безымянный палец правой руки",
  ж: "Мизинец правой руки",
  э: "Мизинец правой руки",
  " ": "Большой палец — пробел"
};

const screens = {
  map: document.querySelector("#map-screen"),
  trainer: document.querySelector("#trainer-screen"),
  result: document.querySelector("#result-screen")
};

let levels = [];
let activeLevel = null;
let position = 0;
let attempts = 0;
let mistakes = 0;
let wrongFlash = false;
let progress = loadProgress();

function loadProgress() {
  try {
    const savedProgress = JSON.parse(localStorage.getItem("klavishki-progress"));
    if (savedProgress?.courseVersion === COURSE_VERSION) return savedProgress;
  } catch {
    // Начинаем новый маршрут, если сохранение повреждено.
  }
  return { courseVersion: COURSE_VERSION, unlocked: 1, stars: {} };
}

function saveProgress() {
  localStorage.setItem("klavishki-progress", JSON.stringify(progress));
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => screen.classList.toggle("hidden", key !== name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderMap() {
  const completed = Object.keys(progress.stars).length;
  const totalStars = Object.values(progress.stars).reduce((sum, stars) => sum + stars, 0);
  document.querySelector("#total-stars").textContent = totalStars;
  document.querySelector("#progress-label").textContent = `Пройдено ${completed} из ${levels.length}`;
  document.querySelector("#progress-fill").style.width = `${(completed / levels.length) * 100}%`;
  document.querySelector("#continue-button").textContent = completed ? "Продолжить занятие" : "Начать занятие";

  const grid = document.querySelector("#level-grid");
  grid.innerHTML = "";
  levels.forEach((level) => {
    const button = document.createElement("button");
    const unlocked = level.id <= progress.unlocked;
    const stars = progress.stars[level.id] || 0;
    button.className = "level-card";
    button.type = "button";
    button.disabled = !unlocked;
    button.innerHTML = `
      <span class="level-top">
        <span class="level-id">${unlocked ? level.id : "🔒"}</span>
        <span class="stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span>
      </span>
      <h3>${level.title}</h3>
      <p>${level.subtitle}</p>
    `;
    button.addEventListener("click", () => startLevel(level.id));
    grid.append(button);
  });
}

function startLevel(id) {
  activeLevel = levels.find((level) => level.id === id);
  if (!activeLevel) return;
  position = 0;
  attempts = 0;
  mistakes = 0;
  wrongFlash = false;
  document.querySelector("#lesson-number").textContent = `Уровень ${activeLevel.id} из ${levels.length}`;
  document.querySelector("#lesson-title").textContent = activeLevel.title;
  document.querySelector("#lesson-tip").textContent = activeLevel.tip;
  document.querySelector("#message").textContent = "Нажми подсвеченную клавишу";
  document.querySelector("#message").className = "message";
  renderKeyboard();
  renderTrainer();
  showScreen("trainer");
}

function renderTrainer() {
  const text = document.querySelector("#typing-text");
  text.innerHTML = [...activeLevel.text].map((character, index) => {
    let className = "";
    if (index < position) className = "done";
    if (index === position) className = wrongFlash ? "current wrong" : "current";
    return `<span class="${className}">${character === " " ? "&nbsp;" : character}</span>`;
  }).join("");

  const accuracy = attempts ? Math.round(((attempts - mistakes) / attempts) * 100) : 100;
  document.querySelector("#accuracy").textContent = `${accuracy}%`;
  const nextCharacter = activeLevel.text[position];
  document.querySelector("#finger-hint").textContent = FINGERS[nextCharacter] || "Печатай дальше";
  document.querySelectorAll(".key").forEach((key) => {
    const isActive = key.dataset.key === nextCharacter;
    key.classList.toggle("active", isActive);
    key.setAttribute("aria-pressed", String(isActive));
  });
}

function renderKeyboard() {
  const keyboard = document.querySelector("#keyboard");
  keyboard.innerHTML = "";

  const letterRow = document.createElement("div");
  letterRow.className = "keyboard-row";
  ROW.forEach((letter) => {
    const key = document.createElement("button");
    key.className = `key${letter === "а" || letter === "о" ? " home" : ""}`;
    key.type = "button";
    key.dataset.key = letter;
    const label = document.createElement("span");
    label.textContent = letter.toUpperCase();
    key.append(label);
    key.setAttribute("aria-label", `Буква ${letter.toUpperCase()}`);
    key.addEventListener("click", () => processInput(letter));
    letterRow.append(key);
  });
  keyboard.append(letterRow);

  const space = document.createElement("button");
  space.className = "key space-key";
  space.type = "button";
  space.dataset.key = " ";
  space.innerHTML = '<span aria-hidden="true">▭</span><strong>ПРОБЕЛ</strong>';
  space.setAttribute("aria-label", "Пробел");
  space.addEventListener("click", () => processInput(" "));
  keyboard.append(space);
}

function finishLevel() {
  const accuracy = Math.round(((attempts - mistakes) / attempts) * 100);
  const stars = accuracy >= 95 ? 3 : accuracy >= 80 ? 2 : 1;
  progress.stars[activeLevel.id] = Math.max(progress.stars[activeLevel.id] || 0, stars);
  progress.unlocked = Math.max(progress.unlocked, Math.min(levels.length, activeLevel.id + 1));
  saveProgress();
  renderMap();

  document.querySelector("#result-stars").textContent = `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`;
  document.querySelector("#result-title").textContent = stars === 3 ? "Великолепно!" : "Уровень готов!";
  document.querySelector("#result-copy").textContent = `Точность ${accuracy}%. ${mistakes ? "Ошибки помогли пальцам запомнить дорогу." : "Ни одной ошибки — вот это сосредоточенность!"}`;
  document.querySelector("#next-button").textContent = activeLevel.id === levels.length ? "К карте уровней" : "Следующий уровень";
  showScreen("result");
}

function processInput(typed) {
  if (screens.trainer.classList.contains("hidden") || !activeLevel) return;
  const expected = activeLevel.text[position];
  if (!ROW.includes(typed) && typed !== " ") return;
  attempts += 1;

  const message = document.querySelector("#message");
  if (typed === expected) {
    position += 1;
    wrongFlash = false;
    message.textContent = "Получилось! Продолжай";
    message.className = "message good";
    if (position === activeLevel.text.length) {
      finishLevel();
      return;
    }
  } else {
    mistakes += 1;
    wrongFlash = true;
    message.textContent = `Почти! Сейчас нужна буква «${expected === " " ? "пробел" : expected.toUpperCase()}»`;
    message.className = "message try";
  }
  renderTrainer();
}

function handleKeydown(event) {
  const typed = event.key.toLowerCase();
  if (!ROW.includes(typed) && typed !== " ") return;
  event.preventDefault();
  processInput(typed);
}

document.querySelector("#home-button").addEventListener("click", () => showScreen("map"));
document.querySelector("#back-button").addEventListener("click", () => showScreen("map"));
document.querySelector("#continue-button").addEventListener("click", () => startLevel(Math.min(progress.unlocked, levels.length)));
document.querySelector("#retry-button").addEventListener("click", () => startLevel(activeLevel.id));
document.querySelector("#next-button").addEventListener("click", () => {
  if (activeLevel.id === levels.length) showScreen("map");
  else startLevel(activeLevel.id + 1);
});
document.addEventListener("keydown", handleKeydown);

fetch("/api/levels")
  .then((response) => {
    if (!response.ok) throw new Error("Не удалось загрузить уровни");
    return response.json();
  })
  .then((data) => {
    levels = data;
    renderMap();
  })
  .catch(() => {
    document.querySelector("#level-grid").innerHTML = "<p>Не получилось загрузить уровни. Попробуй обновить страницу.</p>";
  });
