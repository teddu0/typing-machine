function readInteger(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const config = {
  databaseUrl: process.env.DATABASE_URL || "postgres://typing_machine:typing_machine@localhost:5432/typing_machine",
  nodeEnv: process.env.NODE_ENV || "development",
  port: readInteger("PORT", 3000),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "klavishki_session",
  sessionDays: readInteger("SESSION_DAYS", 30),
};

export { config };
