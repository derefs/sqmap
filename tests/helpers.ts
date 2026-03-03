import type { Format, SQLData } from "../sqmap.js";

export interface TestCase {
  name: string;
  run: () => void;
}

export type QueryMethodName = "insert" | "select" | "update" | "delete";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  magenta: "\u001b[35m",
  cyan: "\u001b[36m",
  gray: "\u001b[90m"
} as const;

interface CategoryStats {
  total: number;
  passed: number;
  failed: number;
}

interface FailedTest {
  group: string;
  name: string;
  message: string;
  inputSummary?: string;
  paramsSummary?: string;
}

const categoryStats = new Map<string, CategoryStats>();
const failedTests: FailedTest[] = [];
const recordedSQLQueries: string[] = [];
const recordedSQLParams: unknown[][] = [];
const recordedCallInputs: Array<{ method: QueryMethodName; input: unknown }> = [];

function resetRecordedSQLQueries(): void {
  recordedSQLQueries.length = 0;
}

function resetRecordedSQLParams(): void {
  recordedSQLParams.length = 0;
}

function resetRecordedCallInputs(): void {
  recordedCallInputs.length = 0;
}

function recordSQLQuery(query: string): void {
  recordedSQLQueries.push(query);
}

function recordSQLParams(params: unknown[]): void {
  recordedSQLParams.push(params);
}

export function recordQueryInput(method: QueryMethodName, input: unknown): void {
  recordedCallInputs.push({ method, input });
}

function consumeRecordedSQLQueries(): string[] {
  const queries = [...recordedSQLQueries];
  resetRecordedSQLQueries();
  return queries;
}

function consumeRecordedSQLParams(): unknown[][] {
  const params = [...recordedSQLParams];
  resetRecordedSQLParams();
  return params;
}

function consumeRecordedCallInputs(): Array<{ method: QueryMethodName; input: unknown }> {
  const inputs = [...recordedCallInputs];
  resetRecordedCallInputs();
  return inputs;
}

function categoryFromGroup(group: string): string {
  const slashIndex = group.indexOf("/");
  if (slashIndex === -1) return group;
  return group.slice(0, slashIndex);
}

function ensureCategoryStats(category: string): CategoryStats {
  const existing = categoryStats.get(category);
  if (existing) return existing;

  const created: CategoryStats = {
    total: 0,
    passed: 0,
    failed: 0
  };
  categoryStats.set(category, created);
  return created;
}

function recordResult(group: string, passed: boolean): void {
  const category = categoryFromGroup(group);
  const stats = ensureCategoryStats(category);
  stats.total++;
  if (passed) stats.passed++;
  else stats.failed++;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "function") return "[Function]";
  if (value instanceof Date) return `Date(${value.toISOString()})`;
  try {
    return JSON.stringify(value, (_key, current) => {
      if (typeof current === "undefined") return "__undefined__";
      if (current instanceof Date) return `Date(${current.toISOString()})`;
      return current;
    }, 2);
  } catch {
    return String(value);
  }
}

function formatTightValue(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "function") return "[Function]";
  if (value instanceof Date) return `Date(${value.toISOString()})`;
  try {
    return JSON.stringify(value, (_key, current) => {
      if (typeof current === "undefined") return "__undefined__";
      if (current instanceof Date) return `Date(${current.toISOString()})`;
      return current;
    });
  } catch {
    return String(value);
  }
}

function formatInputSummary(entries: Array<{ method: QueryMethodName; input: unknown }>): string {
  if (entries.length === 1) {
    return `${entries[0].method}(${formatTightValue(entries[0].input)})`;
  }

  return `[${entries.map((entry) => `${entry.method}(${formatTightValue(entry.input)})`).join(", ")}]`;
}

function formatParamsSummary(paramsSets: unknown[][]): string {
  if (paramsSets.length === 1) return `params(${formatTightValue(paramsSets[0])})`;
  return `params(${formatTightValue(paramsSets)})`;
}

function fail(label: string, message: string): never {
  throw new Error(`${label}\n${message}`);
}

export function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (!Object.is(actual, expected)) {
    fail(label, `Expected: ${formatValue(expected)}\nActual:   ${formatValue(actual)}`);
  }
}

function deepEqual(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;

  if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();
  }

  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < actual.length; i++) {
      if (!deepEqual(actual[i], expected[i])) return false;
    }
    return true;
  }

  if (typeof actual === "object" && actual !== null && typeof expected === "object" && expected !== null) {
    const actualKeys = Object.keys(actual as Record<string, unknown>);
    const expectedKeys = Object.keys(expected as Record<string, unknown>);
    if (actualKeys.length !== expectedKeys.length) return false;

    for (const key of actualKeys) {
      if (!Object.prototype.hasOwnProperty.call(expected, key)) return false;
      const left = (actual as Record<string, unknown>)[key];
      const right = (expected as Record<string, unknown>)[key];
      if (!deepEqual(left, right)) return false;
    }

    return true;
  }

  return false;
}

export function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  if (!deepEqual(actual, expected)) {
    fail(label, `Expected: ${formatValue(expected)}\nActual:   ${formatValue(actual)}`);
  }
}

export function assertThrows(fn: () => unknown, expectedMessage: string | RegExp, label: string): void {
  let thrown = false;

  try {
    fn();
  } catch (error) {
    thrown = true;
    const message = error instanceof Error ? error.message : String(error);

    if (typeof expectedMessage === "string") {
      if (message !== expectedMessage) {
        fail(label, `Expected throw message: ${formatValue(expectedMessage)}\nActual throw message: ${formatValue(message)}`);
      }
      return;
    }

    expectedMessage.lastIndex = 0;
    if (!expectedMessage.test(message)) {
      fail(label, `Expected throw message to match: ${String(expectedMessage)}\nActual throw message: ${formatValue(message)}`);
    }
  }

  if (!thrown) fail(label, "Expected function to throw.");
}

export function assertSQL(actual: SQLData, expectedQuery: string, expectedParams: unknown[], label: string): void {
  recordSQLQuery(actual.query);
  recordSQLParams(actual.params);
  assertEqual(actual.query, expectedQuery, `${label} :: query`);
  assertDeepEqual(actual.params, expectedParams, `${label} :: params`);
}

function printFailureDetails(message: string, indent: string, inputSummary?: string, paramsSummary?: string): void {
  const lines = message.split("\n");
  const expectedLines: string[] = [];
  const actualLines: string[] = [];
  const normalLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("Expected:")) {
      expectedLines.push(line);
      continue;
    }
    if (line.startsWith("Actual:")) {
      actualLines.push(line);
      continue;
    }
    normalLines.push(line);
  }

  if (inputSummary) {
    console.log(`${indent}${ANSI.gray}${inputSummary}${ANSI.reset}`);
  }
  if (paramsSummary) {
    console.log(`${indent}${ANSI.gray}${paramsSummary}${ANSI.reset}`);
  }

  for (const line of expectedLines) {
    console.log(`${indent}${ANSI.yellow}${line}${ANSI.reset}`);
  }

  for (const line of actualLines) {
    console.log(`${indent}${ANSI.red}${line}${ANSI.reset}`);
  }
}

export function runCases(group: string, cases: TestCase[]): void {
  console.log(`${ANSI.cyan}${ANSI.bold}→ ${group}${ANSI.reset}`);

  for (const testCase of cases) {
    resetRecordedSQLQueries();
    resetRecordedSQLParams();
    resetRecordedCallInputs();
    try {
      testCase.run();
      recordResult(group, true);
      console.log(`${ANSI.green}  PASS${ANSI.reset} ${testCase.name}`);
      const queries = consumeRecordedSQLQueries();
      const paramsSets = consumeRecordedSQLParams();
      const callInputs = consumeRecordedCallInputs();
      const inputSummary = callInputs.length > 0 ? formatInputSummary(callInputs) : "(none)";
      console.log(`${ANSI.gray}       ${inputSummary}${ANSI.reset}`);
      if (paramsSets.length > 0) {
        console.log(`${ANSI.gray}       ${formatParamsSummary(paramsSets)}${ANSI.reset}`);
      }
      if (queries.length === 0) console.log(`${ANSI.gray}       (no SQL query)${ANSI.reset}`);
      else {
        for (const query of queries) {
          console.log(`${ANSI.gray}       ${query}${ANSI.reset}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const callInputs = consumeRecordedCallInputs();
      const paramsSets = consumeRecordedSQLParams();
      const inputSummary = callInputs.length > 0 ? formatInputSummary(callInputs) : undefined;
      const paramsSummary = paramsSets.length > 0 ? formatParamsSummary(paramsSets) : undefined;

      recordResult(group, false);
      failedTests.push({
        group,
        name: testCase.name,
        message,
        inputSummary,
        paramsSummary
      });
      consumeRecordedSQLQueries();
      console.log(`${ANSI.red}  FAIL${ANSI.reset} ${testCase.name}`);
      printFailureDetails(message, "       ", inputSummary, paramsSummary);
    }
  }
}

export function runCasesForFixtures<TFixture extends { name: string }>(
  group: string,
  fixtures: TFixture[],
  casesFactory: (fixture: TFixture) => TestCase[]
): void {
  for (const fixture of fixtures) {
    runCases(`${group}/${fixture.name}`, casesFactory(fixture));
  }
}

export interface SQLRenderHelpers {
  q: (identifier: string) => string;
  p: (offset: number) => string;
  table: (schema: string | null | undefined, tableName: string) => string;
}

export function createSQLHelpers(format: Format): SQLRenderHelpers {
  const q = (identifier: string): string => `${format.quotingChar}${identifier}${format.quotingChar}`;

  const p = (offset: number): string => {
    if (!format.paramsAppendIndex) return format.paramsPrefix;
    return `${format.paramsPrefix}${format.paramsStartIndex + offset}`;
  };

  const table = (schema: string | null | undefined, tableName: string): string => {
    if (!schema) return q(tableName);
    return `${q(schema)}.${q(tableName)}`;
  };

  return { q, p, table };
}

export function finalizeTestRun(): void {
  console.log("");
  console.log(`${ANSI.cyan}${ANSI.bold}Summary${ANSI.reset}`);

  let total = 0;
  let passed = 0;
  let failed = 0;

  for (const [category, stats] of categoryStats) {
    total += stats.total;
    passed += stats.passed;
    failed += stats.failed;

    const statusColor = stats.failed === 0 ? ANSI.green : ANSI.red;
    console.log(
      `${statusColor}${category}${ANSI.reset}: ${stats.passed}/${stats.total} passed` +
      (stats.failed > 0 ? ` (${stats.failed} failed)` : "")
    );
  }

  const totalColor = failed === 0 ? ANSI.green : ANSI.red;
  console.log(`${totalColor}${ANSI.bold}total${ANSI.reset}: ${passed}/${total} passed${failed > 0 ? ` (${failed} failed)` : ""}`);
}
