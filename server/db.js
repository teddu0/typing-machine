import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: config.databaseUrl });

async function query(text, values = []) {
  return pool.query(text, values);
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function closeDatabase() {
  await pool.end();
}

export { closeDatabase, pool, query, withTransaction };
