import { Database } from "bun:sqlite";
import * as SQM from "../sqmap.js";

export interface SQMSQLiteBunAPI<TCol, TRow> {
  insert: (db: Database, query: SQM.InsertQueryParams<TCol, TRow>) => Array<TRow>;
  select: (db: Database, query: SQM.SelectQueryParams<TCol, TRow>) => Array<TRow>;
  update: (db: Database, query: SQM.UpdateQueryParams<TCol, TRow>) => Array<TRow>;
  delete: (db: Database, query: SQM.DeleteQueryParams<TCol, TRow>) => Array<TRow>;
  sql:    (db: Database, query: string, params: any[])             => Array<TRow | any>;
}

export function genSQLiteBunAPI<TRow>(tableName: string, format: SQM.Format): SQMSQLiteBunAPI<SQM.ExtractColsFromRow<TRow>, TRow> {
  return {
    insert: (db: Database, query: SQM.InsertQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Array<TRow> => {
      const parsedQuery = SQM.parseInsertQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, format);
      let finalQuery = SQM.buildInsertQuery(null, tableName, parsedQuery, format.quotingChar);
      return db.query(finalQuery).all(...parsedQuery.params) as TRow[];
    },
    select: (db: Database, query: SQM.SelectQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Array<TRow> => {
      const parsedQuery = SQM.parseSelectQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, format);
      let finalQuery = SQM.buildSelectQuery(null, tableName, parsedQuery, format.quotingChar, query.between);
      return db.query(finalQuery).all(...parsedQuery.params) as TRow[];
    },
    update: (db: Database, query: SQM.UpdateQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Array<TRow> => {
      const parsedQuery = SQM.parseUpdateQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, format);
      let finalQuery = SQM.buildUpdateQuery(null, tableName, parsedQuery, format.quotingChar, query.between);
      return db.query(finalQuery).all(...parsedQuery.params) as TRow[];
    },
    delete: (db: Database, query: SQM.DeleteQueryParams<SQM.ExtractColsFromRow<TRow>, TRow>): Array<TRow> => {
      const parsedQuery = SQM.parseDeleteQuery<SQM.ExtractColsFromRow<TRow>, TRow>(query, format);
      let finalQuery = SQM.buildDeleteQuery(null, tableName, parsedQuery, format.quotingChar, query.between);
      return db.query(finalQuery).all(...parsedQuery.params) as TRow[];
    },
    sql: (db: Database, query: string, params: any[]): Array<TRow | any> => {
      return db.query(query).all(...params) as TRow[];
    },
  };
}

export function expect<TRow>(queryResult: Array<TRow>, rowCount: number, error: Error): TRow[] {
  if (queryResult.length === rowCount) return queryResult;
  throw error;
}

export function expectOne<TRow>(queryResult: Array<TRow>, error: Error): TRow {
  if (queryResult.length === 1) return queryResult[0];
  throw error;
}