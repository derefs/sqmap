import { assertSQL, assertThrows, createSQLHelpers, runCases, runCasesForFixtures, type TestCase } from "./helpers.js";
import { MODEL_FIXTURES, PRIMARY_MODEL, Status, type ModelFixture } from "./model-user.js";

function deleteCases(fixture: ModelFixture): TestCase[] {
  const h = createSQLHelpers(fixture.format);

  return [
    {
      name: "basic delete with where object",
      run: () => {
        const result = fixture.db.delete({
          where: [{ id: 1 }]
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)};`,
          [1],
          "basic delete with where object"
        );
      }
    },
    {
      name: "delete with tokenized where expression",
      run: () => {
        const result = fixture.db.delete({
          where: [["id", "=", 1], "OR", ["email", "=", "one@example.com"]]
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)} OR ${h.q("email")} = ${h.p(1)};`,
          [1, "one@example.com"],
          "delete with tokenized where expression"
        );
      }
    },
    {
      name: "delete tokenized where rewrites null comparisons",
      run: () => {
        const result = fixture.db.delete({
          where: [["verified_at", "=", null], "OR", ["stripe_id", "!=", null]] as any
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("verified_at")} IS NULL OR ${h.q("stripe_id")} IS NOT NULL;`,
          [],
          "delete tokenized where rewrites null comparisons"
        );
      }
    },
    {
      name: "delete tokenized where null comparison keeps param progression",
      run: () => {
        const result = fixture.db.delete({
          where: [["verified_at", "=", null], "AND", ["id", "=", 77]] as any
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("verified_at")} IS NULL AND ${h.q("id")} = ${h.p(0)};`,
          [77],
          "delete tokenized where null comparison keeps param progression"
        );
      }
    },
    {
      name: "delete where object custom operator and between",
      run: () => {
        const result = fixture.db.delete({
          where: [{ id: 9, email: "archived@example.com" }, "!=", "OR"]
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} != ${h.p(0)} OR ${h.q("email")} != ${h.p(1)};`,
          [9, "archived@example.com"],
          "delete where object custom operator and between"
        );
      }
    },
    {
      name: "delete where object rewrites null comparisons",
      run: () => {
        const result = fixture.db.delete({
          where: [{ verified_at: null, id: 7 }] as any
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("verified_at")} IS NULL AND ${h.q("id")} = ${h.p(0)};`,
          [7],
          "delete where object rewrites null comparisons"
        );
      }
    },
    {
      name: "delete with IN only",
      run: () => {
        const result = fixture.db.delete({
          in: [["status", "IN", [Status.Active, Status.Banned]]]
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("status")} IN (${h.p(0)}, ${h.p(1)});`,
          [Status.Active, Status.Banned],
          "delete with IN only"
        );
      }
    },
    {
      name: "delete with tokenized IN and NOT prefix",
      run: () => {
        const result = fixture.db.delete({
          in: ["NOT", ["status", "IN", [Status.Active, Status.Banned]]] as any
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE NOT ${h.q("status")} IN (${h.p(0)}, ${h.p(1)});`,
          [Status.Active, Status.Banned],
          "delete with tokenized IN and NOT prefix"
        );
      }
    },
    {
      name: "delete with LIKE only",
      run: () => {
        const result = fixture.db.delete({
          like: [["email", "LIKE", "cleanup%"]]
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("email")} LIKE ${h.p(0)};`,
          ["cleanup%"],
          "delete with LIKE only"
        );
      }
    },
    {
      name: "delete with tokenized LIKE and NOT prefix",
      run: () => {
        const result = fixture.db.delete({
          like: ["NOT", ["email", "LIKE", "cleanup%"]] as any
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE NOT ${h.q("email")} LIKE ${h.p(0)};`,
          ["cleanup%"],
          "delete with tokenized LIKE and NOT prefix"
        );
      }
    },
    {
      name: "delete with where in like default between",
      run: () => {
        const result = fixture.db.delete({
          where: [{ id: 5 }],
          in: [["status", "IN", [Status.Active]]],
          like: [["email", "ILIKE", "x%"]]
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)} AND ${h.q("status")} IN (${h.p(1)}) AND ${h.q("email")} ILIKE ${h.p(2)};`,
          [5, Status.Active, "x%"],
          "delete with where in like default between"
        );
      }
    },
    {
      name: "delete with where in like OR between",
      run: () => {
        const result = fixture.db.delete({
          where: [{ id: 5 }],
          in: [["status", "IN", [Status.Active]]],
          like: [["email", "ILIKE", "x%"]],
          between: "OR"
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)} OR ${h.q("status")} IN (${h.p(1)}) OR ${h.q("email")} ILIKE ${h.p(2)};`,
          [5, Status.Active, "x%"],
          "delete with where in like OR between"
        );
      }
    },
    {
      name: "delete with in and like OR between and no where",
      run: () => {
        const result = fixture.db.delete({
          in: [["status", "IN", [Status.Active]]],
          like: [["email", "ILIKE", "x%"]],
          between: "OR"
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("status")} IN (${h.p(0)}) OR ${h.q("email")} ILIKE ${h.p(1)};`,
          [Status.Active, "x%"],
          "delete with in and like OR between and no where"
        );
      }
    },
    {
      name: "delete return star",
      run: () => {
        const result = fixture.db.delete({
          where: [{ id: 1 }],
          return: "*"
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)} RETURNING *;`,
          [1],
          "delete return star"
        );
      }
    },
    {
      name: "delete return selected columns",
      run: () => {
        const result = fixture.db.delete({
          where: [{ id: 1 }],
          return: ["id", "email"]
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)} RETURNING ${h.q("id")}, ${h.q("email")};`,
          [1],
          "delete return selected columns"
        );
      }
    },
    {
      name: "delete empty return omits returning",
      run: () => {
        const result = fixture.db.delete({
          where: [{ id: 1 }],
          return: []
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)};`,
          [1],
          "delete empty return omits returning"
        );
      }
    },
    {
      name: "delete schema override",
      run: () => {
        const result = fixture.db.delete({
          where: [{ id: 1 }],
          schema: "other"
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table("other", fixture.table)} WHERE ${h.q("id")} = ${h.p(0)};`,
          [1],
          "delete schema override"
        );
      }
    },
    {
      name: "delete schema null",
      run: () => {
        const result = fixture.db.delete({
          where: [{ id: 1 }],
          schema: null
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(null, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)};`,
          [1],
          "delete schema null"
        );
      }
    },
    {
      name: "delete schema empty string falls back to default schema",
      run: () => {
        const result = fixture.db.delete({
          where: [{ id: 1 }],
          schema: "" as any
        });

        assertSQL(
          result,
          `DELETE FROM ${h.table(fixture.schema, fixture.table)} WHERE ${h.q("id")} = ${h.p(0)};`,
          [1],
          "delete schema empty string falls back to default schema"
        );
      }
    }
  ];
}

export function runDeleteTests(): void {
  runCasesForFixtures("delete", MODEL_FIXTURES, deleteCases);

  runCases("delete/guards", [
    {
      name: "delete requires at least one filter",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({}),
          /Delete query needs a where clause!/i,
          "delete requires at least one filter"
        );
      }
    },
    {
      name: "delete rejects empty object where",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({ where: [{}] }),
          /Delete query needs at least one non-empty condition!/i,
          "delete rejects empty object where"
        );
      }
    },
    {
      name: "delete rejects empty where array",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({ where: [] as any }),
          /Delete query needs at least one non-empty condition!/i,
          "delete rejects empty where array"
        );
      }
    },
    {
      name: "delete rejects token-only where",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({ where: ["AND", "OR", "NOT"] as any }),
          /Delete query needs at least one non-empty condition!/i,
          "delete rejects token-only where"
        );
      }
    },
    {
      name: "delete rejects empty in array",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({ in: [] }),
          /Delete query needs at least one non-empty condition!/i,
          "delete rejects empty in array"
        );
      }
    },
    {
      name: "delete rejects token-only in array",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({ in: ["AND", "OR", "NOT"] as any }),
          /Delete query needs at least one non-empty condition!/i,
          "delete rejects token-only in array"
        );
      }
    },
    {
      name: "delete rejects empty like array",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({ like: [] }),
          /Delete query needs at least one non-empty condition!/i,
          "delete rejects empty like array"
        );
      }
    },
    {
      name: "delete rejects token-only like array",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({ like: ["AND", "OR", "NOT"] as any }),
          /Delete query needs at least one non-empty condition!/i,
          "delete rejects token-only like array"
        );
      }
    },
    {
      name: "delete rejects invalid where token",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({
            where: [["id", "=", 1], "XOR", ["email", "=", "x@example.com"]] as any
          }),
          /Invalid boolean expression token "XOR"/i,
          "delete rejects invalid where token"
        );
      }
    },
    {
      name: "delete rejects consecutive where operators",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({
            where: [["id", "=", 1], "AND", "OR", ["email", "=", "x@example.com"]] as any
          }),
          /Invalid boolean expression near "OR"/i,
          "delete rejects consecutive where operators"
        );
      }
    },
    {
      name: "delete rejects invalid in token",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({
            in: [["status", "IN", [Status.Active]], "XOR", ["status", "NOT IN", [Status.Deleted]]] as any
          }),
          /Invalid boolean expression token "XOR"/i,
          "delete rejects invalid in token"
        );
      }
    },
    {
      name: "delete rejects missing logical operator in IN",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({
            in: [["status", "IN", [Status.Active]], ["status", "NOT IN", [Status.Deleted]]] as any
          }),
          /missing logical operator between predicates/i,
          "delete rejects missing logical operator in IN"
        );
      }
    },
    {
      name: "delete rejects invalid NOT placement in IN",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({
            in: [["status", "IN", [Status.Active]], "NOT", ["status", "NOT IN", [Status.Deleted]]] as any
          }),
          /Invalid boolean expression near "NOT"/i,
          "delete rejects invalid NOT placement in IN"
        );
      }
    },
    {
      name: "delete rejects invalid like token",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({
            like: [["email", "LIKE", "x%"], "XOR", ["email", "ILIKE", "y%"]] as any
          }),
          /Invalid boolean expression token "XOR"/i,
          "delete rejects invalid like token"
        );
      }
    },
    {
      name: "delete rejects missing logical operator in LIKE",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({
            like: [["email", "LIKE", "x%"], ["email", "ILIKE", "y%"]] as any
          }),
          /missing logical operator between predicates/i,
          "delete rejects missing logical operator in LIKE"
        );
      }
    },
    {
      name: "delete rejects invalid NOT placement in LIKE",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({
            like: [["email", "LIKE", "x%"], "NOT", ["email", "ILIKE", "y%"]] as any
          }),
          /Invalid boolean expression near "NOT"/i,
          "delete rejects invalid NOT placement in LIKE"
        );
      }
    },
    {
      name: "delete rejects IN predicate with empty values",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.delete({
            in: [["status", "IN", []]]
          }),
          /IN operator requires at least one value/i,
          "delete rejects IN predicate with empty values"
        );
      }
    }
  ]);
}
