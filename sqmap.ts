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

export interface Format {
  params: {
    prefix: "$" | "?";
    index:  "from-0" | "from-1" | "named" | false;
  };
  quotingChar: `"` | "`";
}

type Formats = "POSTGRES_PG" | "SQLITE_BUN";
export const FORMATS: Record<Formats, Format> = {
  POSTGRES_PG: {
    params: { prefix: "$", index: "from-1" },
    quotingChar: `"`
  },
  SQLITE_BUN: {
    params: { prefix: "?", index: "from-1" },
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

interface ParamsFormat {
  prefix:      string;
  appendIndex: boolean;
}

const initParamIndex = (format: Format): number => {
  if (format.params.index === "from-1") return 1;
  return 0;
};

const escapeName = (format: Format, name: string): string => {
  return `${format.quotingChar}${name}${format.quotingChar}`;
};

const escapeParam = (format: Format, index: number, name: string): string => {
  if (format.params.index === "from-1" || format.params.index === "from-0") {
    return `${format.params.prefix}${index}`;
  } else if (format.params.index === "named") {
    return `${format.params.prefix}${name}`;
  }
  return format.params.prefix;
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

  // FIXME:
  // for (let i = 0; i < colsCount; i++) columns += `"${query.cols[i]}", `;
  for (let i = 0; i < colsCount; i++) columns += `${escapeName(format, query.cols[i] as string)}, `;
  columns = columns.slice(0, -2);
  columns += ")";

  // FIXME:
  let paramIndex = initParamIndex(format);
  for (let i = 0; i < rowsCount; i++) {
    const row = query.rows[i];
    for (let j = 0; j < colsCount; j++) {
      const col = query.cols[j];
      // FIXME:
      // if (paramsFormat.appendIndex) values += `${paramsFormat.prefix}${paramIndex}, `;
      // else values += `${paramsFormat.prefix}, `;
      values += `${escapeParam(format, paramIndex, col as string)}, `
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
      returnColumns += `"${query.return[i]}", `;
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
  paramIndex: number, params: any[], paramsFormat: ParamsFormat
): WhereClauseResult {
  let whereClause: string | null = null;
  if (typeof WHERE[0] === "object" && !Array.isArray(WHERE[0])) {
    whereClause = "";
    const target = WHERE[0];
    const op = WHERE[1] || "=";
    const between = WHERE[2] || "AND";
    whereClause = "";
    for (const [key, value] of Object.entries(target as any)) {
      if (paramsFormat.appendIndex) whereClause += `"${key}"${op}${paramsFormat.prefix}${paramIndex} ${between} `;
      else whereClause += `"${key}"${op}${paramsFormat.prefix} ${between} `;
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
        if (paramsFormat.appendIndex) whereClause += ` "${col}"${op}${paramsFormat.prefix}${paramIndex} `;
        else whereClause += ` "${col}"${op}${paramsFormat.prefix} `;
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
  paramIndex: number, params: any[], paramsFormat: ParamsFormat
): InOpResult {
  let inOp: string | null = "";
  for (let i = 0; i < IN.length; i++) {
    const token = IN[i];
    if (Array.isArray(token)) {
      const col = token[0];
      const op = token[1];
      const values = token[2];
      inOp += `"${col}" ${op} (`;
      for (let j = 0; j < values.length; j++) {
        const value = values[j];
        if (paramsFormat.appendIndex) inOp += `${paramsFormat.prefix}${paramIndex}, `;
        else inOp += `${paramsFormat.prefix}, `;
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
  paramIndex: number, params: any[], paramsFormat: ParamsFormat
): LikeOpResult {
  let likeOp: string | null = "";
  for (let i = 0; i < LIKE.length; i++) {
    const token = LIKE[i];
    if (Array.isArray(token)) {
      const col = token[0];
      const op = token[1];
      if (paramsFormat.appendIndex) likeOp += `"${col}" ${op} ${paramsFormat.prefix}${paramIndex} `;
      else likeOp += `"${col}" ${op} ${paramsFormat.prefix} `;
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
  paramIndex: number, params: any[], paramsFormat: ParamsFormat
): ShiftResult {
  let shift: string | null = "";
  let char = "";
  if (SHIFT.limit !== null && SHIFT.limit >= 0) {
    if (paramsFormat.appendIndex) shift += `LIMIT ${paramsFormat.prefix}${paramIndex}`;
    else shift += `LIMIT ${paramsFormat.prefix}`;
    paramIndex++;
    params.push(SHIFT.limit);
    char = " ";
  }
  if (SHIFT.offset !== null && SHIFT.offset >= 0) {
    if (paramsFormat.appendIndex) shift += `${char}OFFSET ${paramsFormat.prefix}${paramIndex}`;
    else shift += `${char}OFFSET ${paramsFormat.prefix}`;
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
export function parseSelectQuery<TCol, TRow>(query: SelectQueryParams<TCol, TRow>, paramsFormat: ParamsFormat): ParsedSelectQuery {
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
    if (col !== "*") columns += `"${col}", `;
    else columns += "*, ";
  }
  columns = columns.slice(0, -2);

  let paramIndex: number = 1;
  if (query.where) {
    const whereClauseResult = resolveWhereClause<TCol, TRow>(query.where, paramIndex, params, paramsFormat);
    whereClause = whereClauseResult.whereClause;
    paramIndex  = whereClauseResult.paramIndex;
  }
  if (query.in) {
    const inOpResult = resolveInOperator<TCol, TRow>(query.in, paramIndex, params, paramsFormat);
    inOp       = inOpResult.inOp;
    paramIndex = inOpResult.paramIndex;
  }
  if (query.like) {
    const likeOpResult = resolveLikeOperator<TCol, TRow>(query.like, paramIndex, params, paramsFormat);
    likeOp     = likeOpResult.likeOp;
    paramIndex = likeOpResult.paramIndex;
  }
  if (query.order) order = `ORDER BY "${query.order.by}" ${query.order.type}`;
  if (query.shift) {
    const shiftResult = resolveShift<TCol, TRow>(query.shift, paramIndex, params, paramsFormat);
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
export function parseUpdateQuery<TCol, TRow>(query: UpdateQueryParams<TCol, TRow>, paramsFormat: ParamsFormat): ParsedUpdateQuery {
  let colValPairs: string = "";
  let whereClause: string | null = null;
  let inOp:        string | null = null;
  let likeOp:      string | null = null;
  let returning:   string | null = null;
  const params:    any[] = [];

  if (!query.where && !query.in && !query.like) throw new Error("Update query needs a where clause!");
  if (Object.keys(query.set as any).length === 0) throw new Error("No update data was provided!");

  let paramIndex: number = 1;
  for (const [key, value] of Object.entries(query.set as any)) {
    colValPairs += `"${key}"=$${paramIndex}, `;
    paramIndex++;
    params.push(value);
  }
  colValPairs = colValPairs.slice(0, -2);

  if (query.where) {
    const whereClauseResult = resolveWhereClause<TCol, TRow>(query.where, paramIndex, params, paramsFormat);
    whereClause = whereClauseResult.whereClause;
    paramIndex  = whereClauseResult.paramIndex;
  }
  if (query.in) {
    const inOpResult = resolveInOperator<TCol, TRow>(query.in, paramIndex, params, paramsFormat);
    inOp       = inOpResult.inOp;
    paramIndex = inOpResult.paramIndex;
  }
  if (query.like) {
    const likeOpResult = resolveLikeOperator<TCol, TRow>(query.like, paramIndex, params, paramsFormat);
    likeOp     = likeOpResult.likeOp;
    paramIndex = likeOpResult.paramIndex;
  }

  if (query.return === "*") returning = "*";
  else if (query.return !== undefined) {
    let returnColumns = "";
    for (let i = 0; i < query.return.length; i++) {
      returnColumns += `"${query.return[i]}", `;
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
export function parseDeleteQuery<TCol, TRow>(query: DeleteQueryParams<TCol, TRow>, paramsFormat: ParamsFormat): ParsedDeleteQuery {
  let whereClause: string | null = null;
  let inOp:        string | null = null;
  let likeOp:      string | null = null;
  let returning:   string | null = null;
  const params:    any[] = [];

  if (!query.where && !query.in && !query.like) throw new Error("Delete query needs a where clause!");

  let paramIndex: number = 1;
  if (query.where) {
    const whereClauseResult = resolveWhereClause<TCol, TRow>(query.where, paramIndex, params, paramsFormat);
    whereClause = whereClauseResult.whereClause;
    paramIndex  = whereClauseResult.paramIndex;
  }
  if (query.in) {
    const inOpResult = resolveInOperator<TCol, TRow>(query.in, paramIndex, params, paramsFormat);
    inOp       = inOpResult.inOp;
    paramIndex = inOpResult.paramIndex;
  }
  if (query.like) {
    const likeOpResult = resolveLikeOperator<TCol, TRow>(query.like, paramIndex, params, paramsFormat);
    likeOp     = likeOpResult.likeOp;
    paramIndex = likeOpResult.paramIndex;
  }

  if (query.return === "*") returning = "*";
  else if (query.return !== undefined) {
    let returnColumns = "";
    for (let i = 0; i < query.return.length; i++) {
      returnColumns += `"${query.return[i]}", `;
    }
    returnColumns = returnColumns.slice(0, -2);
    returning = returnColumns;
  }

  return { whereClause, inOp, likeOp, returning, params };
}
// End query parser
// SQL code gen
export interface DefaultValues {
  schema?: string;
  format?: Format;
}

export interface SQMAPI<TCol, TRow> {
  insert: (query: InsertQueryParams<TCol, TRow>) => SQLData;
  select: (query: SelectQueryParams<TCol, TRow>) => SQLData;
  update: (query: UpdateQueryParams<TCol, TRow>) => SQLData;
  delete: (query: DeleteQueryParams<TCol, TRow>) => SQLData;
}

export const buildInsertQuery = (schema: string | null, tableName: string, parsedQuery: ParsedInsertQuery): string => {
  let finalQuery = `INSERT INTO "${schema}"."${tableName}" `;
  if (!schema) finalQuery = `INSERT INTO "${tableName}" `;
  finalQuery += `${parsedQuery.columns} VALUES ${parsedQuery.values}`;
  if (parsedQuery.returning !== null) finalQuery += ` RETURNING ${parsedQuery.returning};`;
  else finalQuery += ";";
  return finalQuery;
};

export const buildSelectQuery = (schema: string | null, tableName: string, parsedQuery: ParsedSelectQuery, between?: BetweenOp): string => {
  let finalQuery = `SELECT ${parsedQuery.columns} FROM "${schema}"."${tableName}"`;
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

export const buildUpdateQuery = (schema: string | null, tableName: string, parsedQuery: ParsedUpdateQuery, between?: BetweenOp): string => {
  let finalQuery = `UPDATE "${schema}"."${tableName}" SET ${parsedQuery.colValPairs}`;
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

export const buildDeleteQuery = (schema: string | null, tableName: string, parsedQuery: ParsedDeleteQuery, between?: BetweenOp): string => {
  let finalQuery = `DELETE FROM "${schema}"."${tableName}"`;
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

export function genAPI<TRow>(tableName: string, defaultValues?: DefaultValues): SQMAPI<ExtractColsFromRow<TRow>, TRow> {
  const DEFAULT_SCHEMA = (defaultValues && defaultValues.schema) ?? null;
  const DEFAULT_FORMAT: Format = (defaultValues && defaultValues.format) || FORMATS.POSTGRES_PG;

  return {
    insert: (query: InsertQueryParams<ExtractColsFromRow<TRow>, TRow>): SQLData => {
      const schema = query.schema || DEFAULT_SCHEMA;
      const parsedQuery = parseInsertQuery<ExtractColsFromRow<TRow>, TRow>(query, DEFAULT_FORMAT);
      const finalQuery = buildInsertQuery(schema, tableName, parsedQuery);
      return { query: finalQuery, params: parsedQuery.params };
    },
    select: (query: SelectQueryParams<ExtractColsFromRow<TRow>, TRow>): SQLData => {
      const schema = query.schema || DEFAULT_SCHEMA;
      const parsedQuery = parseSelectQuery<ExtractColsFromRow<TRow>, TRow>(query, { prefix: "$", appendIndex: true });
      let finalQuery = buildSelectQuery(schema, tableName, parsedQuery, query.between);
      return { query: finalQuery, params: parsedQuery.params };
    },
    update: (query: UpdateQueryParams<ExtractColsFromRow<TRow>, TRow>): SQLData => {
      const schema = query.schema || DEFAULT_SCHEMA;
      const parsedQuery = parseUpdateQuery<ExtractColsFromRow<TRow>, TRow>(query, { prefix: "$", appendIndex: true });
      let finalQuery = buildUpdateQuery(schema, tableName, parsedQuery, query.between);
      return { query: finalQuery, params: parsedQuery.params };
    },
    delete: (query: DeleteQueryParams<ExtractColsFromRow<TRow>, TRow>): SQLData => {
      const schema = query.schema || DEFAULT_SCHEMA;
      const parsedQuery = parseDeleteQuery<ExtractColsFromRow<TRow>, TRow>(query, { prefix: "$", appendIndex: true });
      let finalQuery = buildDeleteQuery(schema, tableName, parsedQuery, query.between);
      return { query: finalQuery, params: parsedQuery.params };
    },
  };
}
// End SQL code gen