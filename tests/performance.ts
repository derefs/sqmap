import * as SQM from "../sqmap.js";
import { PRIMARY_MODEL, Status, type Row } from "./model-user.js";

interface PreGeneratedInputs {
  ids: number[];
  emails: string[];
  usernames: string[];
  likePatterns: string[];
  statuses: Status[];
  limits: number[];
  offsets: number[];
  idxA: Uint32Array;
  idxB: Uint32Array;
  idxC: Uint32Array;
  idxD: Uint32Array;
}

interface BenchmarkResult {
  category: "select" | "insert" | "update" | "delete";
  elapsedMs: number;
  queriesPerSec: number;
  nsPerOp: number;
  sink: number;
}

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  blue: "\u001b[34m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  magenta: "\u001b[35m",
  yellow: "\u001b[33m",
  gray: "\u001b[90m"
} as const;

const ITERATIONS = 1_000_000;
const VALUE_POOL_SIZE = 4096;
const STATUS_VALUES: Status[] = [
  Status.Active,
  Status.Banned,
  Status.Deactivated,
  Status.AwaitingDeletion,
  Status.SoftDeleted,
  Status.Deleted
];

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function buildPreGeneratedInputs(): PreGeneratedInputs {
  const ids = new Array<number>(VALUE_POOL_SIZE);
  const emails = new Array<string>(VALUE_POOL_SIZE);
  const usernames = new Array<string>(VALUE_POOL_SIZE);
  const likePatterns = new Array<string>(VALUE_POOL_SIZE);
  const statuses = new Array<Status>(VALUE_POOL_SIZE);
  const limits = new Array<number>(VALUE_POOL_SIZE);
  const offsets = new Array<number>(VALUE_POOL_SIZE);

  for (let i = 0; i < VALUE_POOL_SIZE; i++) {
    const userSuffix = `${randomInt(1_000_000_000)}`;
    const username = `bench_user_${userSuffix}`;

    ids[i] = randomInt(10_000_000) + 1;
    emails[i] = `bench_${userSuffix}@example.com`;
    usernames[i] = username;
    likePatterns[i] = `${username.slice(0, 12)}%`;
    statuses[i] = STATUS_VALUES[randomInt(STATUS_VALUES.length)];
    limits[i] = randomInt(100) + 1;
    offsets[i] = randomInt(5000);
  }

  const idxA = new Uint32Array(ITERATIONS);
  const idxB = new Uint32Array(ITERATIONS);
  const idxC = new Uint32Array(ITERATIONS);
  const idxD = new Uint32Array(ITERATIONS);
  for (let i = 0; i < ITERATIONS; i++) {
    idxA[i] = randomInt(VALUE_POOL_SIZE);
    idxB[i] = randomInt(VALUE_POOL_SIZE);
    idxC[i] = randomInt(VALUE_POOL_SIZE);
    idxD[i] = randomInt(VALUE_POOL_SIZE);
  }

  return {
    ids,
    emails,
    usernames,
    likePatterns,
    statuses,
    limits,
    offsets,
    idxA,
    idxB,
    idxC,
    idxD
  };
}

function runCategory(
  category: BenchmarkResult["category"],
  runIteration: (iteration: number) => number
): BenchmarkResult {
  let sink = 0;
  const startedAt = Date.now();
  for (let i = 0; i < ITERATIONS; i++) {
    sink += runIteration(i);
  }
  const elapsedMsRaw = Date.now() - startedAt;
  const elapsedMs = elapsedMsRaw > 0 ? elapsedMsRaw : 1;

  return {
    category,
    elapsedMs,
    queriesPerSec: (ITERATIONS * 1000) / elapsedMs,
    nsPerOp: (elapsedMs * 1_000_000) / ITERATIONS,
    sink
  };
}

function printResult(result: BenchmarkResult): void {
  console.log(
    `  ${ANSI.bold}${result.category}${ANSI.reset}: ` +
    `${ANSI.green}${result.queriesPerSec.toFixed(2)} queries/sec${ANSI.reset} | ` +
    `${ANSI.yellow}${result.nsPerOp.toFixed(2)} ns/op${ANSI.reset}`
  );
}

export function runPerformanceBenchmarks(): void {
  const db = SQM.genAPI<Row>(PRIMARY_MODEL.table, PRIMARY_MODEL.schema, PRIMARY_MODEL.format);
  const inputs = buildPreGeneratedInputs();

  console.log("");
  console.log(
    `${ANSI.blue}${ANSI.bold}Performance benchmark${ANSI.reset}\n` +
    `${ANSI.gray}(1,000,000 query generations per category)${ANSI.reset}`
  );
  console.log(`${ANSI.gray}Using Date.now() timing and pre-generated random params.${ANSI.reset}\n`);

  const selectResult = runCategory("select", (i) => {
    const a = inputs.idxA[i];
    const b = inputs.idxB[i];
    const c = inputs.idxC[i];
    const d = inputs.idxD[i];

    const sql = db.select({
      cols: ["id", "email", "status"],
      where: [{ id: inputs.ids[a], email: inputs.emails[b] }],
      in: [["status", "IN", [inputs.statuses[c], inputs.statuses[d]]]],
      like: [["username", "ILIKE", inputs.likePatterns[b]]],
      order: { by: "id", type: "DESC" },
      shift: { limit: inputs.limits[c], offset: inputs.offsets[d] }
    });

    return sql.query.length + sql.params.length;
  });
  printResult(selectResult);

  const insertResult = runCategory("insert", (i) => {
    const a = inputs.idxA[i];
    const b = inputs.idxB[i];
    const c = inputs.idxC[i];

    const sql = db.insert({
      cols: ["status", "email", "username"],
      rows: [{
        status: inputs.statuses[a],
        email: inputs.emails[b],
        username: inputs.usernames[c]
      }],
      return: ["id"]
    });

    return sql.query.length + sql.params.length;
  });
  printResult(insertResult);

  const updateResult = runCategory("update", (i) => {
    const a = inputs.idxA[i];
    const b = inputs.idxB[i];
    const c = inputs.idxC[i];
    const d = inputs.idxD[i];

    const sql = db.update({
      set: {
        status: inputs.statuses[a],
        email: inputs.emails[b],
        username: inputs.usernames[c]
      },
      where: [{ id: inputs.ids[d] }],
      in: [["status", "IN", [inputs.statuses[b]]]],
      like: [["email", "ILIKE", inputs.likePatterns[c]]],
      between: "OR",
      return: ["id"]
    });

    return sql.query.length + sql.params.length;
  });
  printResult(updateResult);

  const deleteResult = runCategory("delete", (i) => {
    const a = inputs.idxA[i];
    const b = inputs.idxB[i];
    const c = inputs.idxC[i];
    const d = inputs.idxD[i];

    const sql = db.delete({
      where: [{ id: inputs.ids[a] }],
      in: [["status", "IN", [inputs.statuses[b], inputs.statuses[c]]]],
      like: [["email", "ILIKE", inputs.likePatterns[d]]],
      between: "OR",
      return: ["id"]
    });

    return sql.query.length + sql.params.length;
  });
  printResult(deleteResult);

  const totalSink = selectResult.sink + insertResult.sink + updateResult.sink + deleteResult.sink;
  const totalElapsedMs = selectResult.elapsedMs + insertResult.elapsedMs + updateResult.elapsedMs + deleteResult.elapsedMs;
  console.log(`  ${ANSI.bold}${ANSI.cyan}total elapsed${ANSI.reset}: ${ANSI.cyan}${totalElapsedMs} ms${ANSI.reset}`);
  console.log(`  ${ANSI.bold}${ANSI.magenta}sink${ANSI.reset}: ${ANSI.magenta}${totalSink}${ANSI.reset}`);
}
