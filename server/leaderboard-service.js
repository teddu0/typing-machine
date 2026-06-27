import { randomUUID } from "node:crypto";
import { courses } from "../data/courses.js";
import { query } from "./db.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_DURATION_SECONDS = 24 * 60 * 60;
const validLevels = new Set(
  courses.flatMap((course) => course.levels.map((level) => `${course.id}:${level.id}`)),
);
const leaderboardQuery = `WITH participant_ids AS (
       SELECT user_id FROM progress
       UNION
       SELECT user_id FROM typing_sessions
     ),
     progress_stats AS (
       SELECT
         user_id,
         COUNT(*)::int AS completed_lessons,
         SUM(stars)::int AS rewards,
         MAX(updated_at) AS last_progress_at
       FROM progress
       GROUP BY user_id
     ),
     session_stats AS (
       SELECT
         user_id,
         COUNT(DISTINCT course_id || ':' || level_id)::int AS completed_lessons,
         SUM(stars)::int AS rewards,
         ROUND(AVG(typing_sessions.accuracy))::int AS average_accuracy,
         SUM(typing_sessions.duration_seconds)::int AS practice_seconds,
         MAX(typing_sessions.completed_at) AS last_completed_at
       FROM typing_sessions
       GROUP BY user_id
     ),
     stats AS (
       SELECT
         users.id,
         COALESCE(NULLIF(btrim(users.display_name), ''), users.email) AS leaderboard_name,
         COALESCE(progress_stats.completed_lessons, session_stats.completed_lessons, 0)::int AS completed_lessons,
         COALESCE(progress_stats.rewards, session_stats.rewards, 0)::int AS rewards,
         COALESCE(session_stats.average_accuracy, 0)::int AS average_accuracy,
         COALESCE(session_stats.practice_seconds, 0)::int AS practice_seconds,
         COALESCE(session_stats.last_completed_at, progress_stats.last_progress_at) AS last_completed_at
       FROM participant_ids
       JOIN users ON users.id = participant_ids.user_id
       LEFT JOIN progress_stats ON progress_stats.user_id = users.id
       LEFT JOIN session_stats ON session_stats.user_id = users.id
     ),
     ranked AS (
       SELECT
         id,
         leaderboard_name,
         completed_lessons,
         rewards,
         average_accuracy,
         practice_seconds,
         last_completed_at,
         (completed_lessons * 10 + rewards * 3 + FLOOR(practice_seconds / 60))::int AS score,
         ROW_NUMBER() OVER (
           ORDER BY
             (completed_lessons * 10 + rewards * 3 + FLOOR(practice_seconds / 60)) DESC,
             completed_lessons DESC,
             rewards DESC,
             average_accuracy DESC,
             last_completed_at ASC
         )::int AS rank
       FROM stats
     )
     SELECT *
     FROM ranked
     ORDER BY rank
     LIMIT $1`;

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
  if (value === null || value === undefined || value === "") return DEFAULT_LIMIT;
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
  const result = await query(leaderboardQuery, [limit]);

  return {
    participants: result.rows.map((row) => ({
      rank: row.rank,
      id: row.id,
      displayName: row.leaderboard_name,
      completedLessons: row.completed_lessons,
      rewards: row.rewards,
      averageAccuracy: row.average_accuracy,
      practiceSeconds: row.practice_seconds,
      score: row.score,
      lastCompletedAt: row.last_completed_at,
    })),
  };
}

export {
  getLeaderboard,
  leaderboardQuery,
  normalizeLimit,
  normalizeTypingSession,
  recordTypingSession,
};
