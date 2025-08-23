import { PoolClient, QueryResult, QueryResultRow } from "pg";
import * as SQM from "../sqmap.js";

export interface SQMPostgresPGAPI<TCol, TRow extends QueryResultRow> {
  insert:    (client: PoolClient, query: SQM.InsertQueryParams<TCol, TRow>) => Promise<QueryResult<TRow>>;
  select:    (client: PoolClient, query: SQM.SelectQueryParams<TCol, TRow>) => Promise<QueryResult<TRow>>;
  update:    (client: PoolClient, query: SQM.UpdateQueryParams<TCol, TRow>) => Promise<QueryResult<TRow>>;
  delete:    (client: PoolClient, query: SQM.DeleteQueryParams<TCol, TRow>) => Promise<QueryResult<TRow>>;
  sql:       (client: PoolClient, query: string, params: any[])         => Promise<QueryResult<TRow | any>>;
}

export function genPostgresPGAPI<TRow extends QueryResultRow>(tableName: string, defaultValues?: SQM.DefaultValues): SQMPostgresPGAPI<SQM.ExtractColsFromRow<TRow>, TRow> {
  const DEFAULT_SCHEMA = (defaultValues && defaultValues.schema) || "public";
  const DEFAULT_FORMAT: SQM.Format = (defaultValues && defaultValues.format) || SQM.FORMATS.POSTGRES_PG;

  return {
    insert: (client: PoolClient, query: SQM.InsertQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Promise<QueryResult<TRow>> => {
      const schema = query.schema || DEFAULT_SCHEMA;
      const parsedQuery = SQM.parseInsertQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, DEFAULT_FORMAT);
      let finalQuery = SQM.buildInsertQuery(schema, tableName, parsedQuery);
      return client.query(finalQuery, parsedQuery.params);
    },
    select: (client: PoolClient, query: SQM.SelectQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Promise<QueryResult<TRow>> => {
      const schema = query.schema || DEFAULT_SCHEMA;
      const parsedQuery = SQM.parseSelectQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, { prefix: "$", appendIndex: true });
      let finalQuery = SQM.buildSelectQuery(schema, tableName, parsedQuery, query.between);
      return client.query(finalQuery, parsedQuery.params);
    },
    update: (client: PoolClient, query: SQM.UpdateQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Promise<QueryResult<TRow>> => {
      const schema = query.schema || DEFAULT_SCHEMA;
      const parsedQuery = SQM.parseUpdateQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, { prefix: "$", appendIndex: true });
      let finalQuery = SQM.buildUpdateQuery(schema, tableName, parsedQuery, query.between);
      return client.query(finalQuery, parsedQuery.params);
    },
    delete: (client: PoolClient, query: SQM.DeleteQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Promise<QueryResult<TRow>> => {
      const schema = query.schema || DEFAULT_SCHEMA;
      const parsedQuery = SQM.parseDeleteQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, { prefix: "$", appendIndex: true });
      let finalQuery = SQM.buildDeleteQuery(schema, tableName, parsedQuery, query.between);
      return client.query(finalQuery, parsedQuery.params);
    },
    sql: (client: PoolClient, query: string, params: any[]): Promise<QueryResult<TRow | any>> => {
      return client.query(query, params);
    },
  };
}

export function expect<TRow extends QueryResultRow>(queryResult: QueryResult<TRow>, rowCount: number, error: Error): TRow[] {
  if (queryResult.rowCount === rowCount && queryResult.rows.length === rowCount) return queryResult.rows;
  throw error;
}

export function expectOne<TRow extends QueryResultRow>(queryResult: QueryResult<TRow>, error: Error): TRow {
  if (queryResult.rowCount === 1 && queryResult.rows.length === 1) return queryResult.rows[0];
  throw error;
}