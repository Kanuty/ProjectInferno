export * from "./client.js";

import { query } from "./client.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  const schemaPath = path.join(__dirname, "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Migration schema file not found at path: ${schemaPath}`);
  }
  const sql = fs.readFileSync(schemaPath, "utf-8");
  try {
    await query(sql);
    console.log("[Database] Database migrations applied successfully.");
  } catch (err: any) {
    console.error("[Database] Migration execution failed:", err.message || err);
    throw err;
  }
}
