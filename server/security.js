import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, n, r, p, saltBase64, hashBase64] = storedHash.split("$");
  if (algorithm !== "scrypt") return false;
  const expected = Buffer.from(hashBase64, "base64");
  const actual = await scrypt(password, Buffer.from(saltBase64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export { createSessionToken, hashPassword, hashSessionToken, randomUUID, verifyPassword };
