let currentUser = null;
let onAuthenticated = async () => {};
let onLoggedOut = () => {};

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

function renderAccount() {
  const button = document.querySelector("#account-button");
  button.textContent = currentUser ? currentUser.email : "Войти";
  document.querySelector("#account-user").textContent = currentUser?.email || "";
  document.querySelector("#account-forms").classList.toggle("hidden", Boolean(currentUser));
  document.querySelector("#account-session").classList.toggle("hidden", !currentUser);
}

function showMessage(message, isError = false) {
  const element = document.querySelector("#account-message");
  element.textContent = message;
  element.className = `account-message${isError ? " error" : ""}`;
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

async function initializeAccount(callbacks = {}) {
  onAuthenticated = callbacks.onAuthenticated || onAuthenticated;
  onLoggedOut = callbacks.onLoggedOut || onLoggedOut;

  const dialog = document.querySelector("#account-dialog");
  document.querySelector("#account-button").addEventListener("click", () => {
    showMessage("");
    dialog.showModal();
  });
  document.querySelector("#account-close").addEventListener("click", () => dialog.close());
  document.querySelector("#register-form").addEventListener("submit", (event) =>
    submitCredentials(event, "/api/auth/register"));
  document.querySelector("#login-form").addEventListener("submit", (event) =>
    submitCredentials(event, "/api/auth/login"));
  document.querySelector("#logout-button").addEventListener("click", async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST", body: "{}" });
      currentUser = null;
      renderAccount();
      onLoggedOut();
      dialog.close();
    } catch (error) {
      showMessage(error.message, true);
    }
  });

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
