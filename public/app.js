import {
  fetchLeaderboard,
  initializeAccount,
  isAuthenticated,
  mergeServerProgress,
  openAccountDialog,
  recordTypingSession,
} from "./account.js";
import { russianLayout } from "./keyboard-layouts.js";
import {
  addPendingSession,
  clearPendingSessions,
  clearProgress,
  levelKey,
  loadPendingSessions,
  loadProgress,
  normalizeProgress,
  savePendingSessions,
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
  leaderboard: document.querySelector("#leaderboard-screen"),
  challenge: document.querySelector("#challenge-screen"),
  challengeTrainer: document.querySelector("#challenge-trainer-screen"),
  challengeResult: document.querySelector("#challenge-result-screen"),
  profile: document.querySelector("#profile-screen"),
  trainer: document.querySelector("#trainer-screen"),
  result: document.querySelector("#result-screen"),
};
const RESTORABLE_SCREENS = new Set(["map", "guide", "leaderboard", "challenge", "profile"]);

let courses = [];
let challenges = [];
let coursesReady = false;
let accountReady = false;
let initialScreenRestored = false;
let activeCourse = null;
let activeLevel = null;
let activeChallenge = null;
let challengePosition = 0;
let challengeAttempts = 0;
let challengeMistakes = 0;
let challengeStartedAt = 0;
let challengeTimerId = null;
let challengeWrongFlash = false;
let challengeKeyboardLayout = "unknown";
let position = 0;
let attempts = 0;
let mistakes = 0;
let wrongFlash = false;
let keyboardLayout = "unknown";
let levelStartedAt = 0;
let lessonTimerId = null;
let progress = loadProgress();

function updateScreenHash(name) {
  if (!RESTORABLE_SCREENS.has(name)) return;
  const nextHash = name === "map" ? "" : `#${name}`;
  if (window.location.hash === nextHash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
}

function showScreen(name, options = {}) {
  if (name !== "trainer") stopLessonTimer();
  if (name !== "challengeTrainer") stopChallengeTimer();
  Object.entries(screens).forEach(([key, screen]) =>
    screen.classList.toggle("hidden", key !== name),
  );
  if (options.persist !== false) updateScreenHash(name);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initialScreenName() {
  const screenName = window.location.hash.replace("#", "");
  return RESTORABLE_SCREENS.has(screenName) ? screenName : "map";
}

function restoreInitialScreen() {
  if (initialScreenRestored) return;
  initialScreenRestored = true;
  const screenName = initialScreenName();
  if (screenName === "guide") renderGuideKeyboard();
  if (screenName === "leaderboard") renderLeaderboard();
  if (screenName === "challenge") {
    showChallengeScreen({ persist: false });
    return;
  }
  showScreen(screenName, { persist: false });
}

function tryRestoreInitialScreen() {
  if (coursesReady && accountReady) restoreInitialScreen();
}

function showChallengeScreen(options = {}) {
  if (!isAuthenticated()) {
    showScreen("map");
    openAccountDialog();
    return;
  }
  renderChallenges();
  showScreen("challenge", options);
}

function formatTimer(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function lessonElapsedSeconds() {
  return Math.max(0, Math.floor((Date.now() - levelStartedAt) / 1000));
}

function renderLessonTimer() {
  document.querySelector("#lesson-timer").textContent = formatTimer(lessonElapsedSeconds());
}

function stopLessonTimer() {
  if (!lessonTimerId) return;
  clearInterval(lessonTimerId);
  lessonTimerId = null;
}

function stopChallengeTimer() {
  if (!challengeTimerId) return;
  clearInterval(challengeTimerId);
  challengeTimerId = null;
}

function startLessonTimer() {
  stopLessonTimer();
  renderLessonTimer();
  lessonTimerId = setInterval(renderLessonTimer, 1000);
}

function challengeElapsedSeconds() {
  return Math.max(0, Math.floor((Date.now() - challengeStartedAt) / 1000));
}

function renderChallengeTimer() {
  document.querySelector("#challenge-timer").textContent = formatTimer(challengeElapsedSeconds());
}

function startChallengeTimer() {
  stopChallengeTimer();
  renderChallengeTimer();
  challengeTimerId = setInterval(renderChallengeTimer, 1000);
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
  levelStartedAt = Date.now();
  startLessonTimer();
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

function renderChallengeLayoutStatus() {
  const status = document.querySelector("#challenge-layout-status");
  const value = document.querySelector("#challenge-layout-value");
  const warning = document.querySelector("#challenge-layout-warning");
  status.className = `layout-status ${challengeKeyboardLayout}`;
  value.textContent =
    challengeKeyboardLayout === "unknown" ? "?" : challengeKeyboardLayout.toUpperCase();
  warning.classList.toggle("hidden", challengeKeyboardLayout !== "en");
}

function setKeyboardLayout(layout) {
  if (keyboardLayout === layout) return;
  keyboardLayout = layout;
  renderLayoutStatus();
}

function setChallengeKeyboardLayout(layout) {
  if (challengeKeyboardLayout === layout) return;
  challengeKeyboardLayout = layout;
  renderChallengeLayoutStatus();
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

function createChallengeKey(character) {
  const key = document.createElement("button");
  key.className = `key challenge-key ${FINGER_COLOR_CLASSES[character]}${character === "а" || character === "о" ? " home" : ""}`;
  key.type = "button";
  key.dataset.key = character;
  key.textContent = character.toUpperCase();
  key.setAttribute("aria-label", character === " " ? "Пробел" : `Клавиша ${character.toUpperCase()}`);
  key.addEventListener("click", () => processChallengeInput(character));
  return key;
}

function renderChallengeKeyboard() {
  const keyboard = document.querySelector("#challenge-keyboard");
  keyboard.innerHTML = "";
  KEYBOARD_ROWS.forEach((row, index) => {
    const rowElement = document.createElement("div");
    rowElement.className = `keyboard-row row-${index + 1}`;
    row.forEach((character) => rowElement.append(createChallengeKey(character)));
    keyboard.append(rowElement);
  });

  const space = document.createElement("button");
  space.className = `key challenge-key space-key ${FINGER_COLOR_CLASSES[" "]}`;
  space.type = "button";
  space.dataset.key = " ";
  space.innerHTML = '<span aria-hidden="true">▭</span><strong>ПРОБЕЛ</strong>';
  space.setAttribute("aria-label", "Пробел");
  space.addEventListener("click", () => processChallengeInput(" "));
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
  const durationSeconds = Math.max(1, lessonElapsedSeconds());
  stopLessonTimer();
  const key = levelKey(activeCourse.id, activeLevel.id);
  const session = {
    courseId: activeCourse.id,
    levelId: activeLevel.id,
    stars,
    accuracy,
    attempts,
    mistakes,
    durationSeconds,
  };
  progress.stars[key] = Math.max(progress.stars[key] || 0, stars);
  persistProgress(progress);
  mergeServerProgress(progress.stars).catch(() => {});
  recordTypingSession(session)
    .then((result) => {
      if (!result) addPendingSession(session);
    })
    .catch(() => addPendingSession(session));
  renderMap();

  document.querySelector("#result-stars").textContent =
    `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`;
  document.querySelector("#result-title").textContent =
    stars === 3 ? "Великолепно!" : "Занятие готово!";
  document.querySelector("#result-copy").textContent =
    `Точность ${accuracy}%, время ${formatTimer(durationSeconds)}. ${mistakes ? "Ошибки помогли пальцам запомнить дорогу." : "Ни одной ошибки — вот это сосредоточенность!"}`;
  document.querySelector("#next-button").textContent = nextAfterActive()
    ? "Следующее занятие"
    : "К карте курсов";
  showScreen("result");
  focusResultAction();
}

function formatPracticeTime(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const rest = totalSeconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function renderChallenges() {
  const list = document.querySelector("#challenge-list");
  list.innerHTML = "";
  if (!challenges.length) {
    list.innerHTML = '<p class="leaderboard-empty">Загружаем тексты челленджа…</p>';
    return;
  }

  const groups = [...new Set(challenges.map((challenge) => challenge.difficulty))];
  groups.forEach((difficulty) => {
    const section = document.createElement("section");
    section.className = "challenge-group";
    section.innerHTML = `
      <div class="section-heading challenge-group-heading">
        <div>
          <p class="eyebrow">Сложность</p>
          <h2>${difficulty}</h2>
        </div>
      </div>
      <div class="challenge-grid"></div>
    `;

    const grid = section.querySelector(".challenge-grid");
    challenges
      .filter((challenge) => challenge.difficulty === difficulty)
      .forEach((challenge) => {
        const button = document.createElement("button");
        button.className = "challenge-card";
        button.type = "button";
        button.innerHTML = `
          <span>${challenge.text.length} символов</span>
          <h3>${challenge.title}</h3>
          <p>${challenge.description}</p>
        `;
        button.addEventListener("click", () => startChallenge(challenge.id));
        grid.append(button);
      });
    list.append(section);
  });
}

function startChallenge(challengeId) {
  activeChallenge = challenges.find((challenge) => challenge.id === challengeId);
  if (!activeChallenge) return;

  challengePosition = 0;
  challengeAttempts = 0;
  challengeMistakes = 0;
  challengeWrongFlash = false;
  challengeKeyboardLayout = "unknown";
  challengeStartedAt = Date.now();
  document.querySelector("#challenge-difficulty").textContent = activeChallenge.difficulty;
  document.querySelector("#challenge-title").textContent = activeChallenge.title;
  document.querySelector("#challenge-description").textContent = activeChallenge.description;
  document.querySelector("#challenge-message").textContent = "Печатай текст по порядку";
  document.querySelector("#challenge-message").className = "message";
  renderChallengeLayoutStatus();
  renderChallengeKeyboard();
  renderChallengeTrainer();
  startChallengeTimer();
  showScreen("challengeTrainer");
}

function renderChallengeTrainer() {
  const text = document.querySelector("#challenge-text");
  text.innerHTML = [...activeChallenge.text]
    .map((character, index) => {
      let className = "";
      if (index < challengePosition) className = "done";
      if (index === challengePosition)
        className = challengeWrongFlash ? "current wrong" : "current";
      return `<span class="${className}">${character === " " ? "&nbsp;" : character}</span>`;
    })
    .join("");
  text.querySelector(".current")?.scrollIntoView({ block: "center" });

  const accuracy = challengeAttempts
    ? Math.round(((challengeAttempts - challengeMistakes) / challengeAttempts) * 100)
    : 100;
  document.querySelector("#challenge-accuracy").textContent = `${accuracy}%`;
  const nextCharacter = activeChallenge.text[challengePosition];
  document.querySelectorAll(".challenge-key").forEach((key) => {
    const isActive = key.dataset.key === nextCharacter;
    key.classList.toggle("active", isActive);
    key.setAttribute("aria-pressed", String(isActive));
  });
}

function finishChallenge() {
  const accuracy = Math.round(((challengeAttempts - challengeMistakes) / challengeAttempts) * 100);
  const durationSeconds = Math.max(1, challengeElapsedSeconds());
  const charsPerMinute = Math.round((activeChallenge.text.length / durationSeconds) * 60);
  stopChallengeTimer();

  document.querySelector("#challenge-result-title").textContent =
    accuracy >= 95 ? "Очень ровно!" : "Челлендж завершён!";
  document.querySelector("#challenge-result-copy").textContent =
    `Точность ${accuracy}%, время ${formatTimer(durationSeconds)}, скорость ${charsPerMinute} символов в минуту.`;
  showScreen("challengeResult");
  document.querySelector("#challenge-list-button").focus();
}

function processChallengeInput(typed) {
  if (
    screens.challengeTrainer.classList.contains("hidden") ||
    !activeChallenge ||
    !TRAINABLE_CHARACTERS.has(typed)
  )
    return;

  const expected = activeChallenge.text[challengePosition];
  challengeAttempts += 1;
  const message = document.querySelector("#challenge-message");

  if (typed === expected) {
    challengePosition += 1;
    challengeWrongFlash = false;
    message.textContent = "Получилось! Продолжай";
    message.className = "message good";
    if (challengePosition === activeChallenge.text.length) {
      finishChallenge();
      return;
    }
  } else {
    challengeMistakes += 1;
    challengeWrongFlash = true;
    message.textContent = `Сейчас нужна клавиша «${expected === " " ? "пробел" : expected.toUpperCase()}»`;
    message.className = "message try";
  }

  renderChallengeTrainer();
}

function createLeaderboardRow(participant) {
  const row = document.createElement("article");
  row.className = "leaderboard-row";

  const rank = document.createElement("strong");
  rank.className = "leaderboard-rank";
  rank.textContent = `#${participant.rank}`;

  const name = document.createElement("div");
  name.className = "leaderboard-name";
  const title = document.createElement("h3");
  title.textContent = participant.displayName;
  const caption = document.createElement("p");
  caption.textContent = `В практике ${formatPracticeTime(participant.practiceSeconds)}`;
  name.append(title, caption);

  const completed = document.createElement("span");
  completed.innerHTML = "<small>занятий</small>";
  completed.append(String(participant.completedLessons));

  const rewards = document.createElement("span");
  rewards.innerHTML = "<small>звёзд</small>";
  rewards.append(String(participant.rewards));

  const accuracy = document.createElement("span");
  accuracy.innerHTML = "<small>точность</small>";
  accuracy.append(`${participant.averageAccuracy}%`);

  const score = document.createElement("span");
  score.className = "leaderboard-score";
  score.innerHTML = "<small>очки</small>";
  score.append(String(participant.score));

  row.append(rank, name, completed, rewards, accuracy, score);
  return row;
}

async function renderLeaderboard() {
  const list = document.querySelector("#leaderboard-list");
  const guestPanel = document.querySelector("#leaderboard-guest-panel");
  const guestMessage = document.querySelector("#leaderboard-guest-message");
  const guest = !isAuthenticated();
  const pendingSessions = loadPendingSessions();

  guestPanel.classList.toggle("hidden", !guest);
  if (guest) {
    guestMessage.textContent = pendingSessions.length
      ? "Твои гостевые результаты ждут входа, чтобы попасть в рейтинг."
      : "Войди, чтобы попасть в рейтинг и видеть полный список участников.";
  }

  list.innerHTML = '<p class="leaderboard-empty">Загружаем рейтинг…</p>';

  try {
    const data = await fetchLeaderboard(guest ? 5 : undefined);
    list.innerHTML = "";
    if (!data.participants.length) {
      list.innerHTML =
        '<p class="leaderboard-empty">Пока рейтинг пуст. Первые участники появятся после занятий из аккаунта.</p>';
      return;
    }
    data.participants.forEach((participant) => {
      list.append(createLeaderboardRow(participant));
    });
  } catch {
    list.innerHTML =
      '<p class="leaderboard-empty error">Не получилось загрузить рейтинг. Попробуй обновить страницу чуть позже.</p>';
  }
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

  if (!screens.challengeResult.classList.contains("hidden")) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      document
        .querySelector(event.key === "ArrowLeft" ? "#challenge-retry-button" : "#challenge-list-button")
        .focus();
    }
    return;
  }

  if (!screens.challengeTrainer.classList.contains("hidden") && activeChallenge) {
    const typed = event.key.toLowerCase();
    if (activeLayout.isLetter(event.key)) {
      setChallengeKeyboardLayout("ru");
    } else if (
      /^[a-z]$/i.test(event.key) ||
      (PHYSICAL_LETTER_CODES.has(event.code) && !TRAINABLE_CHARACTERS.has(typed))
    ) {
      event.preventDefault();
      setChallengeKeyboardLayout("en");
      const message = document.querySelector("#challenge-message");
      message.textContent = "Сначала переключим клавиатуру на русский язык";
      message.className = "message layout-help";
      return;
    }
    if (!TRAINABLE_CHARACTERS.has(typed)) return;
    event.preventDefault();
    processChallengeInput(typed);
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
document.querySelector("#challenge-button").addEventListener("click", () => {
  showChallengeScreen();
});
document
  .querySelector("#challenge-back-button")
  .addEventListener("click", () => showScreen("map"));
document
  .querySelector("#challenge-trainer-back-button")
  .addEventListener("click", () => showScreen("challenge"));
document
  .querySelector("#challenge-retry-button")
  .addEventListener("click", () => startChallenge(activeChallenge.id));
document
  .querySelector("#challenge-list-button")
  .addEventListener("click", () => showScreen("challenge"));
document
  .querySelector("#guide-button")
  .addEventListener("click", () => {
    renderGuideKeyboard();
    showScreen("guide");
  });
document.querySelector("#leaderboard-button").addEventListener("click", () => {
  renderLeaderboard();
  showScreen("leaderboard");
});
document
  .querySelector("#leaderboard-back-button")
  .addEventListener("click", () => showScreen("map"));
document
  .querySelector("#leaderboard-lessons-button")
  .addEventListener("click", () => showScreen("map"));
document
  .querySelector("#leaderboard-refresh-button")
  .addEventListener("click", renderLeaderboard);
document
  .querySelector("#leaderboard-login-button")
  .addEventListener("click", openAccountDialog);
document
  .querySelector("#guide-back-button")
  .addEventListener("click", () => showScreen("map"));
document
  .querySelector("#profile-back-button")
  .addEventListener("click", () => showScreen("map"));
document
  .querySelector("#guide-start-button")
  .addEventListener("click", () => showScreen("map"));
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
    coursesReady = true;
    renderMap();
    tryRestoreInitialScreen();
  })
  .catch(() => {
    document.querySelector("#courses-container").innerHTML =
      "<p>Не получилось загрузить курсы. Попробуй обновить страницу.</p>";
  });

fetch("/api/challenges")
  .then((response) => {
    if (!response.ok) throw new Error("Не удалось загрузить челленджи");
    return response.json();
  })
  .then((data) => {
    challenges = data;
    if (!screens.challenge.classList.contains("hidden")) renderChallenges();
  })
  .catch(() => {
    document.querySelector("#challenge-list").innerHTML =
      "<p>Не получилось загрузить тексты. Попробуй обновить страницу.</p>";
  });

async function syncPendingSessions() {
  const sessions = loadPendingSessions();
  if (!sessions.length) return;

  const unsyncedSessions = [];
  for (const session of sessions) {
    try {
      const result = await recordTypingSession(session);
      if (!result) unsyncedSessions.push(session);
    } catch {
      unsyncedSessions.push(session);
    }
  }

  if (unsyncedSessions.length) savePendingSessions(unsyncedSessions);
  else clearPendingSessions();
}

initializeAccount({
  onAuthenticated: async () => {
    const serverProgress = await mergeServerProgress(progress.stars);
    await syncPendingSessions();
    if (!serverProgress) return;
    progress = normalizeProgress({
      courseVersion: progress.courseVersion,
      stars: serverProgress.stars,
    });
    persistProgress(progress);
    if (courses.length) renderMap();
    if (!screens.leaderboard.classList.contains("hidden")) renderLeaderboard();
  },
  onLoggedOut: () => {
    progress = normalizeProgress({ stars: {} });
    clearProgress();
    clearPendingSessions();
    if (courses.length) renderMap();
    showScreen("map");
  },
  onOpenProfile: () => showScreen("profile"),
  onProgressReset: () => {
    progress = normalizeProgress({ stars: {} });
    persistProgress(progress);
    clearPendingSessions();
    if (courses.length) renderMap();
  },
  onReady: () => {
    accountReady = true;
    tryRestoreInitialScreen();
  },
});
