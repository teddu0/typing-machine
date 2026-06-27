import { courses } from "../data/courses.js";
import { challenges } from "../data/challenges.js";

const allowedCharacters = new Set("йцукенгшщзхъфывапролджэячсмитьбю1234567890 ");
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
const invalidChallengeCharacters = challenges.flatMap((challenge) => [...challenge.text]
  .filter((character) => !allowedCharacters.has(character))
  .map((character) => ({ challenge: challenge.id, character })));
const invalidChallengeIds = challenges
  .filter((challenge) => !/^[a-z0-9-]+$/.test(challenge.id))
  .map((challenge) => challenge.id);
const tooLongChallenges = challenges
  .filter((challenge) => challenge.text.length > 1000)
  .map((challenge) => ({ challenge: challenge.id, length: challenge.text.length }));

if (
  invalidCharacters.length ||
  invalidIds.length ||
  undeclaredCharacters.length ||
  invalidChallengeCharacters.length ||
  invalidChallengeIds.length ||
  tooLongChallenges.length
) {
  console.error("В данных уровней найдены ошибки:", {
    invalidCharacters,
    invalidIds,
    undeclaredCharacters,
    invalidChallengeCharacters,
    invalidChallengeIds,
    tooLongChallenges,
  });
  process.exitCode = 1;
} else {
  console.log(`Проверено курсов: ${courses.length}, уровней: ${levels.length}, челленджей: ${challenges.length}`);
}
