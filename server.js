import { readFile } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { levels } from "./data/levels.js";

const port = Number(process.env.PORT) || 3000;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = join(currentDirectory, "public");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function serveFile(response, filePath) {
  readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, error.code === "ENOENT" ? 404 : 500, {
        error: error.code === "ENOENT" ? "Страница не найдена" : "Ошибка сервера"
      });
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
    });
    response.end(content);
  });
}

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/levels") {
    sendJson(response, 200, levels);
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
});

server.listen(port, () => {
  console.log(`Клавишки готовы: http://localhost:${port}`);
});
