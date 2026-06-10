import { courses } from "../data/courses.js";

const allowedCharacters = new Set("ёйцукенгшщзхъфывапролджэячсмитьбю1234567890 ");
const levels = courses.flatMap((course) =>
  course.levels.map((level) => ({ ...level, courseId: course.id }))
);
const invalidCharacters = levels.flatMap((level) => [...level.text]
  .filter((character) => !allowedCharacters.has(character))
  .map((character) => ({ course: level.courseId, level: level.id, character })));
const invalidIds = courses.flatMap((course) => course.levels
  .filter((level, index) => level.id !== index + 1)
  .map((level) => ({ course: course.id, level: level.id })));
const undeclaredCharacters = levels.flatMap((level) =>
  [...new Set([...level.text].filter((character) => character !== " "))]
    .filter((character) => !level.letters.includes(character))
    .map((character) => ({ course: level.courseId, level: level.id, character }))
);

if (invalidCharacters.length || invalidIds.length || undeclaredCharacters.length) {
  console.error("В данных уровней найдены ошибки:", {
    invalidCharacters,
    invalidIds,
    undeclaredCharacters
  });
  process.exitCode = 1;
} else {
  console.log(`Проверено курсов: ${courses.length}, уровней: ${levels.length}`);
}
