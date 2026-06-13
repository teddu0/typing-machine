const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizePhone(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return `${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

function validateBirthDate(value, today = new Date()) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const error = new Error("Укажите корректную дату рождения");
    error.status = 400;
    throw error;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  const todayUtc = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  ));
  const oldest = new Date(Date.UTC(
    todayUtc.getUTCFullYear() - 120,
    todayUtc.getUTCMonth(),
    todayUtc.getUTCDate(),
  ));
  if (!isRealDate || date > todayUtc || date < oldest) {
    const error = new Error("Дата рождения должна быть в пределах последних 120 лет");
    error.status = 400;
    throw error;
  }
  return value;
}

function validatePassword(value, label = "Пароль") {
  const password = typeof value === "string" ? value : "";
  if (password.length < 8 || password.length > 128) {
    const error = new Error(`${label} должен содержать от 8 до 128 символов`);
    error.status = 400;
    throw error;
  }
  return password;
}

function validateCredentials(body) {
  const email = normalizeEmail(body.email);
  const password = validatePassword(body.password);
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    const error = new Error("Укажите корректный email");
    error.status = 400;
    throw error;
  }
  return { email, password };
}

function validateProfile(body) {
  const rawName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const displayName = rawName || null;
  if (displayName && (displayName.length < 2 || displayName.length > 40)) {
    const error = new Error("Имя должно содержать от 2 до 40 символов");
    error.status = 400;
    throw error;
  }

  const birthDate = validateBirthDate(body.birthDate);

  const phone = normalizePhone(body.phone);
  if (phone && !/^\+[0-9]{7,15}$/.test(phone)) {
    const error = new Error("Укажите телефон в международном формате, например +79991234567");
    error.status = 400;
    throw error;
  }
  return { displayName, birthDate, phone };
}

function validatePasswordChange(body) {
  const currentPassword = validatePassword(body.currentPassword, "Текущий пароль");
  const newPassword = validatePassword(body.newPassword, "Новый пароль");
  if (currentPassword === newPassword) {
    const error = new Error("Новый пароль должен отличаться от текущего");
    error.status = 400;
    throw error;
  }
  return { currentPassword, newPassword };
}

export {
  normalizeEmail,
  normalizePhone,
  validateBirthDate,
  validateCredentials,
  validatePassword,
  validatePasswordChange,
  validateProfile,
};
