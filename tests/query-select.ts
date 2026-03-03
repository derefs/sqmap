import { assertSQL, assertThrows, createSQLHelpers, runCases, runCasesForFixtures, type TestCase } from "./helpers.js";
import { MODEL_FIXTURES, PRIMARY_MODEL, Status, type ModelFixture } from "./model-user.js";

function selectCases(fixture: ModelFixture): TestCase[] {
  const h = createSQLHelpers(fixture.format);

  return [
    {
      name: "basic select with explicit columns",
      run: () => {
        const result = fixture.db.select({ cols: ["id", "email"] });
        assertSQL(
          result,
          `SELECT ${h.q("id")}, ${h.q("email")} FROM ${h.table(fixture.schema, fixture.table)};`,
          [],
          "basic select with explicit columns"
        );
      }
    },
    {
      name: "select with wildcard",
      run: () => {
        const result = fixture.db.select({ cols: ["*"] });
        assertSQL(
          result,
          `SELECT * FROM ${h.table(fixture.schema, fixture.table)};`,
          [],
          "select with wildcard"
        );
      }
    },
    {
      name: "select with mixed explicit and wildcard columns",
      run: () => {
        const result = fixture.db.select({ cols: ["id", "*"] });
        assertSQL(
          result,
          `SELECT ${h.q("id")}, * FROM ${h.table(fixture.schema, fixture.table)};`,
          [],
          "select with mixed explicit and wildcard columns"
        );
      }
    },
    {
      name: "where object defaults",
      run: () => {
        const result = fixture.db.select({
          cols: ["id", "email"],
          where: [{ id: 1, email: "one@example.com" }]
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")}, ${h.q("email")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)} AND ${h.q("email")} = ${h.p(1)};`,
          [1, "one@example.com"],
          "where object defaults"
        );
      }
    },
    {
      name: "where object custom operator and between",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          where: [{ id: 10, email: "target@example.com" }, "!=", "OR"]
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} != ${h.p(0)} OR ${h.q("email")} != ${h.p(1)};`,
          [10, "target@example.com"],
          "where object custom operator and between"
        );
      }
    },
    {
      name: "tokenized where with OR",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          where: [["email", "=", "hello@example.com"], "OR", ["id", "=", 5]]
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("email")} = ${h.p(0)} OR ${h.q("id")} = ${h.p(1)};`,
          ["hello@example.com", 5],
          "tokenized where with OR"
        );
      }
    },
    {
      name: "tokenized where with NOT",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          where: ["NOT", ["email", "=", "admin@example.com"]] as any
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE NOT ${h.q("email")} = ${h.p(0)};`,
          ["admin@example.com"],
          "tokenized where with NOT"
        );
      }
    },
    {
      name: "where normalization trims leading AND",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          where: ["AND", ["id", "=", 3]] as any
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)};`,
          [3],
          "where normalization trims leading AND"
        );
      }
    },
    {
      name: "where normalization trims leading OR",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          where: ["OR", ["id", "=", 7]] as any
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)};`,
          [7],
          "where normalization trims leading OR"
        );
      }
    },
    {
      name: "where normalization trims trailing OR",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          where: [["id", "=", 3], "OR"] as any
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)};`,
          [3],
          "where normalization trims trailing OR"
        );
      }
    },
    {
      name: "where normalization trims trailing NOT",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          where: [["id", "=", 3], "AND", "NOT"] as any
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)};`,
          [3],
          "where normalization trims trailing NOT"
        );
      }
    },
    {
      name: "empty where array resolves to no WHERE",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          where: [] as any
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)};`,
          [],
          "empty where array resolves to no WHERE"
        );
      }
    },
    {
      name: "IN with multiple values",
      run: () => {
        const result = fixture.db.select({
          cols: ["email"],
          in: [["status", "IN", [Status.Active, Status.Banned]]]
        });

        assertSQL(
          result,
          `SELECT ${h.q("email")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("status")} IN (${h.p(0)}, ${h.p(1)});`,
          [Status.Active, Status.Banned],
          "IN with multiple values"
        );
      }
    },
    {
      name: "NOT IN with one value",
      run: () => {
        const result = fixture.db.select({
          cols: ["email"],
          in: [["status", "NOT IN", [Status.Deleted]]]
        });

        assertSQL(
          result,
          `SELECT ${h.q("email")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("status")} NOT IN (${h.p(0)});`,
          [Status.Deleted],
          "NOT IN with one value"
        );
      }
    },
    {
      name: "tokenized IN expression",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          in: [["status", "IN", [Status.Active]], "OR", ["status", "NOT IN", [Status.Deleted]]]
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("status")} IN (${h.p(0)}) OR ${h.q("status")} NOT IN (${h.p(1)});`,
          [Status.Active, Status.Deleted],
          "tokenized IN expression"
        );
      }
    },
    {
      name: "tokenized IN with NOT prefix",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          in: ["NOT", ["status", "IN", [Status.Active]]] as any
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE NOT ${h.q("status")} IN (${h.p(0)});`,
          [Status.Active],
          "tokenized IN with NOT prefix"
        );
      }
    },
    {
      name: "LIKE operator",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          like: [["email", "LIKE", "a%"]]
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("email")} LIKE ${h.p(0)};`,
          ["a%"],
          "LIKE operator"
        );
      }
    },
    {
      name: "NOT LIKE operator",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          like: [["email", "NOT LIKE", "a%"]]
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("email")} NOT LIKE ${h.p(0)};`,
          ["a%"],
          "NOT LIKE operator"
        );
      }
    },
    {
      name: "ILIKE operator",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          like: [["email", "ILIKE", "A%"]]
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("email")} ILIKE ${h.p(0)};`,
          ["A%"],
          "ILIKE operator"
        );
      }
    },
    {
      name: "NOT ILIKE operator",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          like: [["email", "NOT ILIKE", "A%"]]
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("email")} NOT ILIKE ${h.p(0)};`,
          ["A%"],
          "NOT ILIKE operator"
        );
      }
    },
    {
      name: "tokenized LIKE expression",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          like: [["email", "LIKE", "a%"], "OR", ["email", "ILIKE", "b%"]]
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("email")} LIKE ${h.p(0)} OR ${h.q("email")} ILIKE ${h.p(1)};`,
          ["a%", "b%"],
          "tokenized LIKE expression"
        );
      }
    },
    {
      name: "tokenized LIKE with NOT prefix",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          like: ["NOT", ["email", "LIKE", "a%"]] as any
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE NOT ${h.q("email")} LIKE ${h.p(0)};`,
          ["a%"],
          "tokenized LIKE with NOT prefix"
        );
      }
    },
    {
      name: "combined where in like with default between",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          where: [{ id: 42 }],
          in: [["status", "IN", [Status.Active]]],
          like: [["email", "LIKE", "user%"]]
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)} AND ${h.q("status")} IN (${h.p(1)}) AND ${h.q("email")} LIKE ${h.p(2)};`,
          [42, Status.Active, "user%"],
          "combined where in like with default between"
        );
      }
    },
    {
      name: "combined where in like with OR between",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          where: [{ id: 42 }],
          in: [["status", "IN", [Status.Active]]],
          like: [["email", "LIKE", "user%"]],
          between: "OR"
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)} OR ${h.q("status")} IN (${h.p(1)}) OR ${h.q("email")} LIKE ${h.p(2)};`,
          [42, Status.Active, "user%"],
          "combined where in like with OR between"
        );
      }
    },
    {
      name: "combined in and like with OR between and no where",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          in: [["status", "IN", [Status.Active]]],
          like: [["email", "LIKE", "user%"]],
          between: "OR"
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("status")} IN (${h.p(0)}) OR ${h.q("email")} LIKE ${h.p(1)};`,
          [Status.Active, "user%"],
          "combined in and like with OR between and no where"
        );
      }
    },
    {
      name: "order asc",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          order: { by: "id", type: "ASC" }
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} ORDER BY ${h.q("id")} ASC;`,
          [],
          "order asc"
        );
      }
    },
    {
      name: "order desc",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          order: { by: "created", type: "DESC" }
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} ORDER BY ${h.q("created")} DESC;`,
          [],
          "order desc"
        );
      }
    },
    {
      name: "shift limit only",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          shift: { limit: 10, offset: null }
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} LIMIT ${h.p(0)};`,
          [10],
          "shift limit only"
        );
      }
    },
    {
      name: "shift offset only",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          shift: { limit: null, offset: 5 }
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} OFFSET ${h.p(0)};`,
          [5],
          "shift offset only"
        );
      }
    },
    {
      name: "shift limit and offset",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          shift: { limit: 10, offset: 5 }
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} LIMIT ${h.p(0)} OFFSET ${h.p(1)};`,
          [10, 5],
          "shift limit and offset"
        );
      }
    },
    {
      name: "order with shift",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          order: { by: "id", type: "DESC" },
          shift: { limit: 2, offset: 1 }
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} ORDER BY ${h.q("id")} DESC LIMIT ${h.p(0)} OFFSET ${h.p(1)};`,
          [2, 1],
          "order with shift"
        );
      }
    },
    {
      name: "shift null limit and offset keeps current spacing behavior",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          shift: { limit: null, offset: null }
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)} ;`,
          [],
          "shift null limit and offset keeps current spacing behavior"
        );
      }
    },
    {
      name: "schema override",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          schema: "other"
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table("other", fixture.table)};`,
          [],
          "schema override"
        );
      }
    },
    {
      name: "schema null",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          schema: null
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(null, fixture.table)};`,
          [],
          "schema null"
        );
      }
    },
    {
      name: "schema empty string falls back to default schema",
      run: () => {
        const result = fixture.db.select({
          cols: ["id"],
          schema: "" as any
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(fixture.schema, fixture.table)};`,
          [],
          "schema empty string falls back to default schema"
        );
      }
    }
  ];
}

export function runSelectTests(): void {
  runCasesForFixtures("select", MODEL_FIXTURES, selectCases);

  const h = createSQLHelpers(PRIMARY_MODEL.format);

  runCases("select/guards", [
    {
      name: "errors when select columns are empty",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({ cols: [] }),
          /No columns provided for the select statement!/i,
          "errors when select columns are empty"
        );
      }
    },
    {
      name: "invalid where token throws",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({
            cols: ["id"],
            where: [["id", "=", 1], "XOR", ["email", "=", "x@example.com"]] as any
          }),
          /Invalid boolean expression token "XOR"/i,
          "invalid where token throws"
        );
      }
    },
    {
      name: "consecutive where operators throw near operator",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({
            cols: ["id"],
            where: [["id", "=", 1], "AND", "OR", ["email", "=", "x@example.com"]] as any
          }),
          /Invalid boolean expression near "OR"/i,
          "consecutive where operators throw near operator"
        );
      }
    },
    {
      name: "invalid in token throws",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({
            cols: ["id"],
            in: [["status", "IN", [Status.Active]], "XOR", ["status", "NOT IN", [Status.Deleted]]] as any
          }),
          /Invalid boolean expression token "XOR"/i,
          "invalid in token throws"
        );
      }
    },
    {
      name: "consecutive in operators throw near operator",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({
            cols: ["id"],
            in: [["status", "IN", [Status.Active]], "OR", "AND", ["status", "IN", [Status.Banned]]] as any
          }),
          /Invalid boolean expression near "AND"/i,
          "consecutive in operators throw near operator"
        );
      }
    },
    {
      name: "invalid like token throws",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({
            cols: ["id"],
            like: [["email", "LIKE", "x%"], "XOR", ["email", "ILIKE", "y%"]] as any
          }),
          /Invalid boolean expression token "XOR"/i,
          "invalid like token throws"
        );
      }
    },
    {
      name: "consecutive like operators throw near operator",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({
            cols: ["id"],
            like: [["email", "LIKE", "x%"], "OR", "AND", ["email", "ILIKE", "y%"]] as any
          }),
          /Invalid boolean expression near "AND"/i,
          "consecutive like operators throw near operator"
        );
      }
    },
    {
      name: "missing logical operator between where predicates throws",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({
            cols: ["id"],
            where: [["id", "=", 1], ["email", "=", "a@example.com"]] as any
          }),
          /missing logical operator between predicates/i,
          "missing logical operator between where predicates throws"
        );
      }
    },
    {
      name: "missing logical operator between in predicates throws",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({
            cols: ["id"],
            in: [["status", "IN", [Status.Active]], ["status", "IN", [Status.Banned]]] as any
          }),
          /missing logical operator between predicates/i,
          "missing logical operator between in predicates throws"
        );
      }
    },
    {
      name: "missing logical operator between like predicates throws",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({
            cols: ["id"],
            like: [["email", "LIKE", "x%"], ["email", "ILIKE", "y%"]] as any
          }),
          /missing logical operator between predicates/i,
          "missing logical operator between like predicates throws"
        );
      }
    },
    {
      name: "invalid NOT placement throws",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({
            cols: ["id"],
            where: [["id", "=", 1], "NOT", ["email", "=", "a@example.com"]] as any
          }),
          /Invalid boolean expression near "NOT"/i,
          "invalid NOT placement throws"
        );
      }
    },
    {
      name: "invalid NOT placement in IN throws",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({
            cols: ["id"],
            in: [["status", "IN", [Status.Active]], "NOT", ["status", "IN", [Status.Banned]]] as any
          }),
          /Invalid boolean expression near "NOT"/i,
          "invalid NOT placement in IN throws"
        );
      }
    },
    {
      name: "invalid NOT placement in LIKE throws",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({
            cols: ["id"],
            like: [["email", "LIKE", "x%"], "NOT", ["email", "ILIKE", "y%"]] as any
          }),
          /Invalid boolean expression near "NOT"/i,
          "invalid NOT placement in LIKE throws"
        );
      }
    },
    {
      name: "IN predicate with empty values throws",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.select({
            cols: ["id"],
            in: [["status", "IN", []]]
          }),
          /IN operator requires at least one value/i,
          "IN predicate with empty values throws"
        );
      }
    },
    {
      name: "token-only where resolves to no WHERE",
      run: () => {
        const result = PRIMARY_MODEL.db.select({
          cols: ["id"],
          where: ["AND", "OR", "NOT"] as any
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(PRIMARY_MODEL.schema, PRIMARY_MODEL.table)};`,
          [],
          "token-only where resolves to no WHERE"
        );
      }
    },
    {
      name: "token-only in resolves to no WHERE",
      run: () => {
        const result = PRIMARY_MODEL.db.select({
          cols: ["id"],
          in: ["AND", "OR", "NOT"] as any
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(PRIMARY_MODEL.schema, PRIMARY_MODEL.table)};`,
          [],
          "token-only in resolves to no WHERE"
        );
      }
    },
    {
      name: "token-only like resolves to no WHERE",
      run: () => {
        const result = PRIMARY_MODEL.db.select({
          cols: ["id"],
          like: ["AND", "OR", "NOT"] as any
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(PRIMARY_MODEL.schema, PRIMARY_MODEL.table)};`,
          [],
          "token-only like resolves to no WHERE"
        );
      }
    },
    {
      name: "empty in array resolves to no WHERE",
      run: () => {
        const result = PRIMARY_MODEL.db.select({
          cols: ["id"],
          in: []
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(PRIMARY_MODEL.schema, PRIMARY_MODEL.table)};`,
          [],
          "empty in array resolves to no WHERE"
        );
      }
    },
    {
      name: "empty like array resolves to no WHERE",
      run: () => {
        const result = PRIMARY_MODEL.db.select({
          cols: ["id"],
          like: []
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(PRIMARY_MODEL.schema, PRIMARY_MODEL.table)};`,
          [],
          "empty like array resolves to no WHERE"
        );
      }
    },
    {
      name: "negative shift keeps current spacing behavior",
      run: () => {
        const result = PRIMARY_MODEL.db.select({
          cols: ["id"],
          shift: { limit: -1, offset: -1 }
        });

        assertSQL(
          result,
          `SELECT ${h.q("id")} FROM ${h.table(PRIMARY_MODEL.schema, PRIMARY_MODEL.table)} ;`,
          [],
          "negative shift keeps current spacing behavior"
        );
      }
    }
  ]);
}
