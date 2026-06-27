import { randomUUID } from "node:crypto";
import { courses } from "../data/courses.js";
import { query } from "./db.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_DURATION_SECONDS = 24 * 60 * 60;
const validLevels = new Set(
  courses.flatMap((course) => course.levels.map((level) => `${course.id}:${level.id}`)),
);

function normalizeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function clamp(number, min, max) {
  return Math.min(Math.max(number, min), max);
}

function normalizeTypingSession(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const error = new Error("Передайте результат занятия");
    error.status = 400;
    throw error;
  }

  const courseId = String(body.courseId || "").trim();
  const levelId = normalizeInteger(body.levelId, 0);
  if (!validLevels.has(`${courseId}:${levelId}`)) {
    const error = new Error("Неизвестное занятие");
    error.status = 400;
    throw error;
  }

  const attempts = normalizeInteger(body.attempts, 0);
  const mistakes = normalizeInteger(body.mistakes, 0);
  if (attempts <= 0 || mistakes < 0 || mistakes > attempts) {
    const error = new Error("Некорректная статистика занятия");
    error.status = 400;
    throw error;
  }

  return {
    courseId,
    levelId,
    stars: clamp(normalizeInteger(body.stars, 1), 1, 3),
    accuracy: clamp(normalizeInteger(body.accuracy, 0), 0, 100),
    attempts,
    mistakes,
    durationSeconds: clamp(normalizeInteger(body.durationSeconds, 0), 0, MAX_DURATION_SECONDS),
  };
}

function normalizeLimit(value) {
  return clamp(normalizeInteger(value, DEFAULT_LIMIT), 1, MAX_LIMIT);
}

async function recordTypingSession(userId, body) {
  const session = normalizeTypingSession(body);
  await query(
    `INSERT INTO typing_sessions
       (id, user_id, course_id, level_id, stars, accuracy, attempts, mistakes, duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      randomUUID(),
      userId,
      session.courseId,
      session.levelId,
      session.stars,
      session.accuracy,
      session.attempts,
      session.mistakes,
      session.durationSeconds,
    ],
  );
  return { status: "ok" };
}

async function getLeaderboard(limitValue) {
  const limit = normalizeLimit(limitValue);
  const result = await query(
    `WITH stats AS (
       SELECT
         users.id,
         users.display_name,
         COUNT(DISTINCT typing_sessions.course_id || ':' || typing_sessions.level_id)::int AS completed_lessons,
         SUM(typing_sessions.stars)::int AS rewards,
         ROUND(AVG(typing_sessions.accuracy))::int AS average_accuracy,
         SUM(typing_sessions.duration_seconds)::int AS practice_seconds,
         MAX(typing_sessions.completed_at) AS last_completed_at
       FROM users
       JOIN typing_sessions ON typing_sessions.user_id = users.id
       WHERE users.display_name IS NOT NULL AND btrim(users.display_name) <> ''
       GROUP BY users.id, users.display_name
     ),
     ranked AS (
       SELECT
         id,
         display_name,
         completed_lessons,
         rewards,
         average_accuracy,
         practice_seconds,
         last_completed_at,
         (completed_lessons * 10 + rewards * 3) AS score,
         ROW_NUMBER() OVER (
           ORDER BY completed_lessons DESC, rewards DESC, average_accuracy DESC, last_completed_at ASC
         )::int AS rank
       FROM stats
     )
     SELECT *
     FROM ranked
     ORDER BY rank
     LIMIT $1`,
    [limit],
  );

  return {
    participants: result.rows.map((row) => ({
      rank: row.rank,
      id: row.id,
      displayName: row.display_name,
      completedLessons: row.completed_lessons,
      rewards: row.rewards,
      averageAccuracy: row.average_accuracy,
      practiceSeconds: row.practice_seconds,
      score: row.score,
      lastCompletedAt: row.last_completed_at,
    })),
  };
}

export { getLeaderboard, normalizeTypingSession, recordTypingSession };
