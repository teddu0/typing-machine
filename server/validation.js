const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validateCredentials(body) {
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    const error = new Error("Укажите корректный email");
    error.status = 400;
    throw error;
  }
  if (password.length < 8 || password.length > 128) {
    const error = new Error("Пароль должен содержать от 8 до 128 символов");
    error.status = 400;
    throw error;
  }
  return { email, password };
}

export { normalizeEmail, validateCredentials };
