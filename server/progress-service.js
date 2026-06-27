import { courses } from "../data/courses.js";
import { withTransaction } from "./db.js";

const COURSE_VERSION = 4;
const validLevels = new Set(
  courses.flatMap((course) => course.levels.map((level) => `${course.id}:${level.id}`)),
);

function normalizeStars(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, stars]) => validLevels.has(key) && Number.isInteger(stars) && stars >= 1 && stars <= 3,
    ),
  );
}

async function getProgress(userId) {
  return withTransaction(async (client) => {
    const result = await client.query(
      "SELECT course_id, level_id, stars FROM progress WHERE user_id = $1",
      [userId],
    );
    return {
      stars: Object.fromEntries(
        result.rows.map((row) => [`${row.course_id}:${row.level_id}`, row.stars]),
      ),
    };
  });
}

async function mergeProgress(userId, incomingStars) {
  const stars = normalizeStars(incomingStars);
  return withTransaction(async (client) => {
    for (const [key, value] of Object.entries(stars)) {
      const separator = key.lastIndexOf(":");
      const courseId = key.slice(0, separator);
      const levelId = Number(key.slice(separator + 1));
      await client.query(
        `INSERT INTO progress (user_id, course_id, level_id, stars, course_version)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, course_id, level_id)
         DO UPDATE SET
           stars = GREATEST(progress.stars, EXCLUDED.stars),
           course_version = EXCLUDED.course_version,
           updated_at = now()`,
        [userId, courseId, levelId, value, COURSE_VERSION],
      );
    }

    const result = await client.query(
      "SELECT course_id, level_id, stars FROM progress WHERE user_id = $1",
      [userId],
    );
    return {
      stars: Object.fromEntries(
        result.rows.map((row) => [`${row.course_id}:${row.level_id}`, row.stars]),
      ),
    };
  });
}

async function resetProgress(userId) {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM challenge_results WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM typing_sessions WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM progress WHERE user_id = $1", [userId]);
  });
  return { stars: {} };
}

export { getProgress, mergeProgress, normalizeStars, resetProgress };
