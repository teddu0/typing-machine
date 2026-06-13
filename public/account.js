import { formatBirthDateInput, formatIsoDate, parseRussianDate } from "./date-format.js";

let currentUser = null;
let onAuthenticated = async () => {};
let onLoggedOut = () => {};
let onOpenProfile = () => {};
let onProgressReset = () => {};

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Не удалось выполнить запрос");
  return body;
}

function accountLabel() {
  return currentUser?.displayName || currentUser?.email || "Войти";
}

function renderAccount() {
  document.querySelector("#account-button").textContent = accountLabel();
  document.querySelector("#account-user").textContent = accountLabel();
  document.querySelector("#account-forms").classList.toggle("hidden", Boolean(currentUser));
  document.querySelector("#account-session").classList.toggle("hidden", !currentUser);

  if (!currentUser) return;
  document.querySelector("#profile-email").textContent = currentUser.email;
  document.querySelector("#profile-display-name").value = currentUser.displayName || "";
  document.querySelector("#profile-birth-date").value = formatIsoDate(currentUser.birthDate);
  document.querySelector("#profile-phone").value = currentUser.phone || "";
}

function showMessage(message, isError = false, target = "#account-message") {
  const element = document.querySelector(target);
  element.textContent = message;
  element.className = `${element.dataset.messageClass}${isError ? " error" : ""}`;
}

async function submitCredentials(event, path) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  showMessage("Подождите…");
  try {
    const result = await apiRequest(path, {
      method: "POST",
      body: JSON.stringify({
        email: data.get("email"),
        password: data.get("password"),
      }),
    });
    currentUser = result.user;
    renderAccount();
    showMessage("Готово! Локальный прогресс переносится в аккаунт.");
    try {
      await onAuthenticated();
    } catch {
      showMessage("Аккаунт готов. Прогресс синхронизируется при следующем занятии.");
    }
    form.reset();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function logout() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST", body: "{}" });
    currentUser = null;
    renderAccount();
    onLoggedOut();
    document.querySelector("#account-dialog").close();
  } catch (error) {
    showMessage(error.message, true, "#profile-message");
  }
}

async function updateProfile(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  showMessage("Сохраняем…", false, "#profile-message");
  try {
    const result = await apiRequest("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: data.get("displayName"),
        birthDate: parseRussianDate(data.get("birthDate")),
        phone: data.get("phone"),
      }),
    });
    currentUser = result.user;
    renderAccount();
    showMessage("Профиль сохранён.", false, "#profile-message");
  } catch (error) {
    showMessage(error.message, true, "#profile-message");
  }
}

async function updatePassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  showMessage("Меняем пароль…", false, "#password-message");
  try {
    await apiRequest("/api/profile/password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: data.get("currentPassword"),
        newPassword: data.get("newPassword"),
      }),
    });
    form.reset();
    showMessage("Пароль изменён. Остальные сессии завершены.", false, "#password-message");
  } catch (error) {
    showMessage(error.message, true, "#password-message");
  }
}

async function resetProgress(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  showMessage("Обнуляем прогресс…", false, "#reset-progress-message");
  try {
    await apiRequest("/api/progress", {
      method: "DELETE",
      body: JSON.stringify({ confirmation: data.get("confirmation") }),
    });
    form.reset();
    document.querySelector("#reset-progress-button").disabled = true;
    onProgressReset();
    showMessage("Прогресс обнулён. Можно начать обучение заново.", false, "#reset-progress-message");
  } catch (error) {
    showMessage(error.message, true, "#reset-progress-message");
  }
}

function openProfile() {
  document.querySelector("#account-dialog").close();
  showMessage("", false, "#profile-message");
  showMessage("", false, "#password-message");
  showMessage("", false, "#reset-progress-message");
  renderAccount();
  onOpenProfile();
}

async function initializeAccount(callbacks = {}) {
  onAuthenticated = callbacks.onAuthenticated || onAuthenticated;
  onLoggedOut = callbacks.onLoggedOut || onLoggedOut;
  onOpenProfile = callbacks.onOpenProfile || onOpenProfile;
  onProgressReset = callbacks.onProgressReset || onProgressReset;

  const dialog = document.querySelector("#account-dialog");
  document.querySelector("#account-button").addEventListener("click", () => {
    if (currentUser) {
      openProfile();
      return;
    }
    showMessage("");
    dialog.showModal();
  });
  document.querySelector("#account-close").addEventListener("click", () => dialog.close());
  document.querySelector("#profile-open-button").addEventListener("click", openProfile);
  document.querySelector("#register-form").addEventListener("submit", (event) =>
    submitCredentials(event, "/api/auth/register"));
  document.querySelector("#login-form").addEventListener("submit", (event) =>
    submitCredentials(event, "/api/auth/login"));
  document.querySelector("#profile-form").addEventListener("submit", updateProfile);
  document.querySelector("#profile-birth-date").addEventListener("input", (event) => {
    event.currentTarget.value = formatBirthDateInput(event.currentTarget.value);
  });
  document.querySelector("#password-form").addEventListener("submit", updatePassword);
  document.querySelector("#reset-progress-form").addEventListener("submit", resetProgress);
  document.querySelector("#reset-progress-confirmation").addEventListener("input", (event) => {
    document.querySelector("#reset-progress-button").disabled =
      event.currentTarget.value.trim() !== "обнулить";
  });
  document.querySelector("#logout-button").addEventListener("click", logout);

  try {
    const result = await apiRequest("/api/auth/me");
    currentUser = result.user;
    renderAccount();
    if (currentUser) {
      try {
        await onAuthenticated();
      } catch {
        showMessage("Не удалось синхронизировать прогресс. Повторим позже.", true);
      }
    }
  } catch {
    renderAccount();
  }
}

async function mergeServerProgress(stars) {
  if (!currentUser) return null;
  return apiRequest("/api/progress/merge", {
    method: "POST",
    body: JSON.stringify({ stars }),
  });
}

export { initializeAccount, mergeServerProgress };
