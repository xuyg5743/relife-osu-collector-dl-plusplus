declare module "fs";
declare module "path";
declare module "child_process";

declare namespace NodeJS {
  interface Process {
    pkg?: unknown;
  }
}
