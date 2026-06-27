const errorResponse = {
  description: "Ошибка запроса",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
};

const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Клавишки API",
    version: "0.1.0",
    description: "API регистрации, профиля и прогресса тренажёра «Клавишки».",
  },
  servers: [{ url: "/", description: "Текущий сервер" }],
  tags: [
    { name: "System", description: "Состояние сервиса и учебные данные" },
    { name: "Auth", description: "Регистрация и серверная сессия" },
    { name: "Profile", description: "Профиль авторизованного пользователя" },
    { name: "Progress", description: "Серверный прогресс пользователя" },
    { name: "Leaderboard", description: "Рейтинг участников" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Проверить доступность API и базы данных",
        responses: {
          200: {
            description: "Сервис работает",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", examples: ["ok"] } },
                  required: ["status"],
                },
              },
            },
          },
          500: errorResponse,
        },
      },
    },
    "/api/courses": {
      get: {
        tags: ["System"],
        summary: "Получить учебные курсы",
        responses: {
          200: {
            description: "Список курсов с занятиями",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "object", additionalProperties: true } },
              },
            },
          },
        },
      },
    },
    "/api/leaderboard": {
      get: {
        tags: ["Leaderboard"],
        summary: "Получить рейтинг участников",
        description: "Возвращает участников с серверным прогрессом или историей занятий. В имени рейтинга используется display_name, а если он не заполнен — email.",
        parameters: [
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
          },
        ],
        responses: {
          200: {
            description: "Список участников рейтинга",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LeaderboardResponse" },
              },
            },
          },
          500: errorResponse,
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Получить текущего пользователя",
        responses: {
          200: {
            description: "Пользователь текущей сессии или null",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { user: { oneOf: [{ $ref: "#/components/schemas/User" }, { type: "null" }] } },
                  required: ["user"],
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Зарегистрироваться",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Credentials" } } } },
        responses: {
          201: { $ref: "#/components/responses/UserResponse" },
          400: errorResponse,
          409: errorResponse,
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Войти",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Credentials" } } } },
        responses: {
          200: { $ref: "#/components/responses/UserResponse" },
          400: errorResponse,
          401: errorResponse,
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Выйти",
        security: [{ sessionCookie: [] }],
        responses: {
          200: {
            description: "Сессия завершена",
            content: {
              "application/json": {
                schema: { type: "object", properties: { user: { type: "null" } }, required: ["user"] },
              },
            },
          },
        },
      },
    },
    "/api/profile": {
      patch: {
        tags: ["Profile"],
        summary: "Обновить профиль",
        security: [{ sessionCookie: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProfileUpdate" } } } },
        responses: {
          200: { $ref: "#/components/responses/UserResponse" },
          400: errorResponse,
          401: errorResponse,
        },
      },
    },
    "/api/profile/password": {
      post: {
        tags: ["Profile"],
        summary: "Изменить пароль",
        security: [{ sessionCookie: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PasswordChange" } } } },
        responses: {
          200: {
            description: "Пароль изменён",
            content: {
              "application/json": {
                schema: { type: "object", properties: { status: { type: "string", examples: ["ok"] } }, required: ["status"] },
              },
            },
          },
          400: errorResponse,
          401: errorResponse,
        },
      },
    },
    "/api/progress": {
      get: {
        tags: ["Progress"],
        summary: "Получить серверный прогресс",
        security: [{ sessionCookie: [] }],
        responses: {
          200: { $ref: "#/components/responses/ProgressResponse" },
          401: errorResponse,
        },
      },
      delete: {
        tags: ["Progress"],
        summary: "Обнулить прогресс",
        description: "Безвозвратно удаляет весь прогресс текущего пользователя.",
        security: [{ sessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  confirmation: { type: "string", const: "обнулить" },
                },
                required: ["confirmation"],
              },
            },
          },
        },
        responses: {
          200: { $ref: "#/components/responses/ProgressResponse" },
          400: errorResponse,
          401: errorResponse,
        },
      },
    },
    "/api/progress/merge": {
      post: {
        tags: ["Progress"],
        summary: "Объединить локальный и серверный прогресс",
        description: "Для каждого занятия сохраняется максимальное число звёзд.",
        security: [{ sessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { stars: { $ref: "#/components/schemas/Stars" } },
                required: ["stars"],
              },
            },
          },
        },
        responses: {
          200: { $ref: "#/components/responses/ProgressResponse" },
          401: errorResponse,
        },
      },
    },
    "/api/typing-sessions": {
      post: {
        tags: ["Leaderboard"],
        summary: "Записать завершённое занятие",
        security: [{ sessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TypingSessionInput" },
            },
          },
        },
        responses: {
          201: {
            description: "Результат записан",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", examples: ["ok"] } },
                  required: ["status"],
                },
              },
            },
          },
          400: errorResponse,
          401: errorResponse,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "klavishki_session",
        description: "HttpOnly-cookie устанавливается после регистрации или входа.",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          displayName: { type: ["string", "null"], minLength: 2, maxLength: 40 },
          birthDate: { type: ["string", "null"], format: "date" },
          phone: { type: ["string", "null"], pattern: "^\\+[0-9]{7,15}$", examples: ["+79991234567"] },
        },
        required: ["id", "email", "displayName", "birthDate", "phone"],
      },
      Credentials: {
        type: "object",
        properties: {
          email: { type: "string", format: "email", examples: ["user@example.com"] },
          password: { type: "string", format: "password", minLength: 8, maxLength: 128 },
        },
        required: ["email", "password"],
      },
      ProfileUpdate: {
        type: "object",
        properties: {
          displayName: { type: ["string", "null"], minLength: 2, maxLength: 40, examples: ["Алекс"] },
          birthDate: { type: ["string", "null"], format: "date", examples: ["2015-06-13"] },
          phone: { type: ["string", "null"], examples: ["+7 (999) 123-45-67"] },
        },
      },
      PasswordChange: {
        type: "object",
        properties: {
          currentPassword: { type: "string", format: "password", minLength: 8, maxLength: 128 },
          newPassword: { type: "string", format: "password", minLength: 8, maxLength: 128 },
        },
        required: ["currentPassword", "newPassword"],
      },
      Stars: {
        type: "object",
        additionalProperties: { type: "integer", minimum: 1, maximum: 3 },
        examples: [{ "middle:1": 3, "middle:2": 2 }],
      },
      TypingSessionInput: {
        type: "object",
        properties: {
          courseId: { type: "string", examples: ["middle"] },
          levelId: { type: "integer", minimum: 1, examples: [1] },
          stars: { type: "integer", minimum: 1, maximum: 3 },
          accuracy: { type: "integer", minimum: 0, maximum: 100 },
          attempts: { type: "integer", minimum: 1 },
          mistakes: { type: "integer", minimum: 0 },
          durationSeconds: { type: "integer", minimum: 0 },
        },
        required: ["courseId", "levelId", "stars", "accuracy", "attempts", "mistakes", "durationSeconds"],
      },
      LeaderboardParticipant: {
        type: "object",
        properties: {
          rank: { type: "integer", minimum: 1 },
          id: { type: "string", format: "uuid" },
          displayName: { type: "string" },
          completedLessons: { type: "integer", minimum: 1 },
          rewards: { type: "integer", minimum: 1 },
          averageAccuracy: { type: "integer", minimum: 0, maximum: 100 },
          practiceSeconds: { type: "integer", minimum: 0 },
          score: { type: "integer", minimum: 1 },
          lastCompletedAt: { type: "string", format: "date-time" },
        },
        required: [
          "rank",
          "id",
          "displayName",
          "completedLessons",
          "rewards",
          "averageAccuracy",
          "practiceSeconds",
          "score",
          "lastCompletedAt",
        ],
      },
      LeaderboardResponse: {
        type: "object",
        properties: {
          participants: {
            type: "array",
            items: { $ref: "#/components/schemas/LeaderboardParticipant" },
          },
        },
        required: ["participants"],
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
    },
    responses: {
      UserResponse: {
        description: "Данные пользователя",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { user: { $ref: "#/components/schemas/User" } },
              required: ["user"],
            },
          },
        },
      },
      ProgressResponse: {
        description: "Прогресс пользователя",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { stars: { $ref: "#/components/schemas/Stars" } },
              required: ["stars"],
            },
          },
        },
      },
    },
  },
};

export { openapi };
