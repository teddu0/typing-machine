function readInteger(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readRequired(name, fallback) {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "test" && fallback) return fallback;
  throw new Error(`Не задана обязательная переменная окружения ${name}`);
}

const config = {
  databaseUrl: readRequired("DATABASE_URL", "postgres://test:test@localhost:5432/test"),
  nodeEnv: process.env.NODE_ENV || "development",
  port: readInteger("PORT", 3000),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "klavishki_session",
  sessionDays: readInteger("SESSION_DAYS", 30),
};

export { config };
