# SQMap
A lightweight and easy to use micro ORM for Node/TypeScript.

SQMap does not try to replace SQL. It gives you a thin, typed layer for common query patterns while keeping SQL generation explicit and predictable.

## Supported databases
- Core query builder (`sqmap`): DB-agnostic SQL + params generation.
- PostgreSQL adapter (`sqmap/postgres-pg`): executes generated SQL with `pg`.
- SQLite adapter (`sqmap/sqlite-bun`): executes generated SQL with Bun's `bun:sqlite`.

## Install
```bash
npm i sqmap
```

## WARNING: trusted identifiers only
SQMap parameterizes values, but SQL identifiers (table names, schema names, column names) are interpolated into query strings.

DO NOT pass untrusted user input as identifiers.

Only use identifiers that come from trusted, static application code.

## Models
Define one row interface per table, then generate a typed API.

```ts
import * as SQM from "sqmap";

export interface UserRow {
  id?: number;
  created?: Date;
  updated?: Date;
  status?: "active" | "banned" | "deactivated";
  username?: string;
  email?: string;
}

// tableName, defaultSchema, format
export const users = SQM.genAPI<UserRow>("users", "app", SQM.FORMATS.POSTGRES_PG);
```

Built-in formats:
- `SQM.FORMATS.POSTGRES_PG`
- `SQM.FORMATS.SQLITE_BUN`

`genAPI` returns SQL only:

```ts
interface SQLData {
  query: string;
  params: any[];
}
```

## Insert queries
```ts
const sql = users.insert({
  cols: ["status", "username", "email"],
  rows: [{
    status: "active",
    email: "one@example.com",
    password: "ignored" as any
  }],
  return: ["id", "email"]
});

console.log(sql.query);
console.log(sql.params);
```

Generated SQL and params:

```sql
INSERT INTO "app"."users" ("status", "username", "email") VALUES ($1, $2, $3) RETURNING "id", "email";
```

```ts
["active", undefined, "one@example.com"]
```

Notes:
- `cols` controls both generated columns and param order.
- Extra keys in `rows` are ignored.
- Missing values in selected `cols` become `undefined`.
- Multi-row insert is supported.
- `return: "*"` and `return: ["colA", "colB"]` are supported.
- `return: []` omits `RETURNING`.
- `cols` and `rows` must both be non-empty.

## Select queries
```ts
const sql = users.select({
  distinct: true,
  cols: ["id", "email"],
  where: [{ id: 42 }],
  in: [["status", "IN", ["active", "banned"]]],
  like: [["email", "ILIKE", "user%"]],
  order: { by: "id", type: "DESC" },
  shift: { limit: 10, offset: 20 }
});
```

Generated SQL:

```sql
SELECT DISTINCT "id", "email" FROM "app"."users" WHERE "id" = $1 AND "status" IN ($2, $3) AND "email" ILIKE $4 ORDER BY "id" DESC LIMIT $5 OFFSET $6;
```

```ts
[42, "active", "banned", "user%", 10, 20]
```

Capabilities:
- `cols` supports explicit columns and `"*"`.
- `distinct`: emits `SELECT DISTINCT ...` when enabled.
- `where` supports:
  - Comparison operators: `=`, `<`, `>`, `>=`, `<=`, `!=`
  - Object form: `[{ id: 1, email: "x@x.com" }, "!=", "OR"]`
  - Object defaults: operator `=` and predicate join `AND` when omitted
  - Object null rewrite: `[{ verified_at: null, id: 7 }]` becomes `"verified_at" IS NULL AND "id" = $1`
  - Tokenized form: `[["id", "=", 1], "OR", "NOT", ["email", "=", "x@x.com"]]`
  - Tokenized null rewrite: `[["verified_at", "=", null], "OR", ["stripe_id", "!=", null]]` becomes `IS NULL` / `IS NOT NULL`
- `in`: `IN` and `NOT IN`
- `like`: `LIKE`, `NOT LIKE`, `ILIKE`, `NOT ILIKE`
- `between`: controls how `where`, `in`, and `like` groups are joined (`AND` default, or `OR`). It does not change tokenized logic inside each group.
- `order`: `ASC` or `DESC`
- `shift`: `LIMIT` / `OFFSET` (`null` and negative values are ignored, limit-only and offset-only are both supported)

Note:
- Null rewrite applies to both object and tokenized `where` predicates for `=` and `!=` only.

## Update queries
```ts
const sql = users.update({
  set: { status: "deactivated" },
  where: [{ id: 42 }],
  in: [["status", "IN", ["active", "banned"]]],
  like: [["email", "ILIKE", "user%"]],
  between: "OR",
  return: ["id", "status"]
});
```

Generated SQL:

```sql
UPDATE "app"."users" SET "status" = $1 WHERE "id" = $2 OR "status" IN ($3, $4) OR "email" ILIKE $5 RETURNING "id", "status";
```

```ts
["deactivated", 42, "active", "banned", "user%"]
```

Rules:
- `set` must be non-empty.
- At least one filter key is required (`where`, `in`, or `like`).
- At least one non-empty filter group is required after parsing (`where`, `in`, or `like`).
- `return` works like insert.
- `return: []` omits `RETURNING`.
- Using only empty/token-only filter arrays throws.

## Delete queries
```ts
const sql = users.delete({
  where: [{ id: 42 }],
  in: [["status", "IN", ["deactivated"]]],
  like: [["email", "LIKE", "user%"]],
  return: "*"
});
```

Generated SQL:

```sql
DELETE FROM "app"."users" WHERE "id" = $1 AND "status" IN ($2) AND "email" LIKE $3 RETURNING *;
```

```ts
[42, "deactivated", "user%"]
```

Rules:
- At least one filter key is required (`where`, `in`, or `like`).
- At least one non-empty filter group is required after parsing (`where`, `in`, or `like`).
- `return` supports `"*"` or selected columns.
- `return: []` omits `RETURNING`.
- Using only empty/token-only filter arrays throws.

## Schema behavior
Each query supports `schema?: string | null`:
- Omitted: use default schema from `genAPI(...)`.
- String value: override schema for that query.
- `null`: remove schema prefix entirely.
- Empty string: falls back to default schema.

## Boolean expression behavior
For tokenized `where` / `in` / `like` arrays:
- Allowed tokens: `AND`, `OR`, `NOT`.
- Leading `AND`/`OR` and trailing `AND`/`OR`/`NOT` are normalized away.
- Invalid tokens, missing logical operators, invalid `NOT` placement, and consecutive operators throw.
- `IN` predicates require at least one value.

Behavior differences:
- `select` tolerates token-only/empty filter arrays by emitting no `WHERE`.
- `update` and `delete` reject token-only/empty filters when they resolve to no predicates (safety guard).

## Adapters
### PostgreSQL (`pg`)
```ts
import { Pool } from "pg";
import { genPostgresPGAPI, expectOne } from "sqmap/postgres-pg";

interface UserRow {
  id?: number;
  email?: string;
}

const pool = new Pool();
const users = genPostgresPGAPI<UserRow>("users", "app"); // optional third arg: custom format
const client = await pool.connect();

try {
  const result = await users.select(client, {
    cols: ["id", "email"],
    where: [{ id: 1 }]
  });

  const user = expectOne(result, new Error("User not found"));
  console.log(user.email);
} finally {
  client.release();
}
```

### SQLite (Bun)
```ts
import { Database } from "bun:sqlite";
import { genSQLiteBunAPI, expect } from "sqmap/sqlite-bun";

interface UserRow {
  id?: number;
  email?: string;
}

const db = new Database(":memory:");
const users = genSQLiteBunAPI<UserRow>("users"); // optional second arg: custom format

const rows = users.select(db, { cols: ["id", "email"] });
const exactlyTwo = expect(rows, 2, new Error("Expected 2 users"));
```

Both adapters also expose:
- `sql(...)`: run raw SQL with params
- `expect(...)`: assert exact row count
- `expectOne(...)`: assert exactly one row

Adapter notes:
- `genPostgresPGAPI` accepts `(tableName, schema, format?)`.
- `genSQLiteBunAPI` accepts `(tableName, format?)` and always generates SQL without schema prefix.

## Custom format (placeholders + quoting)
You can provide your own `Format`:

```ts
import * as SQM from "sqmap";

const customFormat: SQM.Format = {
  paramsPrefix: "?",
  paramsStartIndex: 0,
  paramsAppendIndex: false,
  quotingChar: "`"
};

const users = SQM.genAPI<{ id?: number }>("users", "app", customFormat);
const sql = users.select({ cols: ["id"], where: [{ id: 7 }] });

console.log(sql.query);
// SELECT `id` FROM `app`.`users` WHERE `id` = ?;
```