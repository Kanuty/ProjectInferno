import { Pool, PoolClient, QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL || "postgres://inferno:inferno_secret@localhost:5432/inferno_db";

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]) {
  return await pool.query<T>(text, params);
}
