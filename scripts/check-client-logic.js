import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function createElement(hidden = false) {
  const classes = new Set(hidden ? ["hidden"] : []);
  return {
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      contains: (name) => classes.has(name),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, force) => force ? classes.add(name) : classes.delete(name),
    },
    addEventListener() {},
    setAttribute() {},
    style: { setProperty() {}, removeProperty() {} },
    textContent: "",
  };
}

const elements = new Map([
  ["#map-screen", createElement()],
  ["#guide-screen", createElement(true)],
  ["#trainer-screen", createElement(true)],
  ["#result-screen", createElement(true)],
]);
const fallbackElement = createElement();
const storage = new Map();
const context = vm.createContext({
  console,
  document: {
    addEventListener() {},
    querySelector: (selector) => elements.get(selector) || fallbackElement,
    querySelectorAll: () => [],
  },
  fetch: () => new Promise(() => {}),
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
  setTimeout,
  window: { scrollTo() {} },
});

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
vm.runInContext(appSource, context);

function evaluate(expression) {
  return vm.runInContext(expression, context);
}

function evaluateValue(expression) {
  return JSON.parse(JSON.stringify(evaluate(expression)));
}

assert.deepEqual(
  evaluateValue("normalizeProgress({ courseVersion: 4 }).stars"),
  {},
  "Прогресс без stars должен загружаться пустым",
);
assert.deepEqual(
  evaluateValue("normalizeProgress({ stars: { 'middle:1': 3, bad: 5, text: '3' } }).stars"),
  { "middle:1": 3 },
  "Некорректные значения звёзд должны отбрасываться",
);

storage.set("klavishki-progress", JSON.stringify({ courseVersion: 4 }));
assert.deepEqual(
  evaluateValue("loadProgress().stars"),
  {},
  "Повреждённое актуальное сохранение не должно ломать приложение",
);

context.localStorage.setItem = () => {
  throw new Error("Storage disabled");
};
assert.doesNotThrow(
  () => evaluate("saveProgress()"),
  "Запрет localStorage не должен ломать приложение",
);

const event = {
  altKey: false,
  code: "Space",
  ctrlKey: false,
  key: " ",
  metaKey: false,
  prevented: false,
  preventDefault() {
    this.prevented = true;
  },
};
context.event = event;
evaluate("handleKeydown(event)");
assert.equal(event.prevented, false, "Пробел вне тренировки не должен перехватываться");

evaluate("screens.trainer.classList.remove('hidden'); activeLevel = { text: 'а' }");
event.ctrlKey = true;
event.code = "KeyA";
event.key = "a";
evaluate("handleKeydown(event)");
assert.equal(event.prevented, false, "Системные сочетания не должны перехватываться");

event.ctrlKey = false;
event.code = "Backquote";
event.key = "ё";
evaluate("handleKeydown(event)");
assert.equal(event.prevented, false, "Ё не должна считаться английской раскладкой");
assert.equal(evaluate("keyboardLayout"), "ru", "Ё должна определять русскую раскладку");

console.log("Проверена клиентская логика прогресса и клавиатурного ввода");
