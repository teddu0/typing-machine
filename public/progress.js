const COURSE_VERSION = 4;
const STORAGE_KEY = "klavishki-progress";

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

export { COURSE_VERSION, levelKey, loadProgress, normalizeProgress, saveProgress };
