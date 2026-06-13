const attempts = new Map();

function assertRateLimit(key, limit = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > limit) {
    const error = new Error("Слишком много попыток. Попробуйте позже");
    error.status = 429;
    throw error;
  }
}

export { assertRateLimit };
