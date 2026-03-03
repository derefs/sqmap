import { assertSQL, assertThrows, createSQLHelpers, runCases, runCasesForFixtures, type TestCase } from "./helpers.js";
import { MODEL_FIXTURES, PRIMARY_MODEL, Status, type ModelFixture } from "./model-user.js";

function updateCases(fixture: ModelFixture): TestCase[] {
  const h = createSQLHelpers(fixture.format);

  return [
    {
      name: "basic update with where object",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Active },
          where: [{ id: 1 }]
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("id")} = ${h.p(1)};`,
          [Status.Active, 1],
          "basic update with where object"
        );
      }
    },
    {
      name: "update with tokenized where expression",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Active },
          where: [["id", "=", 1], "OR", ["email", "=", "one@example.com"]]
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("id")} = ${h.p(1)} OR ${h.q("email")} = ${h.p(2)};`,
          [Status.Active, 1, "one@example.com"],
          "update with tokenized where expression"
        );
      }
    },
    {
      name: "update tokenized where rewrites null comparisons",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Active },
          where: [["verified_at", "=", null], "OR", ["stripe_id", "!=", null]] as any
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("verified_at")} IS NULL OR ${h.q("stripe_id")} IS NOT NULL;`,
          [Status.Active],
          "update tokenized where rewrites null comparisons"
        );
      }
    },
    {
      name: "update tokenized where null comparison keeps param progression",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Banned },
          where: [["verified_at", "=", null], "AND", ["id", "=", 77]] as any
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("verified_at")} IS NULL AND ${h.q("id")} = ${h.p(1)};`,
          [Status.Banned, 77],
          "update tokenized where null comparison keeps param progression"
        );
      }
    },
    {
      name: "update where object custom operator and between",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Banned },
          where: [{ id: 10, email: "blocked@example.com" }, "!=", "OR"]
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("id")} != ${h.p(1)} OR ${h.q("email")} != ${h.p(2)};`,
          [Status.Banned, 10, "blocked@example.com"],
          "update where object custom operator and between"
        );
      }
    },
    {
      name: "update where object rewrites null comparisons",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Banned },
          where: [{ verified_at: null, id: 7 }] as any
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("verified_at")} IS NULL AND ${h.q("id")} = ${h.p(1)};`,
          [Status.Banned, 7],
          "update where object rewrites null comparisons"
        );
      }
    },
    {
      name: "update multi-key set preserves param order",
      run: () => {
        const result = fixture.db.update({
          set: {
            status: Status.Banned,
            email: "changed@example.com"
          },
          where: [{ id: 99 }]
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)}, ${h.q("email")} = ${h.p(1)} WHERE ${h.q("id")} = ${h.p(2)};`,
          [Status.Banned, "changed@example.com", 99],
          "update multi-key set preserves param order"
        );
      }
    },
    {
      name: "update with IN only",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Deactivated },
          in: [["id", "IN", [1, 2]]]
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("id")} IN (${h.p(1)}, ${h.p(2)});`,
          [Status.Deactivated, 1, 2],
          "update with IN only"
        );
      }
    },
    {
      name: "update with tokenized IN and NOT prefix",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Deactivated },
          in: ["NOT", ["id", "IN", [1, 2]]] as any
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE NOT ${h.q("id")} IN (${h.p(1)}, ${h.p(2)});`,
          [Status.Deactivated, 1, 2],
          "update with tokenized IN and NOT prefix"
        );
      }
    },
    {
      name: "update with LIKE only",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.SoftDeleted },
          like: [["email", "LIKE", "sweep%"]]
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("email")} LIKE ${h.p(1)};`,
          [Status.SoftDeleted, "sweep%"],
          "update with LIKE only"
        );
      }
    },
    {
      name: "update with tokenized LIKE and NOT prefix",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.SoftDeleted },
          like: ["NOT", ["email", "LIKE", "sweep%"]] as any
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE NOT ${h.q("email")} LIKE ${h.p(1)};`,
          [Status.SoftDeleted, "sweep%"],
          "update with tokenized LIKE and NOT prefix"
        );
      }
    },
    {
      name: "update with where in like default between",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.AwaitingDeletion },
          where: [{ id: 42 }],
          in: [["status", "IN", [Status.Active, Status.Banned]]],
          like: [["email", "ILIKE", "x%"]]
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("id")} = ${h.p(1)} AND ${h.q("status")} IN (${h.p(2)}, ${h.p(3)}) AND ${h.q("email")} ILIKE ${h.p(4)};`,
          [Status.AwaitingDeletion, 42, Status.Active, Status.Banned, "x%"],
          "update with where in like default between"
        );
      }
    },
    {
      name: "update with where in like OR between",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.AwaitingDeletion },
          where: [{ id: 42 }],
          in: [["status", "IN", [Status.Active]]],
          like: [["email", "ILIKE", "x%"]],
          between: "OR"
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("id")} = ${h.p(1)} OR ${h.q("status")} IN (${h.p(2)}) OR ${h.q("email")} ILIKE ${h.p(3)};`,
          [Status.AwaitingDeletion, 42, Status.Active, "x%"],
          "update with where in like OR between"
        );
      }
    },
    {
      name: "update with in and like OR between and no where",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.AwaitingDeletion },
          in: [["status", "IN", [Status.Active]]],
          like: [["email", "ILIKE", "x%"]],
          between: "OR"
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("status")} IN (${h.p(1)}) OR ${h.q("email")} ILIKE ${h.p(2)};`,
          [Status.AwaitingDeletion, Status.Active, "x%"],
          "update with in and like OR between and no where"
        );
      }
    },
    {
      name: "update return star",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Active },
          where: [{ id: 1 }],
          return: "*"
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("id")} = ${h.p(1)} RETURNING *;`,
          [Status.Active, 1],
          "update return star"
        );
      }
    },
    {
      name: "update return selected columns",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Active },
          where: [{ id: 1 }],
          return: ["id", "email"]
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("id")} = ${h.p(1)} RETURNING ${h.q("id")}, ${h.q("email")};`,
          [Status.Active, 1],
          "update return selected columns"
        );
      }
    },
    {
      name: "update empty return omits returning",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Active },
          where: [{ id: 1 }],
          return: []
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("id")} = ${h.p(1)};`,
          [Status.Active, 1],
          "update empty return omits returning"
        );
      }
    },
    {
      name: "update schema override",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Active },
          where: [{ id: 1 }],
          schema: "other"
        });

        assertSQL(
          result,
          `UPDATE ${h.table("other", fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("id")} = ${h.p(1)};`,
          [Status.Active, 1],
          "update schema override"
        );
      }
    },
    {
      name: "update schema null",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Active },
          where: [{ id: 1 }],
          schema: null
        });

        assertSQL(
          result,
          `UPDATE ${h.table(null, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("id")} = ${h.p(1)};`,
          [Status.Active, 1],
          "update schema null"
        );
      }
    },
    {
      name: "update schema empty string falls back to default schema",
      run: () => {
        const result = fixture.db.update({
          set: { status: Status.Active },
          where: [{ id: 1 }],
          schema: "" as any
        });

        assertSQL(
          result,
          `UPDATE ${h.table(fixture.schema, fixture.table)} SET ${h.q("status")} = ${h.p(0)} WHERE ${h.q("id")} = ${h.p(1)};`,
          [Status.Active, 1],
          "update schema empty string falls back to default schema"
        );
      }
    }
  ];
}

export function runUpdateTests(): void {
  runCasesForFixtures("update", MODEL_FIXTURES, updateCases);

  runCases("update/guards", [
    {
      name: "update requires at least one filter key",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({ set: { status: Status.Active } }),
          /Update query needs a where clause!/i,
          "update requires at least one filter key"
        );
      }
    },
    {
      name: "update requires non-empty set",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({ set: {}, where: [{ id: 1 }] } as any),
          /No update data was provided!/i,
          "update requires non-empty set"
        );
      }
    },
    {
      name: "update checks where guard before empty set when both missing",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({ set: {} } as any),
          /Update query needs a where clause!/i,
          "update checks where guard before empty set when both missing"
        );
      }
    },
    {
      name: "update rejects empty object where",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({ set: { status: Status.Active }, where: [{}] }),
          /Update query needs at least one non-empty condition!/i,
          "update rejects empty object where"
        );
      }
    },
    {
      name: "update rejects empty where array",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({ set: { status: Status.Active }, where: [] as any }),
          /Update query needs at least one non-empty condition!/i,
          "update rejects empty where array"
        );
      }
    },
    {
      name: "update rejects token-only where",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({ set: { status: Status.Active }, where: ["AND", "OR", "NOT"] as any }),
          /Update query needs at least one non-empty condition!/i,
          "update rejects token-only where"
        );
      }
    },
    {
      name: "update rejects empty in array",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({ set: { status: Status.Active }, in: [] }),
          /Update query needs at least one non-empty condition!/i,
          "update rejects empty in array"
        );
      }
    },
    {
      name: "update rejects token-only in array",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({ set: { status: Status.Active }, in: ["AND", "OR", "NOT"] as any }),
          /Update query needs at least one non-empty condition!/i,
          "update rejects token-only in array"
        );
      }
    },
    {
      name: "update rejects empty like array",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({ set: { status: Status.Active }, like: [] }),
          /Update query needs at least one non-empty condition!/i,
          "update rejects empty like array"
        );
      }
    },
    {
      name: "update rejects token-only like array",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({ set: { status: Status.Active }, like: ["AND", "OR", "NOT"] as any }),
          /Update query needs at least one non-empty condition!/i,
          "update rejects token-only like array"
        );
      }
    },
    {
      name: "update rejects invalid where token",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({
            set: { status: Status.Active },
            where: [["id", "=", 1], "XOR", ["email", "=", "x@example.com"]] as any
          }),
          /Invalid boolean expression token "XOR"/i,
          "update rejects invalid where token"
        );
      }
    },
    {
      name: "update rejects consecutive where operators",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({
            set: { status: Status.Active },
            where: [["id", "=", 1], "AND", "OR", ["email", "=", "x@example.com"]] as any
          }),
          /Invalid boolean expression near "OR"/i,
          "update rejects consecutive where operators"
        );
      }
    },
    {
      name: "update rejects invalid in token",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({
            set: { status: Status.Active },
            in: [["status", "IN", [Status.Active]], "XOR", ["status", "NOT IN", [Status.Deleted]]] as any
          }),
          /Invalid boolean expression token "XOR"/i,
          "update rejects invalid in token"
        );
      }
    },
    {
      name: "update rejects missing logical operator in IN",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({
            set: { status: Status.Active },
            in: [["status", "IN", [Status.Active]], ["status", "NOT IN", [Status.Deleted]]] as any
          }),
          /missing logical operator between predicates/i,
          "update rejects missing logical operator in IN"
        );
      }
    },
    {
      name: "update rejects invalid NOT placement in IN",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({
            set: { status: Status.Active },
            in: [["status", "IN", [Status.Active]], "NOT", ["status", "NOT IN", [Status.Deleted]]] as any
          }),
          /Invalid boolean expression near "NOT"/i,
          "update rejects invalid NOT placement in IN"
        );
      }
    },
    {
      name: "update rejects invalid like token",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({
            set: { status: Status.Active },
            like: [["email", "LIKE", "x%"], "XOR", ["email", "ILIKE", "y%"]] as any
          }),
          /Invalid boolean expression token "XOR"/i,
          "update rejects invalid like token"
        );
      }
    },
    {
      name: "update rejects missing logical operator in LIKE",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({
            set: { status: Status.Active },
            like: [["email", "LIKE", "x%"], ["email", "ILIKE", "y%"]] as any
          }),
          /missing logical operator between predicates/i,
          "update rejects missing logical operator in LIKE"
        );
      }
    },
    {
      name: "update rejects invalid NOT placement in LIKE",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({
            set: { status: Status.Active },
            like: [["email", "LIKE", "x%"], "NOT", ["email", "ILIKE", "y%"]] as any
          }),
          /Invalid boolean expression near "NOT"/i,
          "update rejects invalid NOT placement in LIKE"
        );
      }
    },
    {
      name: "update rejects IN predicate with empty values",
      run: () => {
        assertThrows(
          () => PRIMARY_MODEL.db.update({
            set: { status: Status.Active },
            in: [["status", "IN", []]]
          }),
          /IN operator requires at least one value/i,
          "update rejects IN predicate with empty values"
        );
      }
    }
  ]);
}
