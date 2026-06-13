import { closeDatabase } from "../server/db.js";
import { migrate } from "../server/migrate.js";

try {
  await migrate();
} finally {
  await closeDatabase();
}
