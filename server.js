import { readFile } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi } from "./server/api.js";
import { config } from "./server/config.js";
import { closeDatabase } from "./server/db.js";
import { sendJson } from "./server/http.js";
import { migrate } from "./server/migrate.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = join(currentDirectory, "public");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function serveFile(response, filePath) {
  readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, error.code === "ENOENT" ? 404 : 500, {
        error: error.code === "ENOENT" ? "Страница не найдена" : "Ошибка сервера",
      });
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  });
}

async function handleRequest(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      if (!(await handleApi(request, response, url))) {
        sendJson(response, 404, { error: "API-метод не найден" });
      }
      return;
    }

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Метод не поддерживается" });
      return;
    }

    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = resolve(publicDirectory, `.${requestedPath}`);
    if (!filePath.startsWith(`${publicDirectory}${sep}`)) {
      sendJson(response, 403, { error: "Доступ запрещён" });
      return;
    }
    serveFile(response, filePath);
  } catch (error) {
    console.error(error);
    const status = error.status || (error.code === "23505" ? 409 : 500);
    sendJson(response, status, {
      error: error.code === "23505"
        ? "Аккаунт с таким email уже существует"
        : status < 500 ? error.message : "Ошибка сервера",
    });
  }
}

await migrate();
const server = createServer(handleRequest);
server.listen(config.port, () => {
  console.log(`Клавишки готовы: http://localhost:${config.port}`);
});

async function shutdown() {
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
