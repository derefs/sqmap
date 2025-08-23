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
export interface ParsedInsertQuery {
  columns:   string;
  values:    string;
  returning: string | null;
  params:    any[];
}

const escapeName = (quotingChar: QuotingChar, name: string): string => {
  return `${quotingChar}${name}${quotingChar}`;
};

const escapeParam = (prefix: ParamsPrefix, index: number, append: boolean): string => {
  if (append) return `${prefix}${index}`;
  return prefix;
};

export function parseInsertQuery<TCol, TRow>(query: InsertQueryParams<TCol, TRow>, format: Format): ParsedInsertQuery {
  let columns:   string = "(";
  let values:    string = "(";
  let returning: string | null = null;
  let params:    any[] = [];

  const colsCount = query.cols.length;
  const rowsCount = query.rows.length;
  if (colsCount === 0) throw new Error("No columns provided for the insert statement!");
  if (rowsCount === 0) throw new Error("No rows provided for the insert statement!");

  for (let i = 0; i < colsCount; i++) columns += `${escapeName(format.quotingChar, query.cols[i] as string)}, `;
  columns = columns.slice(0, -2);
  columns += ")";

  let paramIndex = format.paramsStartIndex;
  for (let i = 0; i < rowsCount; i++) {
    const row = query.rows[i];
    for (let j = 0; j < colsCount; j++) {
      const col = query.cols[j];
      values += `${escapeParam(format.paramsPrefix, paramIndex, format.paramsAppendIndex)}, `
      paramIndex++;
      params.push((row as any)[col]);
    }
    values = values.slice(0, -2);
    values += "), (";
  }
  values = values.slice(0, -3);

  if (query.return === "*") returning = "*";
  else if (query.return !== undefined) {
    let returnColumns = "";
    for (let i = 0; i < query.return.length; i++) {
      returnColumns += `${escapeName(format.quotingChar, query.return[i] as string)}, `;
    }
    returnColumns = returnColumns.slice(0, -2);
    returning = returnColumns;
  }

  return { columns, values, returning, params };
}

interface WhereClauseResult { whereClause: string | null; paramIndex: number; }
function resolveWhereClause<TCol, TRow>(
  WHERE: [target: TRow, op?: CompOp, between?: BetweenOp] |
         Array<[col: TCol, op: CompOp, value: any] | BetweenExtOp>,
  paramIndex: number, params: any[], format: Format
): WhereClauseResult {
  let whereClause: string | null = null;
  if (typeof WHERE[0] === "object" && !Array.isArray(WHERE[0])) {
    whereClause = "";
    const target = WHERE[0];
    const op = WHERE[1] || "=";
    const between = WHERE[2] || "AND";
    whereClause = "";
    for (const [key, value] of Object.entries(target as any)) {
      whereClause += `${escapeName(format.quotingChar, key)}${op}${escapeParam(format.paramsPrefix, paramIndex, format.paramsAppendIndex)} ${between} `
      paramIndex++;
      params.push(value);
    }
    whereClause = whereClause.slice(0, (between.length + 2) * -1);
  } else if (Array.isArray(WHERE)) {
    whereClause = "";
    for (let i = 0; i < WHERE.length; i++) {
      const token = WHERE[i];
      if (Array.isArray(token)) {
        const col = token[0];
        const op = token[1];
        whereClause += ` ${escapeName(format.quotingChar, col as string)}${op}${escapeParam(format.paramsPrefix, paramIndex, format.paramsAppendIndex)}`
        paramIndex++;
        params.push(token[2]);
      } else {
        if (WHERE.length - 1 !== i) whereClause += token;
      }
    }
    whereClause = whereClause.slice(0, -1);
  }
  return { whereClause, paramIndex };
}

interface InOpResult { inOp: string | null; paramIndex: number; }
function resolveInOperator<TCol, TRow>(
  IN: Array<[col: TCol, op: InOp, value: number[] | string[]] | BetweenExtOp>,
  paramIndex: number, params: any[], format: Format
): InOpResult {
  let inOp: string | null = "";
  for (let i = 0; i < IN.length; i++) {
    const token = IN[i];
    if (Array.isArray(token)) {
      const col = token[0];
      const op = token[1];
      const values = token[2];
      inOp += `${escapeName(format.quotingChar, col as string)} ${op} (`;
      for (let j = 0; j < values.length; j++) {
        const value = values[j];
        inOp += `${escapeParam(format.paramsPrefix, paramIndex, format.paramsAppendIndex)}, `
        paramIndex++;
        params.push(value);
      }
      inOp = inOp.slice(0, -2);
      inOp += ") ";
    } else {
      inOp += token;
    }
  }
  inOp = inOp.slice(0, -1);
  return { inOp, paramIndex };
}

interface LikeOpResult { likeOp: string | null; paramIndex: number; }
function resolveLikeOperator<TCol, TRow>(
  LIKE: Array<[col: TCol, op: LikeOp, value: string] | BetweenExtOp>,
  paramIndex: number, params: any[], format: Format
): LikeOpResult {
  let likeOp: string | null = "";
  for (let i = 0; i < LIKE.length; i++) {
    const token = LIKE[i];
    if (Array.isArray(token)) {
      const col = token[0];
      const op = token[1];
      likeOp += `${escapeName(format.quotingChar, col as string)} ${op} ${escapeParam(format.paramsPrefix, paramIndex, format.paramsAppendIndex)} `
      paramIndex++;
      params.push(token[2]);
    } else {
      likeOp += token;
    }
  }
  likeOp = likeOp.slice(0, -1);
  return { likeOp, paramIndex };
}

interface ShiftResult { shift: string | null; paramIndex: number; }
function resolveShift<TCol, TRow>(
  SHIFT: { limit: number | null, offset: number | null },
  paramIndex: number, params: any[], format: Format
): ShiftResult {
  let shift: string | null = "";
  let char = "";
  if (SHIFT.limit !== null && SHIFT.limit >= 0) {
    shift += `LIMIT ${escapeParam(format.paramsPrefix, paramIndex, format.paramsAppendIndex)}`;
    paramIndex++;
    params.push(SHIFT.limit);
    char = " ";
  }
  if (SHIFT.offset !== null && SHIFT.offset >= 0) {
    shift += `${char}OFFSET ${escapeParam(format.paramsPrefix, paramIndex, format.paramsAppendIndex)}`;
    params.push(SHIFT.offset);
    paramIndex++;
  }
  return { shift, paramIndex };
}

export interface ParsedSelectQuery {
  columns:     string;
  whereClause: string | null;
  inOp:        string | null;
  likeOp:      string | null;
  order:       string | null;
  shift:       string | null;
  params:      any[];
}
export function parseSelectQuery<TCol, TRow>(query: SelectQueryParams<TCol, TRow>, format: Format): ParsedSelectQuery {
  let columns:     string = "";
  let whereClause: string | null = null;
  let inOp:        string | null = null;
  let likeOp:      string | null = null;
  let order:       string | null = null;
  let shift:       string | null = null;
  const params:    any[] = [];

  const colsCount = query.cols.length;
  if (colsCount === 0) throw new Error("No columns provided for the insert statement!");

  for (let i = 0; i < colsCount; i++) {
    const col = query.cols[i];
    if (col !== "*") columns += `${escapeName(format.quotingChar, col as string)}, `;
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
  if (query.order) order = `ORDER BY ${escapeName(format.quotingChar, query.order.by as string)} ${query.order.type}`;
  if (query.shift) {
    const shiftResult = resolveShift<TCol, TRow>(query.shift, paramIndex, params, format);
    shift      = shiftResult.shift;
    paramIndex = shiftResult.paramIndex;
  }

  return { columns, whereClause, inOp, likeOp, order, shift, params };
}

export interface ParsedUpdateQuery {
  colValPairs: string;
  whereClause: string | null;
  inOp:        string | null;
  likeOp:      string | null;
  returning:   string | null;
  params:      any[];
}
export function parseUpdateQuery<TCol, TRow>(query: UpdateQueryParams<TCol, TRow>, format: Format): ParsedUpdateQuery {
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
    colValPairs += `${escapeName(format.quotingChar, key)}=${escapeParam(format.paramsPrefix, paramIndex, format.paramsAppendIndex)}, `;
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

  if (query.return === "*") returning = "*";
  else if (query.return !== undefined) {
    let returnColumns = "";
    for (let i = 0; i < query.return.length; i++) {
      returnColumns += `${escapeName(format.quotingChar, query.return[i] as string)}, `;
    }
    returnColumns = returnColumns.slice(0, -2);
    returning = returnColumns;
  }

  return { colValPairs, whereClause, inOp, likeOp, returning, params };
}

export interface ParsedDeleteQuery {
  whereClause: string | null;
  inOp:        string | null;
  likeOp:      string | null;
  returning:   string | null;
  params:      any[];
}
export function parseDeleteQuery<TCol, TRow>(query: DeleteQueryParams<TCol, TRow>, format: Format): ParsedDeleteQuery {
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

  if (query.return === "*") returning = "*";
  else if (query.return !== undefined) {
    let returnColumns = "";
    for (let i = 0; i < query.return.length; i++) {
      returnColumns += `${escapeName(format.quotingChar, query.return[i] as string)}, `;
    }
    returnColumns = returnColumns.slice(0, -2);
    returning = returnColumns;
  }

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
  let finalQuery = `SELECT ${parsedQuery.columns} FROM ${quotingChar}${schema}${quotingChar}.${quotingChar}${tableName}${quotingChar}`;
  if (!schema) finalQuery = `SELECT ${parsedQuery.columns} FROM ${quotingChar}${tableName}${quotingChar}`;
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
  finalQuery += ";";
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
  finalQuery += ";";
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