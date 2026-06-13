import { config } from "./config.js";
import { query, withTransaction } from "./db.js";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  randomUUID,
  verifyPassword,
} from "./security.js";

const SESSION_SECONDS = config.sessionDays * 24 * 60 * 60;

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name || null,
    birthDate: user.birth_date || null,
    phone: user.phone || null,
  };
}

async function createSession(client, userId) {
  const token = createSessionToken();
  await client.query("DELETE FROM sessions WHERE expires_at <= now()");
  await client.query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + ($4 * interval '1 second'))`,
    [randomUUID(), userId, hashSessionToken(token), SESSION_SECONDS],
  );
  return token;
}

async function register(email, password) {
  return withTransaction(async (client) => {
    const existing = await client.query(
      "SELECT 1 FROM users WHERE lower(email) = lower($1)",
      [email],
    );
    if (existing.rowCount) {
      const error = new Error("Аккаунт с таким email уже существует");
      error.status = 409;
      throw error;
    }

    const userResult = await client.query(
      `INSERT INTO users (id, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, birth_date, phone`,
      [randomUUID(), email, await hashPassword(password)],
    );
    const user = userResult.rows[0];
    return { user: publicUser(user), token: await createSession(client, user.id) };
  });
}

async function login(email, password) {
  const result = await query(
    `SELECT id, email, password_hash, display_name, birth_date, phone
     FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    const error = new Error("Неверный email или пароль");
    error.status = 401;
    throw error;
  }

  return withTransaction(async (client) => ({
    user: publicUser(user),
    token: await createSession(client, user.id),
  }));
}

async function findUserBySessionToken(token) {
  if (!token) return null;
  const result = await query(
    `SELECT users.id, users.email, users.display_name, users.birth_date, users.phone
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`,
    [hashSessionToken(token)],
  );
  return result.rows[0] ? publicUser(result.rows[0]) : null;
}

async function logout(token) {
  if (!token) return;
  await query("DELETE FROM sessions WHERE token_hash = $1", [hashSessionToken(token)]);
}

export { findUserBySessionToken, login, logout, publicUser, register, SESSION_SECONDS };
