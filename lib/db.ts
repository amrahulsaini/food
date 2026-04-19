import mysql from "mysql2/promise";
import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

type SqlValue = string | number | boolean | Date | null;

declare global {
  // Keep a single pool during local hot-reload.
  var __foodisthanPool: Pool | undefined;
}

const dbPort = Number(process.env.DB_PORT ?? 3306);

const pool =
  global.__foodisthanPool ??
  mysql.createPool({
    host: process.env.DB_HOST ?? "34.133.49.19",
    user: process.env.DB_USER ?? "loop_food",
    password: process.env.DB_PASSWORD ?? "food",
    database: process.env.DB_NAME ?? "loop_food",
    port: Number.isNaN(dbPort) ? 3306 : dbPort,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

if (process.env.NODE_ENV !== "production") {
  global.__foodisthanPool = pool;
}

export { pool };

export async function query<T extends RowDataPacket[] = RowDataPacket[]>(
  sql: string,
  params: SqlValue[] = []
): Promise<T> {
  const [rows] = await pool.query<T>(sql, params);
  return rows;
}

export async function execute(
  sql: string,
  params: SqlValue[] = []
): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
}

export async function withTransaction<T>(
  runner: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await runner(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
