import { initializeAccount, mergeServerProgress } from "./account.js";
import { russianLayout } from "./keyboard-layouts.js";
import {
  levelKey,
  loadProgress,
  normalizeProgress,
  saveProgress as persistProgress,
} from "./progress.js";

// Включите для тестирования всех курсов и занятий без прохождения предыдущих.
const isFullAccess = false;

const activeLayout = russianLayout;
const KEYBOARD_ROWS = activeLayout.rows;
const TRAINABLE_CHARACTERS = activeLayout.trainableCharacters;
const PHYSICAL_LETTER_CODES = activeLayout.physicalLetterCodes;
const FINGERS = activeLayout.fingers;
const FINGER_IDS = activeLayout.fingerIds;
const FINGER_COLOR_CLASSES = activeLayout.fingerColorClasses;

const screens = {
  map: document.querySelector("#map-screen"),
  guide: document.querySelector("#guide-screen"),
  profile: document.querySelector("#profile-screen"),
  trainer: document.querySelector("#trainer-screen"),
  result: document.querySelector("#result-screen"),
};

let courses = [];
let activeCourse = null;
let activeLevel = null;
let position = 0;
let attempts = 0;
let mistakes = 0;
let wrongFlash = false;
let keyboardLayout = "unknown";
let progress = loadProgress();

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) =>
    screen.classList.toggle("hidden", key !== name),
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function isCourseComplete(course) {
  return course.levels.every(
    (level) => progress.stars[levelKey(course.id, level.id)],
  );
}

function isCourseUnlocked(courseIndex) {
  return (
    isFullAccess ||
    courseIndex === 0 ||
    isCourseComplete(courses[courseIndex - 1])
  );
}

function isLevelUnlocked(course, courseIndex, levelIndex) {
  if (isFullAccess) return true;
  if (!isCourseUnlocked(courseIndex)) return false;
  return (
    levelIndex === 0 ||
    Boolean(
      progress.stars[levelKey(course.id, course.levels[levelIndex - 1].id)],
    )
  );
}

function findNextLevel() {
  for (let courseIndex = 0; courseIndex < courses.length; courseIndex += 1) {
    const course = courses[courseIndex];
    for (
      let levelIndex = 0;
      levelIndex < course.levels.length;
      levelIndex += 1
    ) {
      const level = course.levels[levelIndex];
      if (
        !progress.stars[levelKey(course.id, level.id)] &&
        isLevelUnlocked(course, courseIndex, levelIndex)
      ) {
        return { course, level };
      }
    }
  }
  return { course: courses.at(-1), level: courses.at(-1)?.levels.at(-1) };
}

function renderMap() {
  const allLevels = courses.flatMap((course) => course.levels);
  const completed = allLevels.filter((level, index) => {
    const course = courses.find((item) => item.levels.includes(level));
    return progress.stars[levelKey(course.id, level.id)];
  }).length;
  const totalStars = Object.values(progress.stars).reduce(
    (sum, stars) => sum + stars,
    0,
  );

  document.querySelector("#total-stars").textContent = totalStars;
  document.querySelector("#progress-label").textContent =
    `Пройдено ${completed} из ${allLevels.length} занятий`;
  document.querySelector("#progress-fill").style.width =
    `${(completed / allLevels.length) * 100}%`;
  document.querySelector("#continue-button").textContent = completed
    ? "Продолжить занятие"
    : "Начать занятие";

  const container = document.querySelector("#courses-container");
  container.innerHTML = "";
  courses.forEach((course, courseIndex) => {
    const unlocked = isCourseUnlocked(courseIndex);
    const completedInCourse = course.levels.filter(
      (level) => progress.stars[levelKey(course.id, level.id)],
    ).length;
    const section = document.createElement("section");
    section.className = `course-section${unlocked ? "" : " locked"}`;
    section.innerHTML = `
      <div class="course-heading">
        <div class="course-icon">${unlocked ? course.icon : "🔒"}</div>
        <div>
          <p class="eyebrow">Курс ${course.order}</p>
          <h3>${course.title}</h3>
          <p>${course.description}</p>
        </div>
        <strong>${completedInCourse} / ${course.levels.length}</strong>
      </div>
      <div class="course-progress"><div style="width: ${(completedInCourse / course.levels.length) * 100}%"></div></div>
      <div class="level-grid"></div>
    `;

    const grid = section.querySelector(".level-grid");
    course.levels.forEach((level, levelIndex) => {
      const levelUnlocked = isLevelUnlocked(course, courseIndex, levelIndex);
      const stars = progress.stars[levelKey(course.id, level.id)] || 0;
      const button = document.createElement("button");
      button.className = "level-card";
      button.type = "button";
      button.disabled = !levelUnlocked;
      button.innerHTML = `
        <span class="level-top">
          <span class="level-id">${levelUnlocked ? level.id : "🔒"}</span>
          <span class="stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span>
        </span>
        <h3>${level.title}</h3>
        <p>${level.subtitle}</p>
      `;
      button.addEventListener("click", () => startLevel(course.id, level.id));
      grid.append(button);
    });
    container.append(section);
  });
}

function startLevel(courseId, levelId) {
  activeCourse = courses.find((course) => course.id === courseId);
  activeLevel = activeCourse?.levels.find((level) => level.id === levelId);
  if (!activeLevel) return;

  position = 0;
  attempts = 0;
  mistakes = 0;
  wrongFlash = false;
  keyboardLayout = "unknown";
  document.querySelector("#lesson-number").textContent =
    `${activeCourse.title} · занятие ${activeLevel.id} из ${activeCourse.levels.length}`;
  document.querySelector("#lesson-title").textContent = activeLevel.title;
  document.querySelector("#lesson-tip").textContent = activeLevel.tip;
  document.querySelector("#message").textContent = "Нажми подсвеченную клавишу";
  document.querySelector("#message").className = "message";
  renderLayoutStatus();
  renderKeyboard();
  renderTrainer();
  showScreen("trainer");
}

function renderLayoutStatus() {
  const status = document.querySelector("#layout-status");
  const value = document.querySelector("#layout-value");
  const warning = document.querySelector("#layout-warning");
  status.className = `layout-status ${keyboardLayout}`;
  value.textContent =
    keyboardLayout === "unknown" ? "?" : keyboardLayout.toUpperCase();
  warning.classList.toggle("hidden", keyboardLayout !== "en");
}

function setKeyboardLayout(layout) {
  if (keyboardLayout === layout) return;
  keyboardLayout = layout;
  renderLayoutStatus();
}

function renderTrainer() {
  const text = document.querySelector("#typing-text");
  text.innerHTML = [...activeLevel.text]
    .map((character, index) => {
      let className = "";
      if (index < position) className = "done";
      if (index === position)
        className = wrongFlash ? "current wrong" : "current";
      return `<span class="${className}">${character === " " ? "&nbsp;" : character}</span>`;
    })
    .join("");

  const accuracy = attempts
    ? Math.round(((attempts - mistakes) / attempts) * 100)
    : 100;
  document.querySelector("#accuracy").textContent = `${accuracy}%`;
  const nextCharacter = activeLevel.text[position];
  document.querySelector("#finger-hint").textContent =
    FINGERS[nextCharacter] || "Печатай дальше";
  document.querySelectorAll(".key").forEach((key) => {
    const isActive = key.dataset.key === nextCharacter;
    key.classList.toggle("active", isActive);
    key.setAttribute("aria-pressed", String(isActive));
  });
}

function createKey(character) {
  const key = document.createElement("button");
  key.className = `key ${FINGER_COLOR_CLASSES[character]}${character === "а" || character === "о" ? " home" : ""}`;
  key.type = "button";
  key.dataset.key = character;
  key.textContent = character.toUpperCase();
  key.setAttribute(
    "aria-label",
    /^\d$/.test(character)
      ? `Цифра ${character}`
      : `Буква ${character.toUpperCase()}`,
  );
  key.addEventListener("click", () => processInput(character));
  return key;
}

function clearGuideReach() {
  document.querySelectorAll(".guide-key.reached").forEach((key) => key.classList.remove("reached"));
  document.querySelectorAll("[data-finger].reaching").forEach((finger) => {
    finger.classList.remove("reaching");
  });
  document.querySelectorAll(".guide-hand.active").forEach((hand) => hand.classList.remove("active"));
  document.querySelector("#guide-finger-status").innerHTML =
    "<span>Исходное положение</span><strong>Указательные пальцы находят насечки А и О, большие пальцы ждут над пробелом</strong>";
}

function showGuideReach(key, character) {
  clearGuideReach();
  key.classList.add("reached");
  const fingerId = FINGER_IDS[character];
  const fingers = [...document.querySelectorAll(`[data-finger="${fingerId}"]`)];

  fingers.forEach((finger) => {
    finger.classList.add("reaching");
    finger.setAttribute("aria-label", finger.dataset.name);
    finger.closest(".guide-hand").classList.add("active");
  });

  const label = character === " " ? "ПРОБЕЛ" : character.toUpperCase();
  document.querySelector("#guide-finger-status").innerHTML =
    `<span>Клавиша ${label}</span><strong>${FINGERS[character]}</strong>`;
}

function renderGuideKeyboard() {
  const keyboard = document.querySelector("#guide-keyboard");
  keyboard.innerHTML = "";
  KEYBOARD_ROWS.forEach((row, rowIndex) => {
    const rowElement = document.createElement("div");
    rowElement.className = `guide-key-row guide-row-${rowIndex + 1}`;
    row.forEach((character) => {
      const key = document.createElement("button");
      key.className = `guide-key ${FINGER_COLOR_CLASSES[character]}${character === "а" || character === "о" ? " guide-home-key" : ""}`;
      key.type = "button";
      key.dataset.key = character;
      key.textContent = character.toUpperCase();
      key.addEventListener("mouseenter", () => showGuideReach(key, character));
      key.addEventListener("focus", () => showGuideReach(key, character));
      rowElement.append(key);
    });
    keyboard.append(rowElement);
  });

  const space = document.createElement("button");
  space.className = `guide-key guide-space ${FINGER_COLOR_CLASSES[" "]}`;
  space.type = "button";
  space.dataset.key = " ";
  space.textContent = "ПРОБЕЛ";
  space.addEventListener("mouseenter", () => showGuideReach(space, " "));
  space.addEventListener("focus", () => showGuideReach(space, " "));
  keyboard.append(space);
  keyboard.addEventListener("mouseleave", clearGuideReach);
  keyboard.addEventListener("focusout", (event) => {
    if (!keyboard.contains(event.relatedTarget)) clearGuideReach();
  });
}

function renderKeyboard() {
  const keyboard = document.querySelector("#keyboard");
  keyboard.innerHTML = "";
  KEYBOARD_ROWS.forEach((row, index) => {
    const rowElement = document.createElement("div");
    rowElement.className = `keyboard-row row-${index + 1}`;
    row.forEach((character) => rowElement.append(createKey(character)));
    keyboard.append(rowElement);
  });

  const space = document.createElement("button");
  space.className = `key space-key ${FINGER_COLOR_CLASSES[" "]}`;
  space.type = "button";
  space.dataset.key = " ";
  space.innerHTML = '<span aria-hidden="true">▭</span><strong>ПРОБЕЛ</strong>';
  space.setAttribute("aria-label", "Пробел");
  space.addEventListener("click", () => processInput(" "));
  keyboard.append(space);
}

function nextAfterActive() {
  const courseIndex = courses.indexOf(activeCourse);
  const levelIndex = activeCourse.levels.indexOf(activeLevel);
  if (levelIndex < activeCourse.levels.length - 1) {
    return { course: activeCourse, level: activeCourse.levels[levelIndex + 1] };
  }
  const nextCourse = courses[courseIndex + 1];
  return nextCourse
    ? { course: nextCourse, level: nextCourse.levels[0] }
    : null;
}

function focusResultAction(action = "next") {
  document
    .querySelector(action === "retry" ? "#retry-button" : "#next-button")
    .focus();
}

function finishLevel() {
  const accuracy = Math.round(((attempts - mistakes) / attempts) * 100);
  const stars = accuracy >= 95 ? 3 : accuracy >= 80 ? 2 : 1;
  const key = levelKey(activeCourse.id, activeLevel.id);
  progress.stars[key] = Math.max(progress.stars[key] || 0, stars);
  persistProgress(progress);
  mergeServerProgress(progress.stars).catch(() => {});
  renderMap();

  document.querySelector("#result-stars").textContent =
    `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`;
  document.querySelector("#result-title").textContent =
    stars === 3 ? "Великолепно!" : "Занятие готово!";
  document.querySelector("#result-copy").textContent =
    `Точность ${accuracy}%. ${mistakes ? "Ошибки помогли пальцам запомнить дорогу." : "Ни одной ошибки — вот это сосредоточенность!"}`;
  document.querySelector("#next-button").textContent = nextAfterActive()
    ? "Следующее занятие"
    : "К карте курсов";
  showScreen("result");
  focusResultAction();
}

function processInput(typed) {
  if (
    screens.trainer.classList.contains("hidden") ||
    !activeLevel ||
    !TRAINABLE_CHARACTERS.has(typed)
  )
    return;
  const expected = activeLevel.text[position];
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
    message.textContent = `Почти! Сейчас нужна клавиша «${expected === " " ? "пробел" : expected.toUpperCase()}»`;
    message.className = "message try";
  }
  renderTrainer();
}

function shouldIgnoreTrainingKeydown(event) {
  const editableSelector = "input, textarea, select, [contenteditable='true']";
  return Boolean(
    document.querySelector("#account-dialog")?.open ||
    event.target?.closest?.(editableSelector),
  );
}

function handleKeydown(event) {
  if (shouldIgnoreTrainingKeydown(event)) return;
  if (event.ctrlKey || event.altKey || event.metaKey) return;

  if (!screens.result.classList.contains("hidden")) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      focusResultAction(event.key === "ArrowLeft" ? "retry" : "next");
    }
    return;
  }

  if (
    screens.trainer.classList.contains("hidden") ||
    !activeLevel
  )
    return;

  const typed = event.key.toLowerCase();
  if (activeLayout.isLetter(event.key)) {
    setKeyboardLayout("ru");
  } else if (
    /^[a-z]$/i.test(event.key) ||
    (PHYSICAL_LETTER_CODES.has(event.code) && !TRAINABLE_CHARACTERS.has(typed))
  ) {
    event.preventDefault();
    setKeyboardLayout("en");
    const message = document.querySelector("#message");
    message.textContent = "Сначала переключим клавиатуру на русский язык";
    message.className = "message layout-help";
    return;
  }

  if (!TRAINABLE_CHARACTERS.has(typed)) return;
  event.preventDefault();
  processInput(typed);
}

document
  .querySelector("#home-button")
  .addEventListener("click", () => showScreen("map"));
document
  .querySelector("#guide-button")
  .addEventListener("click", () => {
    renderGuideKeyboard();
    showScreen("guide");
  });
document
  .querySelector("#guide-back-button")
  .addEventListener("click", () => showScreen("map"));
document
  .querySelector("#profile-back-button")
  .addEventListener("click", () => showScreen("map"));
document.querySelector("#guide-start-button").addEventListener("click", () => {
  const next = findNextLevel();
  if (next?.level) startLevel(next.course.id, next.level.id);
});
document
  .querySelector("#back-button")
  .addEventListener("click", () => showScreen("map"));
document.querySelector("#continue-button").addEventListener("click", () => {
  const next = findNextLevel();
  if (next?.level) startLevel(next.course.id, next.level.id);
});
document
  .querySelector("#retry-button")
  .addEventListener("click", () => startLevel(activeCourse.id, activeLevel.id));
document.querySelector("#next-button").addEventListener("click", () => {
  const next = nextAfterActive();
  if (next) startLevel(next.course.id, next.level.id);
  else showScreen("map");
});
document.addEventListener("keydown", handleKeydown);

fetch("/api/courses")
  .then((response) => {
    if (!response.ok) throw new Error("Не удалось загрузить курсы");
    return response.json();
  })
  .then((data) => {
    courses = data;
    renderMap();
  })
  .catch(() => {
    document.querySelector("#courses-container").innerHTML =
      "<p>Не получилось загрузить курсы. Попробуй обновить страницу.</p>";
  });

initializeAccount({
  onAuthenticated: async () => {
    const serverProgress = await mergeServerProgress(progress.stars);
    if (!serverProgress) return;
    progress = normalizeProgress({
      courseVersion: progress.courseVersion,
      stars: serverProgress.stars,
    });
    persistProgress(progress);
    if (courses.length) renderMap();
  },
  onLoggedOut: () => {
    if (courses.length) renderMap();
    showScreen("map");
  },
  onOpenProfile: () => showScreen("profile"),
  onProgressReset: () => {
    progress = normalizeProgress({ stars: {} });
    persistProgress(progress);
    if (courses.length) renderMap();
  },
});
