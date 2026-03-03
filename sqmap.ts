// Main types
export type CompOp = "=" | "<" | ">" | ">=" | "<=" | "!=";
export type BetweenOp = "AND" | "OR";
export type BetweenExtOp = "AND" | "OR" | "NOT";
export type InOp = "IN" | "NOT IN";
export type LikeOp = "LIKE" | "NOT LIKE" | "ILIKE" | "NOT ILIKE";
export type OrderType = "ASC" | "DESC";
export type ExtractColsFromRow<T> = {
  [P in keyof T]: P
}[keyof T];

export type ParamsPrefix = "$" | "?";
export type QuotingChar = `"` | "`";

export interface Format {
  paramsPrefix: ParamsPrefix;
  paramsStartIndex: number;
  paramsAppendIndex: boolean;
  quotingChar: QuotingChar;
}

type Formats = "POSTGRES_PG" | "SQLITE_BUN";
export const FORMATS: Record<Formats, Format> = {
  POSTGRES_PG: {
    paramsPrefix: "$",
    paramsStartIndex: 1,
    paramsAppendIndex: true,
    quotingChar: `"`
  },
  SQLITE_BUN: {
    paramsPrefix: "$",
    paramsStartIndex: 1,
    paramsAppendIndex: true,
    quotingChar: `"`
  }
};

export interface SQLData {
  query:  string;
  params: any[];
}

export interface InsertQueryParams<TCol, TRow> {
  cols:    TCol[];
  rows:    TRow[];
  return?: TCol[] | "*";
  schema?: string | null;
}

export interface SelectQueryParams<TCol, TRow> {
  distinct?: boolean;
  cols:     Array<TCol | "*">;
  where?:   [target: TRow, op?: CompOp, between?: BetweenOp] |
            Array<[col: TCol, op: CompOp, value: any] | BetweenExtOp>;
  in?:      Array<[col: TCol, op: InOp, value: number[] | string[]] | BetweenExtOp>;
  like?:    Array<[col: TCol, op: LikeOp, value: string] | BetweenExtOp>;
  between?: BetweenOp;
  order?:   { by: TCol, type: OrderType };
  shift?:   { limit: number | null, offset: number | null };
  schema?: string | null;
}

export interface UpdateQueryParams<TCol, TRow> {
  set:      TRow;
  where?:   [target: TRow, op?: CompOp, between?: BetweenOp] |
            Array<[col: TCol, op: CompOp, value: any] | BetweenExtOp>;
  in?:      Array<[col: TCol, op: InOp, value: number[] | string[]] | BetweenExtOp>;
  like?:    Array<[col: TCol, op: LikeOp, value: string] | BetweenExtOp>;
  between?: BetweenOp;
  return?:  TCol[] | "*";
  schema?: string | null;
}

export interface DeleteQueryParams<TCol, TRow> {
  where?:   [target: TRow, op?: CompOp, between?: BetweenOp] |
            Array<[col: TCol, op: CompOp, value: any] | BetweenExtOp>;
  in?:      Array<[col: TCol, op: InOp, value: number[] | string[]] | BetweenExtOp>;
  like?:    Array<[col: TCol, op: LikeOp, value: string] | BetweenExtOp>;
  between?: BetweenOp;
  return?: TCol[] | "*";
  schema?: string | null;
}
// End main types

// Query Parser
interface ParsedInsertQuery {
  columns:   string;
  values:    string;
  returning: string | null;
  params:    any[];
}

function resolveReturning<TCol>(returnQuery: TCol[] | "*" | undefined, quotingChar: QuotingChar): string | null {
  if (returnQuery === undefined) return null;
  if (returnQuery === "*") return "*";
  if (returnQuery.length === 0) return null;

  let returnColumns = "";
  for (let i = 0; i < returnQuery.length; i++) returnColumns += `${quotingChar}${returnQuery[i]}${quotingChar}, `;
  returnColumns = returnColumns.slice(0, -2);
  return returnColumns;
}

function resolveBooleanExpr(tokens: Array<string | BetweenExtOp>): string | null {
  if (tokens.length === 0) return null;

  const normalizedTokens: Array<string | BetweenExtOp> = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "AND" || token === "OR" || token === "NOT") {
      if (i === tokens.length - 1) continue;
      normalizedTokens.push(token);
    } else normalizedTokens.push(token);
  }

  while (normalizedTokens.length > 0 && (normalizedTokens[0] === "AND" || normalizedTokens[0] === "OR")) normalizedTokens.shift();
  while (normalizedTokens.length > 0) {
    const token = normalizedTokens[normalizedTokens.length - 1];
    if (token === "AND" || token === "OR" || token === "NOT") normalizedTokens.pop();
    else break;
  }

  if (normalizedTokens.length === 0) return null;

  let expectingPredicate = true;
  for (let i = 0; i < normalizedTokens.length; i++) {
    const token = normalizedTokens[i];
    if (token === "AND" || token === "OR") {
      if (expectingPredicate) throw new Error(`Invalid boolean expression near "${token}".`);
      expectingPredicate = true;
      continue;
    }
    if (token === "NOT") {
      if (!expectingPredicate) throw new Error(`Invalid boolean expression near "${token}".`);
      continue;
    }
    if (!expectingPredicate) throw new Error("Invalid boolean expression: missing logical operator between predicates.");
    expectingPredicate = false;
  }

  if (expectingPredicate) throw new Error("Invalid boolean expression: expression cannot end with a logical operator.");
  return normalizedTokens.join(" ");
}

export function parseInsertQuery<TCol, TRow>(query: InsertQueryParams<TCol, TRow>, format: Format): ParsedInsertQuery {
  const qc = format.quotingChar;
  const pai = format.paramsAppendIndex;
  const pp = format.paramsPrefix;

  let columns:   string = "(";
  let values:    string = "(";
  let returning: string | null = null;
  let params:    any[] = [];

  const colsCount = query.cols.length;
  const rowsCount = query.rows.length;
  if (colsCount === 0) throw new Error("No columns provided for the insert statement!");
  if (rowsCount === 0) throw new Error("No rows provided for the insert statement!");

  for (let i = 0; i < colsCount; i++) columns += `${qc}${query.cols[i]}${qc}, `;
  columns = columns.slice(0, -2);
  columns += ")";

  let paramIndex = format.paramsStartIndex;
  for (let i = 0; i < rowsCount; i++) {
    const row = query.rows[i];
    for (let j = 0; j < colsCount; j++) {
      const col = query.cols[j];
      values += pai ? `${pp}${paramIndex}, ` : `${pp}, `;
      paramIndex++;
      params.push((row as any)[col]);
    }
    values = values.slice(0, -2);
    values += "), (";
  }
  values = values.slice(0, -3);

  returning = resolveReturning(query.return, qc);

  return { columns, values, returning, params };
}

interface WhereClauseResult { whereClause: string | null; paramIndex: number; }
function resolveWhereClause<TCol, TRow>(
  WHERE: [target: TRow, op?: CompOp, between?: BetweenOp] |
         Array<[col: TCol, op: CompOp, value: any] | BetweenExtOp>,
  paramIndex: number, params: any[], format: Format
): WhereClauseResult {
  const qc = format.quotingChar;
  const pai = format.paramsAppendIndex;
  const pp = format.paramsPrefix;

  let whereClause: string | null = null;
  if (typeof WHERE[0] === "object" && !Array.isArray(WHERE[0])) {
    const target = WHERE[0];
    const op = WHERE[1] || "=";
    const between = WHERE[2] || "AND";
    const predicates: string[] = [];
    for (const [key, value] of Object.entries(target as any)) {
      if (value === null && (op === "=" || op === "!=")) {
        const resolvedNullOp = op === "=" ? "IS NULL" : "IS NOT NULL";
        predicates.push(`${qc}${key}${qc} ${resolvedNullOp}`);
      } else {
        predicates.push(pai ? `${qc}${key}${qc} ${op} ${pp}${paramIndex}` : `${qc}${key}${qc} ${op} ${pp}`);
        paramIndex++;
        params.push(value);
      }
    }
    whereClause = predicates.length === 0 ? null : predicates.join(` ${between} `);
  } else if (Array.isArray(WHERE)) {
    const predicates: Array<string | BetweenExtOp> = [];
    for (let i = 0; i < WHERE.length; i++) {
      const token = WHERE[i];
      if (Array.isArray(token)) {
        const col = token[0];
        const op = token[1];
        const value = token[2];
        if (value === null && (op === "=" || op === "!=")) {
          const resolvedNullOp = op === "=" ? "IS NULL" : "IS NOT NULL";
          predicates.push(`${qc}${col}${qc} ${resolvedNullOp}`);
        } else {
          predicates.push(pai ? `${qc}${col}${qc} ${op} ${pp}${paramIndex}` : `${qc}${col}${qc} ${op} ${pp}`);
          paramIndex++;
          params.push(value);
        }
      } else {
        if (token !== "AND" && token !== "OR" && token !== "NOT") throw new Error(`Invalid boolean expression token "${token}".`);
        predicates.push(token as BetweenExtOp);
      }
    }
    whereClause = resolveBooleanExpr(predicates);
  }
  return { whereClause, paramIndex };
}

interface InOpResult { inOp: string | null; paramIndex: number; }
function resolveInOperator<TCol, TRow>(
  IN: Array<[col: TCol, op: InOp, value: number[] | string[]] | BetweenExtOp>,
  paramIndex: number, params: any[], format: Format
): InOpResult {
  const qc = format.quotingChar;
  const pai = format.paramsAppendIndex;
  const pp = format.paramsPrefix;

  let inOp: string | null = null;
  const predicates: Array<string | BetweenExtOp> = [];
  for (let i = 0; i < IN.length; i++) {
    const token = IN[i];
    if (Array.isArray(token)) {
      const col = token[0];
      const op = token[1];
      const values = token[2];
      if (values.length === 0) throw new Error(`IN operator requires at least one value for "${col}".`);
      let inPredicate = `${qc}${col}${qc} ${op} (`;
      for (let j = 0; j < values.length; j++) {
        const value = values[j];
        inPredicate += pai ? `${pp}${paramIndex}, ` : `${pp}, `;
        paramIndex++;
        params.push(value);
      }
      inPredicate = inPredicate.slice(0, -2);
      inPredicate += ")";
      predicates.push(inPredicate);
    } else {
      if (token !== "AND" && token !== "OR" && token !== "NOT") throw new Error(`Invalid boolean expression token "${token}".`);
      predicates.push(token as BetweenExtOp);
    }
  }
  inOp = resolveBooleanExpr(predicates);
  return { inOp, paramIndex };
}

interface LikeOpResult { likeOp: string | null; paramIndex: number; }
function resolveLikeOperator<TCol, TRow>(
  LIKE: Array<[col: TCol, op: LikeOp, value: string] | BetweenExtOp>,
  paramIndex: number, params: any[], format: Format
): LikeOpResult {
  const qc = format.quotingChar;
  const pai = format.paramsAppendIndex;
  const pp = format.paramsPrefix;

  let likeOp: string | null = null;
  const predicates: Array<string | BetweenExtOp> = [];
  for (let i = 0; i < LIKE.length; i++) {
    const token = LIKE[i];
    if (Array.isArray(token)) {
      const col = token[0];
      const op = token[1];
      predicates.push(pai ? `${qc}${col}${qc} ${op} ${pp}${paramIndex}` : `${qc}${col}${qc} ${op} ${pp}`);
      paramIndex++;
      params.push(token[2]);
    } else {
      if (token !== "AND" && token !== "OR" && token !== "NOT") throw new Error(`Invalid boolean expression token "${token}".`);
      predicates.push(token as BetweenExtOp);
    }
  }
  likeOp = resolveBooleanExpr(predicates);
  return { likeOp, paramIndex };
}

interface ShiftResult { shift: string | null; paramIndex: number; }
function resolveShift<TCol, TRow>(
  SHIFT: { limit: number | null, offset: number | null },
  paramIndex: number, params: any[], format: Format
): ShiftResult {
  const pai = format.paramsAppendIndex;
  const pp = format.paramsPrefix;

  let shift: string | null = "";
  let char = "";
  if (SHIFT.limit !== null && SHIFT.limit >= 0) {
    shift += pai ? `LIMIT ${pp}${paramIndex}` : `LIMIT ${pp}`;
    paramIndex++;
    params.push(SHIFT.limit);
    char = " ";
  }
  if (SHIFT.offset !== null && SHIFT.offset >= 0) {
    shift += pai ? `${char}OFFSET ${pp}${paramIndex}` : `${char}OFFSET ${pp}`;
    params.push(SHIFT.offset);
    paramIndex++;
  }
  return { shift, paramIndex };
}

interface ParsedSelectQuery {
  distinct:    boolean;
  columns:     string;
  whereClause: string | null;
  inOp:        string | null;
  likeOp:      string | null;
  order:       string | null;
  shift:       string | null;
  params:      any[];
}
export function parseSelectQuery<TCol, TRow>(query: SelectQueryParams<TCol, TRow>, format: Format): ParsedSelectQuery {
  const qc = format.quotingChar;

  const distinct = query.distinct === true;
  let columns:     string = "";
  let whereClause: string | null = null;
  let inOp:        string | null = null;
  let likeOp:      string | null = null;
  let order:       string | null = null;
  let shift:       string | null = null;
  const params:    any[] = [];

  const colsCount = query.cols.length;
  if (colsCount === 0) throw new Error("No columns provided for the select statement!");

  for (let i = 0; i < colsCount; i++) {
    const col = query.cols[i];
    if (col !== "*") columns += `${qc}${col}${qc}, `;
    else columns += "*, ";
  }
  columns = columns.slice(0, -2);

  let paramIndex = format.paramsStartIndex;
  if (query.where) {
    const whereClauseResult = resolveWhereClause<TCol, TRow>(query.where, paramIndex, params, format);
    whereClause = whereClauseResult.whereClause;
    paramIndex  = whereClauseResult.paramIndex;
  }
  if (query.in) {
    const inOpResult = resolveInOperator<TCol, TRow>(query.in, paramIndex, params, format);
    inOp       = inOpResult.inOp;
    paramIndex = inOpResult.paramIndex;
  }
  if (query.like) {
    const likeOpResult = resolveLikeOperator<TCol, TRow>(query.like, paramIndex, params, format);
    likeOp     = likeOpResult.likeOp;
    paramIndex = likeOpResult.paramIndex;
  }
  if (query.order) order = `ORDER BY ${qc}${query.order.by}${qc} ${query.order.type}`;
  if (query.shift) {
    const shiftResult = resolveShift<TCol, TRow>(query.shift, paramIndex, params, format);
    shift      = shiftResult.shift;
    paramIndex = shiftResult.paramIndex;
  }

  return { distinct, columns, whereClause, inOp, likeOp, order, shift, params };
}

interface ParsedUpdateQuery {
  colValPairs: string;
  whereClause: string | null;
  inOp:        string | null;
  likeOp:      string | null;
  returning:   string | null;
  params:      any[];
}
export function parseUpdateQuery<TCol, TRow>(query: UpdateQueryParams<TCol, TRow>, format: Format): ParsedUpdateQuery {
  const qc = format.quotingChar;
  const pai = format.paramsAppendIndex;
  const pp = format.paramsPrefix;

  let colValPairs: string = "";
  let whereClause: string | null = null;
  let inOp:        string | null = null;
  let likeOp:      string | null = null;
  let returning:   string | null = null;
  const params:    any[] = [];

  if (!query.where && !query.in && !query.like) throw new Error("Update query needs a where clause!");
  if (Object.keys(query.set as any).length === 0) throw new Error("No update data was provided!");

  let paramIndex = format.paramsStartIndex;
  for (const [key, value] of Object.entries(query.set as any)) {
    colValPairs += pai ? `${qc}${key}${qc} = ${pp}${paramIndex}, ` : `${qc}${key}${qc} = ${pp}, `;
    paramIndex++;
    params.push(value);
  }
  colValPairs = colValPairs.slice(0, -2);

  if (query.where) {
    const whereClauseResult = resolveWhereClause<TCol, TRow>(query.where, paramIndex, params, format);
    whereClause = whereClauseResult.whereClause;
    paramIndex  = whereClauseResult.paramIndex;
  }
  if (query.in) {
    const inOpResult = resolveInOperator<TCol, TRow>(query.in, paramIndex, params, format);
    inOp       = inOpResult.inOp;
    paramIndex = inOpResult.paramIndex;
  }
  if (query.like) {
    const likeOpResult = resolveLikeOperator<TCol, TRow>(query.like, paramIndex, params, format);
    likeOp     = likeOpResult.likeOp;
    paramIndex = likeOpResult.paramIndex;
  }

  if (!whereClause && !inOp && !likeOp) throw new Error("Update query needs at least one non-empty condition!");

  returning = resolveReturning(query.return, qc);

  return { colValPairs, whereClause, inOp, likeOp, returning, params };
}

interface ParsedDeleteQuery {
  whereClause: string | null;
  inOp:        string | null;
  likeOp:      string | null;
  returning:   string | null;
  params:      any[];
}
export function parseDeleteQuery<TCol, TRow>(query: DeleteQueryParams<TCol, TRow>, format: Format): ParsedDeleteQuery {
  const qc = format.quotingChar;

  let whereClause: string | null = null;
  let inOp:        string | null = null;
  let likeOp:      string | null = null;
  let returning:   string | null = null;
  const params:    any[] = [];

  if (!query.where && !query.in && !query.like) throw new Error("Delete query needs a where clause!");

  let paramIndex = format.paramsStartIndex;
  if (query.where) {
    const whereClauseResult = resolveWhereClause<TCol, TRow>(query.where, paramIndex, params, format);
    whereClause = whereClauseResult.whereClause;
    paramIndex  = whereClauseResult.paramIndex;
  }
  if (query.in) {
    const inOpResult = resolveInOperator<TCol, TRow>(query.in, paramIndex, params, format);
    inOp       = inOpResult.inOp;
    paramIndex = inOpResult.paramIndex;
  }
  if (query.like) {
    const likeOpResult = resolveLikeOperator<TCol, TRow>(query.like, paramIndex, params, format);
    likeOp     = likeOpResult.likeOp;
    paramIndex = likeOpResult.paramIndex;
  }

  if (!whereClause && !inOp && !likeOp) throw new Error("Delete query needs at least one non-empty condition!");

  returning = resolveReturning(query.return, qc);

  return { whereClause, inOp, likeOp, returning, params };
}
// End query parser

// SQL code gen
export interface SQMAPI<TCol, TRow> {
  insert: (query: InsertQueryParams<TCol, TRow>) => SQLData;
  select: (query: SelectQueryParams<TCol, TRow>) => SQLData;
  update: (query: UpdateQueryParams<TCol, TRow>) => SQLData;
  delete: (query: DeleteQueryParams<TCol, TRow>) => SQLData;
}

export const buildInsertQuery = (schema: string | null, tableName: string, parsedQuery: ParsedInsertQuery, quotingChar: QuotingChar): string => {
  let finalQuery = `INSERT INTO ${quotingChar}${schema}${quotingChar}.${quotingChar}${tableName}${quotingChar} `;
  if (!schema) finalQuery = `INSERT INTO ${quotingChar}${tableName}${quotingChar} `;
  finalQuery += `${parsedQuery.columns} VALUES ${parsedQuery.values}`;
  if (parsedQuery.returning !== null) finalQuery += ` RETURNING ${parsedQuery.returning};`;
  else finalQuery += ";";
  return finalQuery;
};

export const buildSelectQuery = (schema: string | null, tableName: string, parsedQuery: ParsedSelectQuery, quotingChar: QuotingChar, between?: BetweenOp): string => {
  const distinct = parsedQuery.distinct ? "DISTINCT " : "";
  let finalQuery = `SELECT ${distinct}${parsedQuery.columns} FROM ${quotingChar}${schema}${quotingChar}.${quotingChar}${tableName}${quotingChar}`;
  if (!schema) finalQuery = `SELECT ${distinct}${parsedQuery.columns} FROM ${quotingChar}${tableName}${quotingChar}`;
  between = between || "AND";
  let containsWhere = false;
  if (parsedQuery.whereClause) {
    containsWhere = true;
    finalQuery += ` WHERE ${parsedQuery.whereClause}`;
  }
  if (parsedQuery.inOp) {
    if (!containsWhere) {
      finalQuery += " WHERE";
      containsWhere = true;
    } else finalQuery += ` ${between}`;
    finalQuery += ` ${parsedQuery.inOp}`;
  }
  if (parsedQuery.likeOp) {
    if (!containsWhere) {
      finalQuery += " WHERE";
      containsWhere = true;
    } else finalQuery += ` ${between}`;
    finalQuery += ` ${parsedQuery.likeOp}`;
  }
  if (parsedQuery.order !== null) finalQuery += ` ${parsedQuery.order}`;
  if (parsedQuery.shift !== null) finalQuery += ` ${parsedQuery.shift}`;
  finalQuery += ";";
  return finalQuery;
};

export const buildUpdateQuery = (schema: string | null, tableName: string, parsedQuery: ParsedUpdateQuery, quotingChar: QuotingChar, between?: BetweenOp): string => {
  let finalQuery = `UPDATE ${quotingChar}${schema}${quotingChar}.${quotingChar}${tableName}${quotingChar} SET ${parsedQuery.colValPairs}`;
  if (!schema) finalQuery = `UPDATE ${quotingChar}${tableName}${quotingChar} SET ${parsedQuery.colValPairs}`;
  between = between || "AND";
  let containsWhere = false;
  if (parsedQuery.whereClause) {
    containsWhere = true;
    finalQuery += ` WHERE ${parsedQuery.whereClause}`;
  }
  if (parsedQuery.inOp) {
    if (!containsWhere) {
      finalQuery += " WHERE";
      containsWhere = true;
    } else finalQuery += ` ${between}`;
    finalQuery += ` ${parsedQuery.inOp}`;
  }
  if (parsedQuery.likeOp) {
    if (!containsWhere) {
      finalQuery += " WHERE";
      containsWhere = true;
    } else finalQuery += ` ${between}`;
    finalQuery += ` ${parsedQuery.likeOp}`;
  }
  if (parsedQuery.returning !== null) finalQuery += ` RETURNING ${parsedQuery.returning};`;
  else finalQuery += ";";
  return finalQuery;
};

export const buildDeleteQuery = (schema: string | null, tableName: string, parsedQuery: ParsedDeleteQuery, quotingChar: QuotingChar, between?: BetweenOp): string => {
  let finalQuery = `DELETE FROM ${quotingChar}${schema}${quotingChar}.${quotingChar}${tableName}${quotingChar}`;
  if (!schema) finalQuery = `DELETE FROM ${quotingChar}${tableName}${quotingChar}`;
  between = between || "AND";
  let containsWhere = false;
  if (parsedQuery.whereClause) {
    containsWhere = true;
    finalQuery += ` WHERE ${parsedQuery.whereClause}`;
  }
  if (parsedQuery.inOp) {
    if (!containsWhere) {
      finalQuery += " WHERE";
      containsWhere = true;
    } else finalQuery += ` ${between}`;
    finalQuery += ` ${parsedQuery.inOp}`;
  }
  if (parsedQuery.likeOp) {
    if (!containsWhere) {
      finalQuery += " WHERE";
      containsWhere = true;
    } else finalQuery += ` ${between}`;
    finalQuery += ` ${parsedQuery.likeOp}`;
  }
  if (parsedQuery.returning !== null) finalQuery += ` RETURNING ${parsedQuery.returning};`;
  else finalQuery += ";";
  return finalQuery;
};

export function genAPI<TRow>(tableName: string, schema: string | null, format: Format): SQMAPI<ExtractColsFromRow<TRow>, TRow> {
  return {
    insert: (query: InsertQueryParams<ExtractColsFromRow<TRow>, TRow>): SQLData => {
      const finalSchema = query.schema === null ? null : query.schema || schema;
      const parsedQuery = parseInsertQuery<ExtractColsFromRow<TRow>, TRow>(query, format);
      const finalQuery = buildInsertQuery(finalSchema, tableName, parsedQuery, format.quotingChar);
      return { query: finalQuery, params: parsedQuery.params };
    },
    select: (query: SelectQueryParams<ExtractColsFromRow<TRow>, TRow>): SQLData => {
      const finalSchema = query.schema === null ? null : query.schema || schema;
      const parsedQuery = parseSelectQuery<ExtractColsFromRow<TRow>, TRow>(query, format);
      let finalQuery = buildSelectQuery(finalSchema, tableName, parsedQuery, format.quotingChar, query.between);
      return { query: finalQuery, params: parsedQuery.params };
    },
    update: (query: UpdateQueryParams<ExtractColsFromRow<TRow>, TRow>): SQLData => {
      const finalSchema = query.schema === null ? null : query.schema || schema;
      const parsedQuery = parseUpdateQuery<ExtractColsFromRow<TRow>, TRow>(query, format);
      let finalQuery = buildUpdateQuery(finalSchema, tableName, parsedQuery, format.quotingChar, query.between);
      return { query: finalQuery, params: parsedQuery.params };
    },
    delete: (query: DeleteQueryParams<ExtractColsFromRow<TRow>, TRow>): SQLData => {
      const finalSchema = query.schema === null ? null : query.schema || schema;
      const parsedQuery = parseDeleteQuery<ExtractColsFromRow<TRow>, TRow>(query, format);
      let finalQuery = buildDeleteQuery(finalSchema, tableName, parsedQuery, format.quotingChar, query.between);
      return { query: finalQuery, params: parsedQuery.params };
    },
  };
}
// End SQL code gen
