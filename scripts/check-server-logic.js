import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../server/security.js";
import {
  leaderboardQuery,
  normalizeLimit,
  normalizeTypingSession,
} from "../server/leaderboard-service.js";
import { openapi } from "../server/openapi.js";
import { normalizeStars } from "../server/progress-service.js";
import {
  normalizeEmail,
  normalizePhone,
  validateBirthDate,
  validateCredentials,
  validatePasswordChange,
  validateProfile,
  validateProgressReset,
} from "../server/validation.js";

assert.equal(normalizeEmail("  User@Example.COM "), "user@example.com");
assert.equal(normalizePhone(" +7 (999) 123-45-67 "), "+79991234567");
assert.equal(normalizePhone(""), null);
assert.equal(validateBirthDate("2015-06-13", new Date("2026-06-13T00:00:00Z")), "2015-06-13");
assert.equal(validateBirthDate("", new Date("2026-06-13T00:00:00Z")), null);
assert.throws(
  () => validateBirthDate("2027-01-01", new Date("2026-06-13T00:00:00Z")),
  /последних 120 лет/,
);
assert.throws(
  () => validateBirthDate("2025-02-30", new Date("2026-06-13T00:00:00Z")),
  /последних 120 лет/,
);
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
assert.deepEqual(validateProfile({
  displayName: "  Алекс  ",
  birthDate: "2014-05-20",
  phone: "+7 (999) 123-45-67",
}), {
  displayName: "Алекс",
  birthDate: "2014-05-20",
  phone: "+79991234567",
});
assert.deepEqual(validateProfile({ displayName: "", birthDate: "" }), {
  displayName: null,
  birthDate: null,
  phone: null,
});
assert.throws(() => validateProfile({ displayName: "А" }), /от 2 до 40/);
assert.throws(() => validateProfile({ phone: "89991234567" }), /международном формате/);
assert.deepEqual(
  validatePasswordChange({ currentPassword: "old-password", newPassword: "new-password" }),
  { currentPassword: "old-password", newPassword: "new-password" },
);
assert.throws(
  () => validatePasswordChange({ currentPassword: "same-password", newPassword: "same-password" }),
  /отличаться/,
);
assert.doesNotThrow(() => validateProgressReset({ confirmation: "обнулить" }));
assert.doesNotThrow(() => validateProgressReset({ confirmation: "  обнулить  " }));
assert.throws(() => validateProgressReset({ confirmation: "Обнулить" }), /введите слово/);
assert.throws(() => validateProgressReset({ confirmation: "" }), /введите слово/);

const passwordHash = await hashPassword("correct horse battery staple");
assert.notEqual(passwordHash, "correct horse battery staple");
assert.equal(await verifyPassword("correct horse battery staple", passwordHash), true);
assert.equal(await verifyPassword("wrong password", passwordHash), false);
assert.equal(openapi.openapi, "3.1.0");
assert.ok(openapi.paths["/api/challenges"].get);
assert.ok(openapi.paths["/api/auth/register"].post);
assert.ok(openapi.paths["/api/profile"].patch);
assert.ok(openapi.paths["/api/leaderboard"].get);
assert.ok(openapi.paths["/api/progress/merge"].post);
assert.ok(openapi.paths["/api/progress"].delete);
assert.ok(openapi.paths["/api/typing-sessions"].post);
assert.ok(openapi.components.securitySchemes.sessionCookie);
assert.match(
  leaderboardQuery,
  /participant_ids AS \(\s*SELECT user_id FROM progress\s*UNION\s*SELECT user_id FROM typing_sessions/s,
);
assert.match(leaderboardQuery, /LEFT JOIN progress_stats/);
assert.match(leaderboardQuery, /LEFT JOIN session_stats/);
assert.equal(normalizeLimit(null), 50);
assert.equal(normalizeLimit(""), 50);
assert.equal(normalizeLimit("2"), 2);
assert.equal(normalizeLimit("0"), 1);
assert.equal(normalizeLimit("200"), 100);
assert.deepEqual(normalizeStars({
  "middle:1": 2,
  "middle:2": 3,
  "missing:1": 3,
  "middle:3": 7,
}), {
  "middle:1": 2,
  "middle:2": 3,
});
assert.deepEqual(normalizeTypingSession({
  courseId: "middle",
  levelId: 1,
  stars: 4,
  accuracy: 101,
  attempts: 12,
  mistakes: 2,
  durationSeconds: 45,
}), {
  courseId: "middle",
  levelId: 1,
  stars: 3,
  accuracy: 100,
  attempts: 12,
  mistakes: 2,
  durationSeconds: 45,
});
assert.throws(
  () => normalizeTypingSession({ courseId: "bad", levelId: 1, attempts: 1, mistakes: 0 }),
  /Неизвестное занятие/,
);
assert.throws(
  () => normalizeTypingSession({
    courseId: "middle",
    levelId: 1,
    attempts: 2,
    mistakes: 3,
  }),
  /Некорректная статистика/,
);

console.log("Проверена серверная логика регистрации, профиля и паролей");
