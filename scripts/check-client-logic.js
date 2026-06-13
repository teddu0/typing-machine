import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { russianLayout } from "../public/keyboard-layouts.js";
import { formatBirthDateInput, formatIsoDate, parseRussianDate } from "../public/date-format.js";
import {
  levelKey,
  loadProgress as loadStoredProgress,
  normalizeProgress,
  saveProgress,
} from "../public/progress.js";

let focusedElement = null;

assert.equal(formatIsoDate("2015-06-13"), "13.06.2015");
assert.equal(formatBirthDateInput("13062015"), "13.06.2015");
assert.equal(formatBirthDateInput("13.06.2015"), "13.06.2015");
assert.equal(parseRussianDate("13.06.2015"), "2015-06-13");
assert.equal(parseRussianDate(""), "");
assert.throws(() => parseRussianDate("2015-06-13"), /ДД\.ММ\.ГГГГ/);
assert.throws(() => parseRussianDate("30.02.2015"), /корректную дату/);

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
    open: false,
    focus() {
      focusedElement = this;
    },
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
  ["#account-dialog", createElement()],
  ["#retry-button", createElement()],
  ["#next-button", createElement()],
]);
const fallbackElement = createElement();
const storage = new Map();
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const context = vm.createContext({
  console,
  document: {
    addEventListener() {},
    get activeElement() {
      return focusedElement;
    },
    querySelector: (selector) => elements.get(selector) || fallbackElement,
    querySelectorAll: () => [],
  },
  fetch: () => new Promise(() => {}),
  initializeAccount() {},
  levelKey,
  loadProgress: () => loadStoredProgress(localStorage),
  localStorage,
  normalizeProgress,
  mergeServerProgress: () => Promise.resolve(null),
  persistProgress: (progress) => saveProgress(progress, localStorage),
  russianLayout,
  setTimeout,
  window: { scrollTo() {} },
});

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8")
  .replace(/^import[\s\S]*?from ".*";\r?\n/gm, "");
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
assert.equal(
  russianLayout.fingerColorClasses["ф"],
  russianLayout.fingerColorClasses["ж"],
  "Клавиши левого и правого мизинцев должны иметь общий цвет",
);
assert.equal(
  russianLayout.fingerColorClasses["а"],
  russianLayout.fingerColorClasses["о"],
  "Опорные клавиши указательных пальцев должны иметь общий цвет",
);
assert.notEqual(
  russianLayout.fingerColorClasses["а"],
  russianLayout.fingerColorClasses["в"],
  "Разные пальцы должны иметь разные цвета",
);

storage.set("klavishki-progress", JSON.stringify({ courseVersion: 4 }));
assert.deepEqual(
  evaluateValue("loadProgress().stars"),
  {},
  "Повреждённое актуальное сохранение не должно ломать приложение",
);

localStorage.setItem = () => {
  throw new Error("Storage disabled");
};
assert.doesNotThrow(
  () => evaluate("persistProgress(progress)"),
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
  target: null,
};
context.event = event;
evaluate("handleKeydown(event)");
assert.equal(event.prevented, false, "Пробел вне тренировки не должен перехватываться");

evaluate("screens.trainer.classList.remove('hidden'); activeLevel = { text: 'а' }");
event.key = "а";
event.code = "KeyF";
event.target = { closest: () => ({ tagName: "INPUT" }) };
event.prevented = false;
evaluate("handleKeydown(event)");
assert.equal(event.prevented, false, "Ввод в поле не должен перехватываться тренажёром");
assert.equal(evaluate("position"), 0, "Ввод в поле не должен продвигать занятие");

event.target = null;
elements.get("#account-dialog").open = true;
event.prevented = false;
evaluate("handleKeydown(event)");
assert.equal(event.prevented, false, "Открытое модальное окно должно приостанавливать ввод занятия");
assert.equal(evaluate("position"), 0, "Открытое модальное окно не должно продвигать занятие");
elements.get("#account-dialog").open = false;

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

evaluate("screens.trainer.classList.add('hidden'); screens.result.classList.remove('hidden')");
evaluate("focusResultAction()");
assert.equal(
  focusedElement,
  elements.get("#next-button"),
  "По умолчанию должна выбираться кнопка следующего занятия",
);

event.code = "ArrowLeft";
event.key = "ArrowLeft";
event.prevented = false;
evaluate("handleKeydown(event)");
assert.equal(event.prevented, true, "Стрелка влево должна перехватываться на экране результата");
assert.equal(
  focusedElement,
  elements.get("#retry-button"),
  "Стрелка влево должна выбирать кнопку повтора",
);

event.code = "ArrowRight";
event.key = "ArrowRight";
event.prevented = false;
evaluate("handleKeydown(event)");
assert.equal(event.prevented, true, "Стрелка вправо должна перехватываться на экране результата");
assert.equal(
  focusedElement,
  elements.get("#next-button"),
  "Стрелка вправо должна выбирать кнопку следующего занятия",
);

event.code = "Space";
event.key = " ";
event.prevented = false;
evaluate("handleKeydown(event)");
assert.equal(
  event.prevented,
  false,
  "Пробел должен штатно нажимать выбранную кнопку результата",
);

console.log("Проверена клиентская логика прогресса и клавиатурного ввода");
