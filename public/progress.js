const COURSE_VERSION = 4;
const STORAGE_KEY = "klavishki-progress";
const PENDING_SESSIONS_KEY = "klavishki-pending-sessions";

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

function normalizeProgress(savedProgress) {
  const savedStars = savedProgress?.stars;
  const stars =
    savedStars && typeof savedStars === "object" && !Array.isArray(savedStars)
      ? Object.fromEntries(
          Object.entries(savedStars).filter(
            ([key, value]) =>
              typeof key === "string" &&
              Number.isInteger(value) &&
              value >= 1 &&
              value <= 3,
          ),
        )
      : {};
  return { courseVersion: COURSE_VERSION, stars };
}

function loadProgress(storage = globalThis.localStorage) {
  try {
    const savedProgress = JSON.parse(storage.getItem(STORAGE_KEY));
    if (savedProgress?.courseVersion === COURSE_VERSION) {
      return normalizeProgress(savedProgress);
    }
    if (savedProgress?.courseVersion === 3) {
      return normalizeProgress(migrateVersionThreeProgress(savedProgress));
    }
    if (savedProgress?.courseVersion === 2) {
      return normalizeProgress({
        courseVersion: COURSE_VERSION,
        stars: Object.fromEntries(
          Object.entries(savedProgress.stars || {}).map(([id, stars]) => [
            `middle:${id}`,
            stars,
          ]),
        ),
      });
    }
  } catch {
    // Начинаем новый маршрут, если сохранение повреждено.
  }
  return { courseVersion: COURSE_VERSION, stars: {} };
}

function saveProgress(progress, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Приложение продолжает работать, даже если браузер запретил сохранение.
  }
}

function clearProgress(storage = globalThis.localStorage) {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Выход из аккаунта не должен ломаться из-за запрета localStorage.
  }
}

function normalizePendingSession(session) {
  if (!session || typeof session !== "object" || Array.isArray(session)) return null;
  const courseId = typeof session.courseId === "string" ? session.courseId : "";
  const levelId = Number(session.levelId);
  const stars = Number(session.stars);
  const accuracy = Number(session.accuracy);
  const attempts = Number(session.attempts);
  const mistakes = Number(session.mistakes);
  const durationSeconds = Number(session.durationSeconds);

  if (
    !courseId ||
    !Number.isInteger(levelId) ||
    !Number.isInteger(stars) ||
    !Number.isInteger(accuracy) ||
    !Number.isInteger(attempts) ||
    !Number.isInteger(mistakes) ||
    !Number.isInteger(durationSeconds) ||
    stars < 1 ||
    stars > 3 ||
    accuracy < 0 ||
    accuracy > 100 ||
    attempts <= 0 ||
    mistakes < 0 ||
    mistakes > attempts ||
    durationSeconds < 0
  ) {
    return null;
  }

  return { courseId, levelId, stars, accuracy, attempts, mistakes, durationSeconds };
}

function loadPendingSessions(storage = globalThis.localStorage) {
  try {
    const sessions = JSON.parse(storage.getItem(PENDING_SESSIONS_KEY));
    if (!Array.isArray(sessions)) return [];
    return sessions.map(normalizePendingSession).filter(Boolean);
  } catch {
    return [];
  }
}

function savePendingSessions(sessions, storage = globalThis.localStorage) {
  try {
    storage.setItem(
      PENDING_SESSIONS_KEY,
      JSON.stringify(sessions.map(normalizePendingSession).filter(Boolean)),
    );
  } catch {
    // Статистика рейтинга подождёт следующего занятия, если хранилище недоступно.
  }
}

function addPendingSession(session, storage = globalThis.localStorage) {
  const normalizedSession = normalizePendingSession(session);
  if (!normalizedSession) return;
  savePendingSessions([...loadPendingSessions(storage), normalizedSession], storage);
}

function clearPendingSessions(storage = globalThis.localStorage) {
  try {
    storage.removeItem(PENDING_SESSIONS_KEY);
  } catch {
    // Выход из аккаунта не должен ломаться из-за запрета localStorage.
  }
}

export {
  COURSE_VERSION,
  addPendingSession,
  clearPendingSessions,
  clearProgress,
  levelKey,
  loadPendingSessions,
  loadProgress,
  normalizePendingSession,
  normalizeProgress,
  savePendingSessions,
  saveProgress,
};
