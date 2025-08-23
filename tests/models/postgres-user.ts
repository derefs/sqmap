import * as SQM from "../../sqmap.js";
import { genPostgresPGAPI } from "../../apis/postgres-pg.js";

export interface Row {
  id?:          number;
  created?:     Date;
  updated?:     Date;
  status?:      Status;
  username?:    string;
  email?:       string;
  stripe_id?:   string;
  password?:    string;
  verified_at?: Date;
}

export enum Status {
  Active           = "active",
  Banned           = "banned",
  Deactivated      = "deactivated",
  AwaitingDeletion = "awaiting_deletion",
  SoftDeleted      = "soft_deleted",
  Deleted          = "deleted"
}

export const db = SQM.genAPI<Row>("users");
// export const db2 = genPostgresPGAPI<Row>("users", { schema: "pg" });