import { publicUser } from "./auth-service.js";
import { query, withTransaction } from "./db.js";
import { hashPassword, hashSessionToken, verifyPassword } from "./security.js";

async function updateProfile(userId, profile) {
  const result = await query(
    `UPDATE users
     SET display_name = $2, birth_date = $3, phone = $4, updated_at = now()
     WHERE id = $1
     RETURNING id, email, display_name, birth_date, phone`,
    [userId, profile.displayName, profile.birthDate, profile.phone],
  );
  return publicUser(result.rows[0]);
}

async function changePassword(userId, sessionToken, currentPassword, newPassword) {
  return withTransaction(async (client) => {
    const result = await client.query(
      "SELECT password_hash FROM users WHERE id = $1 FOR UPDATE",
      [userId],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      const error = new Error("Текущий пароль указан неверно");
      error.status = 400;
      throw error;
    }

    await client.query(
      "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1",
      [userId, await hashPassword(newPassword)],
    );
    await client.query(
      "DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2",
      [userId, hashSessionToken(sessionToken)],
    );
  });
}

export { changePassword, updateProfile };
