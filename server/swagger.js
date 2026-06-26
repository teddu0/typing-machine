import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import swaggerUiDist from "swagger-ui-dist";
import { securityHeaders, sendJson } from "./http.js";
import { openapi } from "./openapi.js";

const swaggerDirectory = swaggerUiDist.getAbsoluteFSPath();
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
};

const swaggerHtml = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Клавишки API</title>
    <link rel="stylesheet" href="/api/swagger/swagger-ui.css">
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/swagger/swagger-ui-bundle.js"></script>
    <script src="/api/swagger/swagger-ui-standalone-preset.js"></script>
    <script>
      SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "StandaloneLayout"
      });
    </script>
  </body>
</html>`;

function sendContent(response, contentType, content) {
  response.writeHead(200, {
    ...securityHeaders(),
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(content);
}

async function handleSwagger(request, response, url) {
  if (request.method !== "GET") return false;
  if (url.pathname === "/api/openapi.json") {
    sendJson(response, 200, openapi);
    return true;
  }
  if (url.pathname === "/api/swagger" || url.pathname === "/api/swagger/") {
    sendContent(response, "text/html; charset=utf-8", swaggerHtml);
    return true;
  }
  if (!url.pathname.startsWith("/api/swagger/")) return false;

  const asset = normalize(url.pathname.slice("/api/swagger/".length));
  const filePath = join(swaggerDirectory, asset);
  if (!filePath.startsWith(`${swaggerDirectory}${sep}`)) return false;
  try {
    sendContent(
      response,
      contentTypes[extname(filePath)] || "application/octet-stream",
      await readFile(filePath),
    );
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  return true;
}

export { handleSwagger };
