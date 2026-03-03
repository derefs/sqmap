import { Database } from "bun:sqlite";
import * as SQM from "../sqmap.js";

export interface SQMSQLiteBunAPI<TCol, TRow> {
  /**
   * Insert one or more rows and execute the generated SQL with Bun SQLite.
   *
   * Capabilities:
   * - Single-row and multi-row insert.
   * - `cols` controls SQL column order and parameter order.
   * - Extra row keys are ignored.
   * - Missing values for selected columns become `undefined`.
   * - `return` supports `"*"` and selected columns.
   * - `return: []` omits `RETURNING`.
   * - Schema options in query inputs are ignored by this adapter (table-only SQL).
   *
   * @example
   * // Simple: single-row insert
   * const rows = users.insert(db, {
   *   cols: ["email"],
   *   rows: [{ email: "one@example.com" }]
   * });
   *
   * @example
   * // Advanced: multi-row insert with returning
   * const rows = users.insert(db, {
   *   cols: ["status", "email"],
   *   rows: [
   *     { status: "active", email: "first@example.com", ignored: "x" as any },
   *     { status: "banned", email: "second@example.com" }
   *   ],
   *   return: ["id", "email"],
   *   schema: "ignored_by_sqlite_adapter"
   * });
   *
   * Documentation note: this comment is shared with the different SQMap APIs.
   */
  insert: (db: Database, query: SQM.InsertQueryParams<TCol, TRow>) => Array<TRow>;
  /**
   * Select rows and execute the generated SQL with Bun SQLite.
   *
   * Capabilities:
   * - `cols` supports explicit columns and `"*"`.
   * - `distinct` support.
   * - `where` supports object and tokenized forms.
   * - `where` null rewrite for `=`/`!=` to `IS NULL`/`IS NOT NULL`.
   * - `in` supports `IN` and `NOT IN`.
   * - `like` supports `LIKE`, `NOT LIKE`, `ILIKE`, `NOT ILIKE`.
   * - `between` joins `where`/`in`/`like` groups (`AND` default, `OR` optional).
   * - `order` supports `ASC`/`DESC`.
   * - `shift` supports `LIMIT`/`OFFSET` (null or negative values are ignored).
   * - Empty/token-only filter arrays resolve to no `WHERE`.
   * - Schema options in query inputs are ignored by this adapter (table-only SQL).
   *
   * @example
   * // Simple: select by id
   * const rows = users.select(db, {
   *   cols: ["id", "email"],
   *   where: [{ id: 1 }]
   * });
   *
   * @example
   * // Advanced: distinct + tokenized filters + ordering + paging
   * const rows = users.select(db, {
   *   distinct: true,
   *   cols: ["id", "email"],
   *   where: [["verified_at", "=", null], "OR", ["status", "=", "active"]] as any,
   *   in: [["status", "IN", ["active", "banned"]]],
   *   like: [["email", "LIKE", "user%"]],
   *   between: "OR",
   *   order: { by: "id", type: "DESC" },
   *   shift: { limit: 50, offset: 100 },
   *   schema: "ignored_by_sqlite_adapter"
   * });
   *
   * Documentation note: this comment is shared with the different SQMap APIs.
   */
  select: (db: Database, query: SQM.SelectQueryParams<TCol, TRow>) => Array<TRow>;
  /**
   * Update rows and execute the generated SQL with Bun SQLite.
   *
   * Capabilities:
   * - Supports single and multi-column `set`.
   * - Supports `where`, `in`, and `like` filters.
   * - `between` joins `where`/`in`/`like` groups (`AND` default, `OR` optional).
   * - `where` null rewrite for `=`/`!=` to `IS NULL`/`IS NOT NULL`.
   * - `return` supports `"*"` and selected columns.
   * - `return: []` omits `RETURNING`.
   * - Guards: requires non-empty `set`, at least one filter key, and at least one resolved predicate.
   * - Schema options in query inputs are ignored by this adapter (table-only SQL).
   *
   * @example
   * // Simple: update one row by id
   * const rows = users.update(db, {
   *   set: { status: "deactivated" },
   *   where: [{ id: 42 }]
   * });
   *
   * @example
   * // Advanced: combine filter groups with OR and return selected columns
   * const rows = users.update(db, {
   *   set: { status: "banned", email: "blocked@example.com" },
   *   where: [["verified_at", "=", null], "OR", ["id", "=", 10]] as any,
   *   in: [["status", "IN", ["active", "deactivated"]]],
   *   like: [["email", "LIKE", "user%"]],
   *   between: "OR",
   *   return: ["id", "email", "status"],
   *   schema: "ignored_by_sqlite_adapter"
   * });
   *
   * Documentation note: this comment is shared with the different SQMap APIs.
   */
  update: (db: Database, query: SQM.UpdateQueryParams<TCol, TRow>) => Array<TRow>;
  /**
   * Delete rows and execute the generated SQL with Bun SQLite.
   *
   * Capabilities:
   * - Supports `where`, `in`, and `like` filters.
   * - `between` joins `where`/`in`/`like` groups (`AND` default, `OR` optional).
   * - `where` null rewrite for `=`/`!=` to `IS NULL`/`IS NOT NULL`.
   * - `return` supports `"*"` and selected columns.
   * - `return: []` omits `RETURNING`.
   * - Guards: requires at least one filter key and at least one resolved predicate.
   * - Schema options in query inputs are ignored by this adapter (table-only SQL).
   *
   * @example
   * // Simple: delete by id
   * const rows = users.delete(db, {
   *   where: [{ id: 42 }]
   * });
   *
   * @example
   * // Advanced: combine filters and return deleted rows
   * const rows = users.delete(db, {
   *   where: [["verified_at", "!=", null], "AND", ["status", "=", "deactivated"]] as any,
   *   in: [["id", "IN", [10, 11, 12]]],
   *   like: [["email", "LIKE", "cleanup%"]],
   *   between: "OR",
   *   return: ["id", "email"],
   *   schema: "ignored_by_sqlite_adapter"
   * });
   *
   * Documentation note: this comment is shared with the different SQMap APIs.
   */
  delete: (db: Database, query: SQM.DeleteQueryParams<TCol, TRow>) => Array<TRow>;
  /**
   * Execute raw SQL with parameters using Bun SQLite.
   *
   * Capabilities:
   * - Executes any SQL statement accepted by Bun SQLite.
   * - Binds all values from `params` through `.all(...params)`.
   * - Returns the selected/result rows as an array.
   *
   * @example
   * // Simple: raw select
   * const rows = users.sql(db, "SELECT datetime('now') AS ts", []);
   *
   * @example
   * // Advanced: parameterized raw query
   * const rows = users.sql(
   *   db,
   *   'SELECT "id", "email" FROM "users" WHERE "status" = $1 AND "email" LIKE $2',
   *   ["active", "user%"]
   * );
   *
   * Documentation note: this comment is shared with the different SQMap APIs.
   */
  sql:    (db: Database, query: string, params: any[])             => Array<TRow | any>;
}

export function genSQLiteBunAPI<TRow>(tableName: string, format?: SQM.Format): SQMSQLiteBunAPI<SQM.ExtractColsFromRow<TRow>, TRow> {
  const finalFormat = format ?? SQM.FORMATS.SQLITE_BUN;
  return {
    insert: (db: Database, query: SQM.InsertQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Array<TRow> => {
      const parsedQuery = SQM.parseInsertQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, finalFormat);
      let finalQuery = SQM.buildInsertQuery(null, tableName, parsedQuery, finalFormat.quotingChar);
      return db.query(finalQuery).all(...parsedQuery.params) as TRow[];
    },
    select: (db: Database, query: SQM.SelectQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Array<TRow> => {
      const parsedQuery = SQM.parseSelectQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, finalFormat);
      let finalQuery = SQM.buildSelectQuery(null, tableName, parsedQuery, finalFormat.quotingChar, query.between);
      return db.query(finalQuery).all(...parsedQuery.params) as TRow[];
    },
    update: (db: Database, query: SQM.UpdateQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Array<TRow> => {
      const parsedQuery = SQM.parseUpdateQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, finalFormat);
      let finalQuery = SQM.buildUpdateQuery(null, tableName, parsedQuery, finalFormat.quotingChar, query.between);
      return db.query(finalQuery).all(...parsedQuery.params) as TRow[];
    },
    delete: (db: Database, query: SQM.DeleteQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Array<TRow> => {
      const parsedQuery = SQM.parseDeleteQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, finalFormat);
      let finalQuery = SQM.buildDeleteQuery(null, tableName, parsedQuery, finalFormat.quotingChar, query.between);
      return db.query(finalQuery).all(...parsedQuery.params) as TRow[];
    },
    sql: (db: Database, query: string, params: any[]): Array<TRow | any> => {
      return db.query(query).all(...params) as TRow[];
    },
  };
}

/**
 * Assert an exact row count for a Bun SQLite result array and return the rows.
 *
 * Capabilities:
 * - Verifies `queryResult.length` matches `rowCount`.
 * - Throws the provided `error` when the exact count does not match.
 * - Returns typed rows when the assertion passes.
 *
 * @example
 * // Simple: require exactly two rows
 * const rows = expect(resultRows, 2, new Error("Expected exactly 2 rows"));
 *
 * @example
 * // Advanced: enforce a strict contract after update
 * const updatedRows = users.update(db, {
 *   set: { status: "active" },
 *   where: [{ id: 42 }],
 *   return: ["id", "status"]
 * });
 * const [row] = expect(updatedRows, 1, new Error("Expected one updated row"));
 *
 * Documentation note: this comment is shared with the different SQMap APIs.
 */
export function expect<TRow>(queryResult: Array<TRow>, rowCount: number, error: Error): TRow[] {
  if (queryResult.length === rowCount) return queryResult;
  throw error;
}

/**
 * Assert that exactly one row exists in a Bun SQLite result array.
 *
 * Capabilities:
 * - Enforces a strict single-row result.
 * - Throws the provided `error` if zero or multiple rows are returned.
 * - Returns the single typed row on success.
 *
 * @example
 * // Simple: load one user by id
 * const rows = users.select(db, { cols: ["id", "email"], where: [{ id: 1 }] });
 * const user = expectOne(rows, new Error("User not found"));
 *
 * @example
 * // Advanced: create-and-return exactly one row
 * const createdRows = users.insert(db, {
 *   cols: ["email", "status"],
 *   rows: [{ email: "new@example.com", status: "active" }],
 *   return: ["id", "email", "status"]
 * });
 * const row = expectOne(createdRows, new Error("Insert did not return exactly one row"));
 *
 * Documentation note: this comment is shared with the different SQMap APIs.
 */
export function expectOne<TRow>(queryResult: Array<TRow>, error: Error): TRow {
  if (queryResult.length === 1) return queryResult[0];
  throw error;
}
