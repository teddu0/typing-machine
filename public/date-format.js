function formatIsoDate(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

function formatBirthDateInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
    .filter(Boolean)
    .join(".");
}

function parseRussianDate(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) throw new Error("Укажите дату рождения в формате ДД.ММ.ГГГГ");

  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new Error("Укажите корректную дату рождения");
  }
  return `${year}-${month}-${day}`;
}

export { formatBirthDateInput, formatIsoDate, parseRussianDate };
