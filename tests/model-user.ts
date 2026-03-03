import * as SQM from "../sqmap.js";
import { recordQueryInput } from "./helpers.js";

export interface Row {
  id?: number;
  created?: Date;
  updated?: Date;
  status?: Status;
  username?: string;
  email?: string;
  stripe_id?: string;
  password?: string;
  verified_at?: Date;
}

export enum Status {
  Active = "active",
  Banned = "banned",
  Deactivated = "deactivated",
  AwaitingDeletion = "awaiting_deletion",
  SoftDeleted = "soft_deleted",
  Deleted = "deleted"
}

export interface ModelFixture {
  name: string;
  table: string;
  schema: string;
  format: SQM.Format;
  db: SQM.SQMAPI<SQM.ExtractColsFromRow<Row>, Row>;
}

const TABLE_NAME = "users";
const DEFAULT_SCHEMA = "fh";

const questionIndexedFormat: SQM.Format = {
  paramsPrefix: "?",
  paramsStartIndex: 0,
  paramsAppendIndex: true,
  quotingChar: "`"
};

const questionNoIndexFormat: SQM.Format = {
  paramsPrefix: "?",
  paramsStartIndex: 0,
  paramsAppendIndex: false,
  quotingChar: "`"
};

function createFixture(name: string, format: SQM.Format): ModelFixture {
  const rawDb = SQM.genAPI<Row>(TABLE_NAME, DEFAULT_SCHEMA, format);
  return {
    name,
    table: TABLE_NAME,
    schema: DEFAULT_SCHEMA,
    format,
    db: {
      insert: (query) => {
        recordQueryInput("insert", query);
        return rawDb.insert(query);
      },
      select: (query) => {
        recordQueryInput("select", query);
        return rawDb.select(query);
      },
      update: (query) => {
        recordQueryInput("update", query);
        return rawDb.update(query);
      },
      delete: (query) => {
        recordQueryInput("delete", query);
        return rawDb.delete(query);
      }
    }
  };
}

export const MODEL_FIXTURES: ModelFixture[] = [
  createFixture("question-indexed", questionIndexedFormat),
  createFixture("dollar-indexed", SQM.FORMATS.POSTGRES_PG),
  createFixture("question-noindex", questionNoIndexFormat)
];

export const PRIMARY_MODEL: ModelFixture = MODEL_FIXTURES[0];
