import { PoolClient, QueryResult, QueryResultRow } from "pg";
import * as SQM from "../sqmap.js";

export interface SQMPostgresPGAPI<TCol, TRow extends QueryResultRow> {
  /**
   * Insert one or more rows and execute the generated SQL with `pg`.
   *
   * Capabilities:
   * - Single-row and multi-row insert.
   * - `cols` controls SQL column order and parameter order.
   * - Extra row keys are ignored.
   * - Missing values for selected columns become `undefined`.
   * - `return` supports `"*"` and selected columns.
   * - `return: []` omits `RETURNING`.
   * - Supports per-query schema override via `query.schema`.
   *
   * @example
   * // Simple: single-row insert
   * const result = await users.insert(client, {
   *   cols: ["email"],
   *   rows: [{ email: "one@example.com" }]
   * });
   *
   * @example
   * // Advanced: multi-row insert with returning and schema override
   * const result = await users.insert(client, {
   *   cols: ["status", "email"],
   *   rows: [
   *     { status: "active", email: "first@example.com", ignored: "x" as any },
   *     { status: "banned", email: "second@example.com" }
   *   ],
   *   return: ["id", "email"],
   *   schema: "audit"
   * });
   *
   * Documentation note: this comment is shared with the different SQMap APIs.
   */
  insert:    (client: PoolClient, query: SQM.InsertQueryParams<TCol, TRow>) => Promise<QueryResult<TRow>>;
  /**
   * Select rows and execute the generated SQL with `pg`.
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
   * - Supports per-query schema override via `query.schema`.
   * - Empty/token-only filter arrays resolve to no `WHERE`.
   *
   * @example
   * // Simple: select by id
   * const result = await users.select(client, {
   *   cols: ["id", "email"],
   *   where: [{ id: 1 }]
   * });
   *
   * @example
   * // Advanced: distinct + tokenized filters + ordering + paging
   * const result = await users.select(client, {
   *   distinct: true,
   *   cols: ["id", "email"],
   *   where: [["verified_at", "=", null], "OR", ["status", "=", "active"]] as any,
   *   in: [["status", "IN", ["active", "banned"]]],
   *   like: [["email", "ILIKE", "user%"]],
   *   between: "OR",
   *   order: { by: "id", type: "DESC" },
   *   shift: { limit: 50, offset: 100 },
   *   schema: "app"
   * });
   *
   * Documentation note: this comment is shared with the different SQMap APIs.
   */
  select:    (client: PoolClient, query: SQM.SelectQueryParams<TCol, TRow>) => Promise<QueryResult<TRow>>;
  /**
   * Update rows and execute the generated SQL with `pg`.
   *
   * Capabilities:
   * - Supports single and multi-column `set`.
   * - Supports `where`, `in`, and `like` filters.
   * - `between` joins `where`/`in`/`like` groups (`AND` default, `OR` optional).
   * - `where` null rewrite for `=`/`!=` to `IS NULL`/`IS NOT NULL`.
   * - `return` supports `"*"` and selected columns.
   * - `return: []` omits `RETURNING`.
   * - Supports per-query schema override via `query.schema`.
   * - Guards: requires non-empty `set`, at least one filter key, and at least one resolved predicate.
   *
   * @example
   * // Simple: update one row by id
   * const result = await users.update(client, {
   *   set: { status: "deactivated" },
   *   where: [{ id: 42 }]
   * });
   *
   * @example
   * // Advanced: combine filter groups with OR and return selected columns
   * const result = await users.update(client, {
   *   set: { status: "banned", email: "blocked@example.com" },
   *   where: [["verified_at", "=", null], "OR", ["id", "=", 10]] as any,
   *   in: [["status", "IN", ["active", "deactivated"]]],
   *   like: [["email", "ILIKE", "user%"]],
   *   between: "OR",
   *   return: ["id", "email", "status"],
   *   schema: "app"
   * });
   *
   * Documentation note: this comment is shared with the different SQMap APIs.
   */
  update:    (client: PoolClient, query: SQM.UpdateQueryParams<TCol, TRow>) => Promise<QueryResult<TRow>>;
  /**
   * Delete rows and execute the generated SQL with `pg`.
   *
   * Capabilities:
   * - Supports `where`, `in`, and `like` filters.
   * - `between` joins `where`/`in`/`like` groups (`AND` default, `OR` optional).
   * - `where` null rewrite for `=`/`!=` to `IS NULL`/`IS NOT NULL`.
   * - `return` supports `"*"` and selected columns.
   * - `return: []` omits `RETURNING`.
   * - Supports per-query schema override via `query.schema`.
   * - Guards: requires at least one filter key and at least one resolved predicate.
   *
   * @example
   * // Simple: delete by id
   * const result = await users.delete(client, {
   *   where: [{ id: 42 }]
   * });
   *
   * @example
   * // Advanced: combine filters and return deleted rows
   * const result = await users.delete(client, {
   *   where: [["verified_at", "!=", null], "AND", ["status", "=", "deactivated"]] as any,
   *   in: [["id", "IN", [10, 11, 12]]],
   *   like: [["email", "ILIKE", "cleanup%"]],
   *   between: "OR",
   *   return: ["id", "email"],
   *   schema: "app_archive"
   * });
   *
   * Documentation note: this comment is shared with the different SQMap APIs.
   */
  delete:    (client: PoolClient, query: SQM.DeleteQueryParams<TCol, TRow>) => Promise<QueryResult<TRow>>;
  /**
   * Execute raw SQL with parameters using the provided `pg` client.
   *
   * Capabilities:
   * - Executes any SQL statement supported by PostgreSQL.
   * - Uses positional parameters from `params` as passed to `client.query`.
   * - Returns the native `QueryResult`.
   *
   * @example
   * // Simple: raw select
   * const result = await users.sql(client, "SELECT now() AS ts", []);
   *
   * @example
   * // Advanced: transactional update with parameters
   * await users.sql(client, "BEGIN", []);
   * await users.sql(
   *   client,
   *   'UPDATE "app"."users" SET "status" = $1 WHERE "id" = $2',
   *   ["active", 42]
   * );
   * await users.sql(client, "COMMIT", []);
   *
   * Documentation note: this comment is shared with the different SQMap APIs.
   */
  sql:       (client: PoolClient, query: string, params: any[])         => Promise<QueryResult<TRow | any>>;
}

export function genPostgresPGAPI<TRow extends QueryResultRow>(tableName: string, schema: string | null, format?: SQM.Format): SQMPostgresPGAPI<SQM.ExtractColsFromRow<TRow>, TRow> {
  const finalFormat = format ?? SQM.FORMATS.POSTGRES_PG;
  return {
    insert: (client: PoolClient, query: SQM.InsertQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Promise<QueryResult<TRow>> => {
      const finalSchema = query.schema === null ? null : query.schema || schema;
      const parsedQuery = SQM.parseInsertQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, finalFormat);
      let finalQuery = SQM.buildInsertQuery(finalSchema, tableName, parsedQuery, finalFormat.quotingChar);
      return client.query(finalQuery, parsedQuery.params);
    },
    select: (client: PoolClient, query: SQM.SelectQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Promise<QueryResult<TRow>> => {
      const finalSchema = query.schema === null ? null : query.schema || schema;
      const parsedQuery = SQM.parseSelectQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, finalFormat);
      let finalQuery = SQM.buildSelectQuery(finalSchema, tableName, parsedQuery, finalFormat.quotingChar, query.between);
      return client.query(finalQuery, parsedQuery.params);
    },
    update: (client: PoolClient, query: SQM.UpdateQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Promise<QueryResult<TRow>> => {
      const finalSchema = query.schema === null ? null : query.schema || schema;
      const parsedQuery = SQM.parseUpdateQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, finalFormat);
      let finalQuery = SQM.buildUpdateQuery(finalSchema, tableName, parsedQuery, finalFormat.quotingChar, query.between);
      return client.query(finalQuery, parsedQuery.params);
    },
    delete: (client: PoolClient, query: SQM.DeleteQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Promise<QueryResult<TRow>> => {
      const finalSchema = query.schema === null ? null : query.schema || schema;
      const parsedQuery = SQM.parseDeleteQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, finalFormat);
      let finalQuery = SQM.buildDeleteQuery(finalSchema, tableName, parsedQuery, finalFormat.quotingChar, query.between);
      return client.query(finalQuery, parsedQuery.params);
    },
    sql: (client: PoolClient, query: string, params: any[]): Promise<QueryResult<TRow | any>> => {
      return client.query(query, params);
    },
  };
}

/**
 * Assert an exact row count for a PostgreSQL `QueryResult` and return the rows.
 *
 * Capabilities:
 * - Verifies both `queryResult.rowCount` and `queryResult.rows.length`.
 * - Throws the provided `error` when the exact count does not match.
 * - Returns typed rows when the assertion passes.
 *
 * @example
 * // Simple: require exactly two rows
 * const rows = expect(result, 2, new Error("Expected exactly 2 rows"));
 *
 * @example
 * // Advanced: enforce a strict contract after a filtered update
 * const updated = await users.update(client, {
 *   set: { status: "active" },
 *   where: [{ id: 42 }],
 *   return: ["id", "status"]
 * });
 * const [row] = expect(updated, 1, new Error("Expected one updated row"));
 *
 * Documentation note: this comment is shared with the different SQMap APIs.
 */
export function expect<TRow extends QueryResultRow>(queryResult: QueryResult<TRow>, rowCount: number, error: Error): TRow[] {
  if (queryResult.rowCount === rowCount && queryResult.rows.length === rowCount) return queryResult.rows;
  throw error;
}

/**
 * Assert that exactly one row exists in a PostgreSQL `QueryResult`.
 *
 * Capabilities:
 * - Enforces a strict single-row result.
 * - Throws the provided `error` if zero or multiple rows are returned.
 * - Returns the single typed row on success.
 *
 * @example
 * // Simple: load one user by id
 * const result = await users.select(client, { cols: ["id", "email"], where: [{ id: 1 }] });
 * const user = expectOne(result, new Error("User not found"));
 *
 * @example
 * // Advanced: create-and-return exactly one row
 * const created = await users.insert(client, {
 *   cols: ["email", "status"],
 *   rows: [{ email: "new@example.com", status: "active" }],
 *   return: ["id", "email", "status"]
 * });
 * const row = expectOne(created, new Error("Insert did not return exactly one row"));
 *
 * Documentation note: this comment is shared with the different SQMap APIs.
 */
export function expectOne<TRow extends QueryResultRow>(queryResult: QueryResult<TRow>, error: Error): TRow {
  if (queryResult.rowCount === 1 && queryResult.rows.length === 1) return queryResult.rows[0];
  throw error;
}
