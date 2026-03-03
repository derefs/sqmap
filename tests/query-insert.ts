import { assertSQL, assertThrows, createSQLHelpers, runCases, runCasesForFixtures, type TestCase } from "./helpers.js";
import { MODEL_FIXTURES, PRIMARY_MODEL, Status, type ModelFixture } from "./model-user.js";

function insertCases(fixture: ModelFixture): TestCase[] {
  const h = createSQLHelpers(fixture.format);

  return [
    {
      name: "single row basic insert",
      run: () => {
        const result = fixture.db.insert({
          cols: ["email"],
          rows: [{ email: "one@example.com" }]
        });

        assertSQL(
          result,
          `INSERT INTO ${h.table(fixture.schema, fixture.table)} (${h.q("email")}) VALUES (${h.p(0)});`,
          ["one@example.com"],
          "single row basic insert"
        );
      }
    },
    {
      name: "multi-column insert ignores extra keys",
      run: () => {
        const result = fixture.db.insert({
          cols: ["status", "email"],
          rows: [{
            status: Status.Active,
            email: "extra@example.com",
            password: "ignored"
          }]
        });

        assertSQL(
          result,
          `INSERT INTO ${h.table(fixture.schema, fixture.table)} (${h.q("status")}, ${h.q("email")}) VALUES (${h.p(0)}, ${h.p(1)});`,
          [Status.Active, "extra@example.com"],
          "multi-column insert ignores extra keys"
        );
      }
    },
    {
      name: "missing column values become undefined",
      run: () => {
        const result = fixture.db.insert({
          cols: ["status", "username", "email"],
          rows: [{
            status: Status.Banned,
            email: "missing-username@example.com"
          }]
        });

        assertSQL(
          result,
          `INSERT INTO ${h.table(fixture.schema, fixture.table)} (${h.q("status")}, ${h.q("username")}, ${h.q("email")}) VALUES (${h.p(0)}, ${h.p(1)}, ${h.p(2)});`,
          [Status.Banned, undefined, "missing-username@example.com"],
          "missing column values become undefined"
        );
      }
    },
    {
      name: "multi-row insert placeholder progression",
      run: () => {
        const result = fixture.db.insert({
          cols: ["status", "email"],
          rows: [
            { status: Status.Active, email: "a@example.com" },
            { status: Status.Deactivated, email: "b@example.com" }
          ]
        });

        assertSQL(
          result,
          `INSERT INTO ${h.table(fixture.schema, fixture.table)} (${h.q("status")}, ${h.q("email")}) VALUES (${h.p(0)}, ${h.p(1)}), (${h.p(2)}, ${h.p(3)});`,
          [Status.Active, "a@example.com", Status.Deactivated, "b@example.com"],
          "multi-row insert placeholder progression"
        );
      }
    },
    {
      name: "column order drives params independent of row key order",
      run: () => {
        const result = fixture.db.insert({
          cols: ["email", "status"],
          rows: [{
            status: Status.Active,
            email: "ordered@example.com"
          }]
        });

        assertSQL(
          result,
          `INSERT INTO ${h.table(fixture.schema, fixture.table)} (${h.q("email")}, ${h.q("status")}) VALUES (${h.p(0)}, ${h.p(1)});`,
          ["ordered@example.com", Status.Active],
          "column order drives params independent of row key order"
        );
      }
    },
    {
      name: "insert supports mixed primitive and date params",
      run: () => {
        const verifiedAt = new Date("2024-01-01T00:00:00.000Z");
        const result = fixture.db.insert({
          cols: ["email", "verified_at", "stripe_id"],
          rows: [{
            email: "mixed@example.com",
            verified_at: verifiedAt,
            stripe_id: null as any
          }]
        });

        assertSQL(
          result,
          `INSERT INTO ${h.table(fixture.schema, fixture.table)} (${h.q("email")}, ${h.q("verified_at")}, ${h.q("stripe_id")}) VALUES (${h.p(0)}, ${h.p(1)}, ${h.p(2)});`,
          ["mixed@example.com", verifiedAt, null],
          "insert supports mixed primitive and date params"
        );
      }
    },
    {
      name: "return star",
      run: () => {
        const result = fixture.db.insert({
          cols: ["email"],
          rows: [{ email: "star@example.com" }],
          return: "*"
        });

        assertSQL(
          result,
          `INSERT INTO ${h.table(fixture.schema, fixture.table)} (${h.q("email")}) VALUES (${h.p(0)}) RETURNING *;`,
          ["star@example.com"],
          "return star"
        );
      }
    },
    {
      name: "return selected columns",
      run: () => {
        const result = fixture.db.insert({
          cols: ["email", "status"],
          rows: [{ email: "return@example.com", status: Status.Active }],
          return: ["id", "email"]
        });

        assertSQL(
          result,
          `INSERT INTO ${h.table(fixture.schema, fixture.table)} (${h.q("email")}, ${h.q("status")}) VALUES (${h.p(0)}, ${h.p(1)}) RETURNING ${h.q("id")}, ${h.q("email")};`,
          ["return@example.com", Status.Active],
          "return selected columns"
        );
      }
    },
    {
      name: "multi-row insert with returning columns",
      run: () => {
        const result = fixture.db.insert({
          cols: ["email", "status"],
          rows: [
            { email: "first@example.com", status: Status.Active },
            { email: "second@example.com", status: Status.Banned }
          ],
          return: ["id", "email"]
        });

        assertSQL(
          result,
          `INSERT INTO ${h.table(fixture.schema, fixture.table)} (${h.q("email")}, ${h.q("status")}) VALUES (${h.p(0)}, ${h.p(1)}), (${h.p(2)}, ${h.p(3)}) RETURNING ${h.q("id")}, ${h.q("email")};`,
          ["first@example.com", Status.Active, "second@example.com", Status.Banned],
          "multi-row insert with returning columns"
        );
      }
    },
    {
      name: "empty return array omits returning",
      run: () => {
        const result = fixture.db.insert({
          cols: ["email"],
          rows: [{ email: "no-return@example.com" }],
          return: []
        });

        assertSQL(
          result,
          `INSERT INTO ${h.table(fixture.schema, fixture.table)} (${h.q("email")}) VALUES (${h.p(0)});`,
          ["no-return@example.com"],
          "empty return array omits returning"
        );
      }
    },
    {
      name: "schema override",
      run: () => {
        const result = fixture.db.insert({
          cols: ["email"],
          rows: [{ email: "override@example.com" }],
          schema: "other"
        });

        assertSQL(
          result,
          `INSERT INTO ${h.table("other", fixture.table)} (${h.q("email")}) VALUES (${h.p(0)});`,
          ["override@example.com"],
          "schema override"
        );
      }
    },
    {
      name: "schema null removes schema prefix",
      run: () => {
        const result = fixture.db.insert({
          cols: ["email"],
          rows: [{ email: "noschema@example.com" }],
          schema: null
        });

        assertSQL(
          result,
          `INSERT INTO ${h.table(null, fixture.table)} (${h.q("email")}) VALUES (${h.p(0)});`,
          ["noschema@example.com"],
          "schema null removes schema prefix"
        );
      }
    },
    {
      name: "schema empty string falls back to default schema",
      run: () => {
        const result = fixture.db.insert({
          cols: ["email"],
          rows: [{ email: "fallback@example.com" }],
          schema: "" as any
        });

        assertSQL(
          result,
          `INSERT INTO ${h.table(fixture.schema, fixture.table)} (${h.q("email")}) VALUES (${h.p(0)});`,
          ["fallback@example.com"],
          "schema empty string falls back to default schema"
        );
      }
    }
  ];
}

export function runInsertTests(): void {
  runCasesForFixtures("insert", MODEL_FIXTURES, insertCases);

  runCases("insert/guards", [
    {
      name: "errors when cols are missing",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.insert({ cols: [], rows: [{ email: "x@example.com" }] }),
          /No columns provided for the insert statement!/i,
          "errors when cols are missing"
        );
      }
    },
    {
      name: "errors when rows are missing",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.insert({ cols: ["email"], rows: [] }),
          /No rows provided for the insert statement!/i,
          "errors when rows are missing"
        );
      }
    },
    {
      name: "missing cols and rows throws missing cols first",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.insert({ cols: [], rows: [] }),
          /No columns provided for the insert statement!/i,
          "missing cols and rows throws missing cols first"
        );
      }
    }
  ]);
}
