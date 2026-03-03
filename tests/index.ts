import { finalizeTestRun } from "./helpers.js";
import { runPerformanceBenchmarks } from "./performance.js";
import { runDeleteTests } from "./query-delete.js";
import { runInsertTests } from "./query-insert.js";
import { runSelectTests } from "./query-select.js";
import { runUpdateTests } from "./query-update.js";

function main(): void {
  runInsertTests();
  runSelectTests();
  runUpdateTests();
  runDeleteTests();
  finalizeTestRun();
  runPerformanceBenchmarks();
}

main();
