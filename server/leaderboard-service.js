import { createHash, randomUUID } from "node:crypto";
import { challenges } from "../data/challenges.js";
import { courses } from "../data/courses.js";
import { query } from "./db.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_DURATION_SECONDS = 24 * 60 * 60;
const validLevels = new Set(
  courses.flatMap((course) => course.levels.map((level) => `${course.id}:${level.id}`)),
);
const challengesById = new Map(challenges.map((challenge) => [challenge.id, challenge]));
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

const challengeLeaderboardQuery = `WITH best_results AS (
       SELECT DISTINCT ON (challenge_results.user_id)
         challenge_results.id,
         challenge_results.user_id,
         challenge_results.challenge_id,
         challenge_results.challenge_title,
         challenge_results.difficulty,
         challenge_results.accuracy,
         challenge_results.duration_seconds,
         challenge_results.chars_per_minute,
         challenge_results.mistakes,
         challenge_results.characters_count,
         challenge_results.completed_at
       FROM challenge_results
       WHERE challenge_results.challenge_id = $1
       ORDER BY
         challenge_results.user_id,
         challenge_results.accuracy DESC,
         challenge_results.duration_seconds ASC,
         challenge_results.chars_per_minute DESC,
         challenge_results.mistakes ASC,
         challenge_results.completed_at ASC
     ),
     ranked AS (
       SELECT
         best_results.id,
         best_results.user_id,
         COALESCE(NULLIF(btrim(users.display_name), ''), users.email) AS leaderboard_name,
         best_results.challenge_id,
         best_results.challenge_title,
         best_results.difficulty,
         best_results.accuracy,
         best_results.duration_seconds,
         best_results.chars_per_minute,
         best_results.mistakes,
         best_results.characters_count,
         best_results.completed_at,
         ROW_NUMBER() OVER (
           ORDER BY
             best_results.accuracy DESC,
             best_results.duration_seconds ASC,
             best_results.chars_per_minute DESC,
             best_results.mistakes ASC,
             best_results.completed_at ASC
         )::int AS rank
       FROM best_results
       JOIN users ON users.id = best_results.user_id
     )
     SELECT *
     FROM ranked
     ORDER BY rank
     LIMIT $2`;

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

function challengeTextHash(challenge) {
  return createHash("sha256").update(challenge.text).digest("hex");
}

function normalizeChallengeResult(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const error = new Error("Передайте результат челленджа");
    error.status = 400;
    throw error;
  }

  const challengeId = String(body.challengeId || "").trim();
  const challenge = challengesById.get(challengeId);
  if (!challenge) {
    const error = new Error("Неизвестный челлендж");
    error.status = 400;
    throw error;
  }

  const attempts = normalizeInteger(body.attempts, 0);
  const mistakes = normalizeInteger(body.mistakes, 0);
  if (attempts <= 0 || mistakes < 0 || mistakes > attempts) {
    const error = new Error("Некорректная статистика челленджа");
    error.status = 400;
    throw error;
  }

  const durationSeconds = clamp(normalizeInteger(body.durationSeconds, 1), 1, MAX_DURATION_SECONDS);
  const accuracy = clamp(normalizeInteger(body.accuracy, 0), 0, 100);
  const charactersCount = challenge.text.length;
  const charsPerMinute = clamp(
    normalizeInteger(body.charsPerMinute, Math.round((charactersCount / durationSeconds) * 60)),
    0,
    10000,
  );

  return {
    challengeId,
    challengeTitle: challenge.title,
    difficulty: challenge.difficulty,
    textHash: challengeTextHash(challenge),
    charactersCount,
    accuracy,
    attempts,
    mistakes,
    durationSeconds,
    charsPerMinute,
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

async function recordChallengeResult(userId, body) {
  const result = normalizeChallengeResult(body);
  await query(
    `INSERT INTO challenge_results
       (id, user_id, challenge_id, challenge_title, difficulty, text_hash, characters_count,
        accuracy, attempts, mistakes, duration_seconds, chars_per_minute)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      randomUUID(),
      userId,
      result.challengeId,
      result.challengeTitle,
      result.difficulty,
      result.textHash,
      result.charactersCount,
      result.accuracy,
      result.attempts,
      result.mistakes,
      result.durationSeconds,
      result.charsPerMinute,
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

async function getChallengeLeaderboard(challengeIdValue, limitValue) {
  const challengeId = String(challengeIdValue || "").trim();
  const challenge = challengesById.get(challengeId);
  if (!challenge) {
    const error = new Error("Неизвестный челлендж");
    error.status = 400;
    throw error;
  }

  const limit = normalizeLimit(limitValue);
  const result = await query(challengeLeaderboardQuery, [challengeId, limit]);

  return {
    challenge: {
      id: challenge.id,
      title: challenge.title,
      difficulty: challenge.difficulty,
      textLength: challenge.text.length,
    },
    participants: result.rows.map((row) => ({
      rank: row.rank,
      id: row.user_id,
      displayName: row.leaderboard_name,
      challengeId: row.challenge_id,
      challengeTitle: row.challenge_title,
      difficulty: row.difficulty,
      accuracy: row.accuracy,
      durationSeconds: row.duration_seconds,
      charsPerMinute: row.chars_per_minute,
      mistakes: row.mistakes,
      charactersCount: row.characters_count,
      completedAt: row.completed_at,
    })),
  };
}

export {
  challengeLeaderboardQuery,
  getChallengeLeaderboard,
  getLeaderboard,
  leaderboardQuery,
  normalizeChallengeResult,
  normalizeLimit,
  normalizeTypingSession,
  recordChallengeResult,
  recordTypingSession,
};
