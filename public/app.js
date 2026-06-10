// Включите для тестирования всех курсов и занятий без прохождения предыдущих.
const isFullAccess = false;

const KEYBOARD_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["й", "ц", "у", "к", "е", "н", "г", "ш", "щ", "з", "х", "ъ"],
  ["ф", "ы", "в", "а", "п", "р", "о", "л", "д", "ж", "э"],
  ["я", "ч", "с", "м", "и", "т", "ь", "б", "ю"],
];
const TRAINABLE_CHARACTERS = new Set([...KEYBOARD_ROWS.flat(), " "]);

const RUSSIAN_KEY_CODES = new Set([
  "Backquote",
  "KeyQ",
  "KeyW",
  "KeyE",
  "KeyR",
  "KeyT",
  "KeyY",
  "KeyU",
  "KeyI",
  "KeyO",
  "KeyP",
  "BracketLeft",
  "BracketRight",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyF",
  "KeyG",
  "KeyH",
  "KeyJ",
  "KeyK",
  "KeyL",
  "Semicolon",
  "Quote",
  "KeyZ",
  "KeyX",
  "KeyC",
  "KeyV",
  "KeyB",
  "KeyN",
  "KeyM",
  "Comma",
  "Period",
]);
const COURSE_VERSION = 4;
const FINGERS = {
  1: "Мизинец левой руки",
  2: "Безымянный палец левой руки",
  3: "Средний палец левой руки",
  4: "Указательный палец левой руки",
  5: "Указательный палец левой руки",
  6: "Указательный палец правой руки",
  7: "Указательный палец правой руки",
  8: "Средний палец правой руки",
  9: "Безымянный палец правой руки",
  0: "Мизинец правой руки",
  й: "Мизинец левой руки",
  ц: "Безымянный палец левой руки",
  у: "Средний палец левой руки",
  к: "Указательный палец левой руки",
  е: "Указательный палец левой руки",
  н: "Указательный палец правой руки",
  г: "Указательный палец правой руки",
  ш: "Средний палец правой руки",
  щ: "Безымянный палец правой руки",
  з: "Мизинец правой руки",
  х: "Мизинец правой руки",
  ъ: "Мизинец правой руки",
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
  я: "Мизинец левой руки",
  ч: "Безымянный палец левой руки",
  с: "Средний палец левой руки",
  м: "Указательный палец левой руки",
  и: "Указательный палец левой руки",
  т: "Указательный палец правой руки",
  ь: "Указательный палец правой руки",
  б: "Средний палец правой руки",
  ю: "Безымянный палец правой руки",
  " ": "Большой палец — пробел",
};

const screens = {
  map: document.querySelector("#map-screen"),
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

function levelKey(courseId, levelId) {
  return `${courseId}:${levelId}`;
}

function migrateVersionThreeProgress(savedProgress) {
  const stars = Object.entries(savedProgress.stars || {}).flatMap(
    ([key, value]) => {
      const [courseId, levelIdText] = key.split(":");
      const levelId = Number(levelIdText);
      if (courseId !== "upper") return [[key, value]];
      if (levelId === 17) return [];
      return [[levelKey(courseId, levelId > 17 ? levelId - 1 : levelId), value]];
    },
  );
  return { courseVersion: COURSE_VERSION, stars: Object.fromEntries(stars) };
}

function loadProgress() {
  try {
    const savedProgress = JSON.parse(
      localStorage.getItem("klavishki-progress"),
    );
    if (savedProgress?.courseVersion === COURSE_VERSION) return savedProgress;
    if (savedProgress?.courseVersion === 3) {
      return migrateVersionThreeProgress(savedProgress);
    }
    if (savedProgress?.courseVersion === 2) {
      return {
        courseVersion: COURSE_VERSION,
        stars: Object.fromEntries(
          Object.entries(savedProgress.stars || {}).map(([id, stars]) => [
            `middle:${id}`,
            stars,
          ]),
        ),
      };
    }
  } catch {
    // Начинаем новый маршрут, если сохранение повреждено.
  }
  return { courseVersion: COURSE_VERSION, stars: {} };
}

function saveProgress() {
  localStorage.setItem("klavishki-progress", JSON.stringify(progress));
}

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
  key.className = `key${character === "а" || character === "о" ? " home" : ""}`;
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
  space.className = "key space-key";
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

function finishLevel() {
  const accuracy = Math.round(((attempts - mistakes) / attempts) * 100);
  const stars = accuracy >= 95 ? 3 : accuracy >= 80 ? 2 : 1;
  const key = levelKey(activeCourse.id, activeLevel.id);
  progress.stars[key] = Math.max(progress.stars[key] || 0, stars);
  saveProgress();
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

function handleKeydown(event) {
  const typed = event.key.toLowerCase();
  if (/^[а-я]$/i.test(event.key)) {
    setKeyboardLayout("ru");
  } else if (
    /^[a-z]$/i.test(event.key) ||
    (RUSSIAN_KEY_CODES.has(event.code) && !TRAINABLE_CHARACTERS.has(typed))
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
