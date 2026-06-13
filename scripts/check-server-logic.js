import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../server/security.js";
import { normalizeStars } from "../server/progress-service.js";
import { normalizeEmail, validateCredentials } from "../server/validation.js";

assert.equal(normalizeEmail("  User@Example.COM "), "user@example.com");
assert.deepEqual(validateCredentials({ email: "user@example.com", password: "password-123" }), {
  email: "user@example.com",
  password: "password-123",
});
assert.throws(
  () => validateCredentials({ email: "bad", password: "password-123" }),
  /корректный email/,
);
assert.throws(
  () => validateCredentials({ email: "user@example.com", password: "short" }),
  /от 8 до 128/,
);

const passwordHash = await hashPassword("correct horse battery staple");
assert.notEqual(passwordHash, "correct horse battery staple");
assert.equal(await verifyPassword("correct horse battery staple", passwordHash), true);
assert.equal(await verifyPassword("wrong password", passwordHash), false);
assert.deepEqual(normalizeStars({
  "middle:1": 2,
  "middle:2": 3,
  "missing:1": 3,
  "middle:3": 7,
}), {
  "middle:1": 2,
  "middle:2": 3,
});

console.log("Проверена серверная логика регистрации и паролей");
