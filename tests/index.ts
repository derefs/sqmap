import assert from "node:assert/strict";
import * as PostgresUser from "./models/postgres-user.js";

const testTokenizedWhere = (): void => {
  const result = PostgresUser.db.select({
    cols: ["email", "password"],
    where: [["email", "=", "hello@select.com"], "OR", ["id", "=", 1]]
  });

  assert.equal(
    result.query,
    "SELECT `email`, `password` FROM `fh`.`users` WHERE `email` = ?0 OR `id` = ?1;"
  );
  assert.deepEqual(result.params, ["hello@select.com", 1]);
};

const testTokenizedInAndLike = (): void => {
  const result = PostgresUser.db.select({
    cols: ["email"],
    in: [
      ["status", "IN", [PostgresUser.Status.Banned, PostgresUser.Status.Deactivated]],
      "OR",
      ["status", "NOT IN", [PostgresUser.Status.Deleted]]
    ],
    like: ["NOT", ["email", "ILIKE", "hello%"]]
  });

  assert.equal(
    result.query,
    "SELECT `email` FROM `fh`.`users` WHERE `status` IN (?0, ?1) OR `status` NOT IN (?2) AND NOT `email` ILIKE ?3;"
  );
  assert.deepEqual(
    result.params,
    [PostgresUser.Status.Banned, PostgresUser.Status.Deactivated, PostgresUser.Status.Deleted, "hello%"]
  );
};

const testSafetyGuards = (): void => {
  assert.throws(
    () => PostgresUser.db.update({ set: { status: PostgresUser.Status.Active }, where: [{}] }),
    /non-empty condition/i
  );
  assert.throws(
    () => PostgresUser.db.update({ set: { status: PostgresUser.Status.Active }, in: [] }),
    /non-empty condition/i
  );
  assert.throws(
    () => PostgresUser.db.delete({ where: [{}] }),
    /non-empty condition/i
  );
  assert.throws(
    () => PostgresUser.db.delete({ like: [] }),
    /non-empty condition/i
  );
};

const testEmptyReturnArray = (): void => {
  const insertResult = PostgresUser.db.insert({
    cols: ["email"],
    rows: [{ email: "hello@there.com" }],
    return: []
  });
  assert.equal(insertResult.query, "INSERT INTO `fh`.`users` (`email`) VALUES (?0);");

  const updateResult = PostgresUser.db.update({
    set: { status: PostgresUser.Status.AwaitingDeletion },
    where: [{ id: 1 }],
    return: []
  });
  assert.equal(updateResult.query, "UPDATE `fh`.`users` SET `status` = ?0 WHERE `id` = ?1;");

  const deleteResult = PostgresUser.db.delete({
    where: [{ id: 1 }],
    return: []
  });
  assert.equal(deleteResult.query, "DELETE FROM `fh`.`users` WHERE `id` = ?0;");
};

const testInRequiresValues = (): void => {
  assert.throws(
    () => PostgresUser.db.select({ cols: ["email"], in: [["status", "IN", []]] }),
    /requires at least one value/i
  );
};

const main = (): void => {
  testTokenizedWhere();
  testTokenizedInAndLike();
  testSafetyGuards();
  testEmptyReturnArray();
  testInRequiresValues();
  console.log("All tests passed.");
};

main();
