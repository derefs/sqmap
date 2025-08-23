import * as PostgresUser from "./models/postgres-user.js";

const main = () => {
  const test = PostgresUser.db.insert({
    cols: ["email"],
    rows: [{
      email: "hello@there.com",
      password: "234"
    }],
    return: "*"
  });
  console.log(test);
};

main();