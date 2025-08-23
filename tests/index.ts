import * as PostgresUser from "./models/postgres-user.js";

const main = () => {
  const insert1 = PostgresUser.db.insert({
    cols: ["email", "password"],
    rows: [{
      email: "hello@there.com",
      password: "234"
    }],
    return: ["created", "status"]
  });
  console.log(insert1);

  const select1 = PostgresUser.db.select({
    cols: ["email", "password"],
    where: [{ email: "hello@select.com", id: 1 }],
    in: [["status", "IN", [PostgresUser.Status.Banned, PostgresUser.Status.Deactivated]], "OR"],
    like: [["email", "ILIKE", "hello"], "AND"],
    shift: { limit: 2, offset: 10 },
    order: { by: "created", type: "DESC" }
  });
  console.log(select1);

  const update1 = PostgresUser.db.update({
    set: {
      status: PostgresUser.Status.AwaitingDeletion,
      updated: new Date()
    },
    where: [{ email: "hello@select.com", id: 1 }],
    in: [["status", "IN", [PostgresUser.Status.Banned, PostgresUser.Status.Deactivated]], "OR"],
    like: [["email", "ILIKE", "hello"], "AND"],
    return: ["created", "status"]
  });
  console.log(update1);

  const delete1 = PostgresUser.db.delete({
    where: [{ email: "hello@select.com", id: 1 }],
    in: [["status", "IN", [PostgresUser.Status.Banned, PostgresUser.Status.Deactivated]], "OR"],
    like: [["email", "ILIKE", "hello"], "AND"],
    return: ["created", "status"],
    schema: null
  });
  console.log(delete1);
};

main();