# SQMap
A lightweight and easy to use micro ORM for Node/TypeScript.

SQMap doesn't aim to replace SQL with TS, but instead it encourages you to combine the two languages to leverage their advantages. Our aim is to provide a thin and fast wrapper over the most commonly used SQL queries in order to improve the developer experience. SQMap can't generate complex SQL queries and doesn't aim to do that in the future.

## Supported databases
Currently SQMap only supports Postgres using the `pg` [package](https://www.npmjs.com/package/pg).

## WARNING: trusted identifiers only
SQMap parameterizes values, but SQL identifiers (table names, schema names, column names) are interpolated into query strings.

DO NOT pass untrusted user input as identifiers.

Only use identifiers that come from trusted, static application code.

## Models
In order to fully use the features offered by SQMap you'll need to define a model for each table that you want to query. The example below shows how you can use TS to define the valid columns and the row types while also using SQL to create the table.
```ts
import { genPostgresAPI } from "sqmap";

export interface Row {
  id?:       number;
  created?:  Date;
  status?:   "active" | "banned";
  name?:     string;
  username?: string;
  email?:    string;
  info?:     Info;
}

export interface Info {
  subscription_plan: "basic" | "premium";
}

export const queries = {
  up: /*sql*/ `CREATE TABLE IF NOT EXISTS "users" (
    "id"       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "created"  TIMESTAMP DEFAULT NOW(),
    "status"   TEXT,
    "name"     TEXT,
    "username" TEXT,
    "email"    TEXT UNIQUE,
    "info"     JSONB
  );`,
  indexStatus: /*sql*/ `CREATE INDEX users_status_index ON "users" USING HASH ("status");`,
  down: /*sql*/ `DROP TABLE "users";`
};

// In order to get the proper type-checking you need to pass Row as type parameter. The columns are
// going to be infered from the Row interface
export const db = genPostgresAPI<Row>("users");
```

## Migrations
```ts
import { PoolClient } from "pg";
import * as SQM from "sqmap";
// You'll need a pool connection. More info: https://node-postgres.com/apis/pool
import * as postgres from "./postgres.js";
// Models
import * as User from "./models/User.js";

// The migration system works by iterating through this array on server
// startup, executing any unapplied migrations. The server tracks the
// completed migrations by creating a new entry in the "sqmap_migrations" table.
const MIGRATIONS = [{
    name: "create_table_users",
    exec: async (client: PoolClient) => {
      // All queries are done in a transaction so if any fails then the migration
      // will be reverted
      await client.query(User.queries.up, []);
      await client.query(User.queries.indexStatus, []);
    }
  }
];

// You'll need to run this funtion at server startup
export const run = async (): Promise<void> => {
  const client = await postgres.pool.connect();
  try {
    await SQM.runPostgresMigrations(client, {
      table: "sqmap_migrations",
      initialMigrationName: "init_db"
    }, MIGRATIONS);
  } catch (error) {
    console.log(error);
    process.exit(1);
  } finally {
    client.release();
  }
};
```


## Insert queries
```ts
import * as User from "./models/User";

const newUser = await User.db.insert(client, {
  // You need to specify all the columns that you want to insert into
  cols: ["status", "username", "email", "info"],
  // Any extra column that is not present in the "cols" array will be ignored
  // Missing columns will be inserted as undefined
  rows: [{
    status: "active",
    name: "new user",
    email: "test@example.com",
    info: {
      subscription_plan: "basic"
    }
  }],
  return: ["id"]
});

// newUser will be of type pg.Result: https://node-postgres.com/apis/result
// The rows property will be of Array<User.Row>
console.log(newUser[0].id);
```
The code above will generate the following query:
```sql
INSERT INTO "users" ("status", "username", "email", "info") VALUES ($1, $2, $3, $4) RETURNING "id";
```
**^ Notice how _name_ was ignored even tho the passed object contains it.**
and will pass as params:
```ts
["active", undefined, "test@example.com", { subscription_plan: "basic" }]
```
**^ Notice how because we specified that we want to insert the _username_ column and we didn't set it on the passed object it was inserted as `undefined`.**

## Select queries
```ts
```

## Update queries
```ts
```

## Delete queries
```ts
```

## Debug options & utils
```ts
```

## Performance
