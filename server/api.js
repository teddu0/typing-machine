import { courses } from "../data/courses.js";
import { challenges } from "../data/challenges.js";
import { config } from "./config.js";
import { findUserBySessionToken, login, logout, register, SESSION_SECONDS } from "./auth-service.js";
import { assertSameOrigin, parseCookies, readJson, sendJson, sessionCookie } from "./http.js";
import {
  getChallengeLeaderboard,
  getLeaderboard,
  recordChallengeResult,
  recordTypingSession,
} from "./leaderboard-service.js";
import { getProgress, mergeProgress, resetProgress } from "./progress-service.js";
import { changePassword, updateProfile } from "./profile-service.js";
import { query } from "./db.js";
import { assertRateLimit } from "./rate-limit.js";
import {
  validateCredentials,
  validatePasswordChange,
  validateProfile,
  validateProgressReset,
} from "./validation.js";

function getSessionToken(request) {
  return parseCookies(request)[config.sessionCookieName];
}

function cookieHeader(token, maxAge = SESSION_SECONDS) {
  return sessionCookie(
    config.sessionCookieName,
    token,
    maxAge,
    config.nodeEnv === "production",
  );
}

function authRateLimitKey(request, action) {
  return `${action}:${request.socket.remoteAddress || "unknown"}`;
}

async function requireUser(request) {
  const user = await findUserBySessionToken(getSessionToken(request));
  if (!user) {
    const error = new Error("Требуется вход");
    error.status = 401;
    throw error;
  }
  return user;
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    await query("SELECT 1");
    sendJson(response, 200, { status: "ok" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/courses") {
    sendJson(response, 200, courses);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/challenges") {
    sendJson(response, 200, challenges);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/leaderboard") {
    sendJson(response, 200, await getLeaderboard(url.searchParams.get("limit")));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/challenge-leaderboard") {
    sendJson(
      response,
      200,
      await getChallengeLeaderboard(
        url.searchParams.get("challengeId"),
        url.searchParams.get("limit"),
      ),
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/me") {
    sendJson(response, 200, { user: await findUserBySessionToken(getSessionToken(request)) });
    return true;
  }

  if (request.method !== "GET") assertSameOrigin(request);

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    assertRateLimit(authRateLimitKey(request, "register"));
    const { email, password } = validateCredentials(await readJson(request));
    const result = await register(email, password);
    sendJson(response, 201, { user: result.user }, { "Set-Cookie": cookieHeader(result.token) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    assertRateLimit(authRateLimitKey(request, "login"));
    const { email, password } = validateCredentials(await readJson(request));
    const result = await login(email, password);
    sendJson(response, 200, { user: result.user }, { "Set-Cookie": cookieHeader(result.token) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    await logout(getSessionToken(request));
    sendJson(response, 200, { user: null }, { "Set-Cookie": cookieHeader("", 0) });
    return true;
  }

  if (request.method === "PATCH" && url.pathname === "/api/profile") {
    const user = await requireUser(request);
    const profile = validateProfile(await readJson(request));
    sendJson(response, 200, { user: await updateProfile(user.id, profile) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/profile/password") {
    const user = await requireUser(request);
    assertRateLimit(authRateLimitKey(request, "password"));
    const passwords = validatePasswordChange(await readJson(request));
    await changePassword(
      user.id,
      getSessionToken(request),
      passwords.currentPassword,
      passwords.newPassword,
    );
    sendJson(response, 200, { status: "ok" });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/progress") {
    const user = await requireUser(request);
    sendJson(response, 200, await getProgress(user.id));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/progress/merge") {
    const user = await requireUser(request);
    const body = await readJson(request);
    sendJson(response, 200, await mergeProgress(user.id, body.stars));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/typing-sessions") {
    const user = await requireUser(request);
    sendJson(response, 201, await recordTypingSession(user.id, await readJson(request)));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/challenge-results") {
    const user = await requireUser(request);
    sendJson(response, 201, await recordChallengeResult(user.id, await readJson(request)));
    return true;
  }

  if (request.method === "DELETE" && url.pathname === "/api/progress") {
    const user = await requireUser(request);
    validateProgressReset(await readJson(request));
    sendJson(response, 200, await resetProgress(user.id));
    return true;
  }

  return false;
}

export { handleApi };
