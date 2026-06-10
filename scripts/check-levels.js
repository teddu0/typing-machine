import { levels } from "../data/levels.js";

const allowedCharacters = new Set("фывапролджэ ");
const invalidCharacters = levels.flatMap((level) =>
  [...level.text]
    .filter((character) => !allowedCharacters.has(character))
    .map((character) => ({ level: level.id, character }))
);
const invalidIds = levels
  .filter((level, index) => level.id !== index + 1)
  .map((level) => level.id);
const undeclaredCharacters = levels.flatMap((level) =>
  [...new Set([...level.text].filter((character) => character !== " "))]
    .filter((character) => !level.letters.includes(character))
    .map((character) => ({ level: level.id, character }))
);

if (invalidCharacters.length || invalidIds.length || undeclaredCharacters.length) {
  console.error("В данных уровней найдены ошибки:", {
    invalidCharacters,
    invalidIds,
    undeclaredCharacters
  });
  process.exitCode = 1;
} else {
  console.log(`Проверено уровней: ${levels.length}`);
}
