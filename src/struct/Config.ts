import { existsSync, writeFileSync } from "fs";
import path from "path";
import Logger from "../core/Logger";
import type { Json, JsonValues, WorkingMode } from "../types";
import Util from "../util";
import OcdlError from "./OcdlError";
import { Mirror, CatboyServer } from "./Constant";

export default class Config {
  parallel: boolean;
  concurrency: number;
  intervalCap: number;
  directory: string;
  mode: WorkingMode;
  logSize: number;
  useSubfolder: boolean;
  osuPath: string;
  mirror: Mirror;
  catboyServer: CatboyServer;
  skipExisting: boolean;
  isFirstRun: boolean;
  lang: "en" | "ru" | "none";
  proxy: string;
  activeProxyIndex: number;
  vlessServers: string[];

  static readonly configFilePath = "./config.json";

  constructor(contents?: string, isFirstRun = false) {
    this.isFirstRun = isFirstRun;
    let config: Json = {};
    if (contents) {
      try {
        config = JSON.parse(contents) as Json;
      } catch (e) {
        throw Logger.generateErrorLog(new OcdlError("INVALID_CONFIG", e));
      }
    }

    this.logSize = !isNaN(Number(config.logSize)) ? Number(config.logSize) : 15;
    if (!Util.checkRange(this.logSize, 0, Infinity)) this.logSize = 15;

    this.parallel = Util.isBoolean(config.parallel)
      ? (config.parallel as boolean)
      : true;

    this.concurrency = !isNaN(Number(config.concurrency))
      ? Number(config.concurrency)
      : 3;
    if (!Util.checkRange(this.concurrency, 0, 10)) this.concurrency = 5;

    this.intervalCap = !isNaN(Number(config.intervalCap))
      ? Number(config.intervalCap)
      : 50;
    if (!Util.checkRange(this.intervalCap, 0, 120)) this.intervalCap = 50;

    this.directory = this._getPath(config.directory);
    this.mode = this._getMode(config.mode);
    this.useSubfolder = Util.isBoolean(config.useSubfolder)
      ? (config.useSubfolder as boolean)
      : true;

    this.osuPath = this._getOsuPath(config.osuPath);

    if (!this.osuPath) {
      const oldColl = this._getPath(config.collectionDbPath);
      const oldSongs = this._getPath(config.songsPath);
      if (oldColl && existsSync(oldColl)) {
        this.osuPath = path.dirname(oldColl);
      } else if (oldSongs && existsSync(oldSongs)) {
        this.osuPath = path.dirname(oldSongs);
      }
    }

    this.mirror = this._getMirror(config.mirror);
    this.catboyServer = this._getCatboyServer(config.catboyServer);
    this.skipExisting = Util.isBoolean(config.skipExisting)
      ? (config.skipExisting as boolean)
      : true;

    this.lang = this._getLang(config.lang);
    this.proxy = typeof config.proxy === "string" ? config.proxy : "";
    this.activeProxyIndex = !isNaN(Number(config.activeProxyIndex))
      ? Number(config.activeProxyIndex)
      : -1;
    this.vlessServers = Array.isArray(config.vlessServers)
      ? (config.vlessServers as unknown[]).filter((s): s is string => typeof s === "string" && s.startsWith("vless://"))
      : [];
  }

  get songsPath(): string {
    if (!this.osuPath) return "";
    return path.join(this.osuPath, "Songs");
  }

  get collectionDbPath(): string {
    if (!this.osuPath) return "";
    return path.join(this.osuPath, "collection.db");
  }

  get osuDbPath(): string {
    if (!this.osuPath) return "";
    return path.join(this.osuPath, "osu!.db");
  }

  isOsuPathValid(): boolean {
    if (!this.osuPath) return false;
    return (
      existsSync(this.osuPath) &&
      existsSync(this.songsPath) &&
      existsSync(this.osuDbPath)
    );
  }

  static generateConfig(): Config {
    const isFirstRun = !existsSync(Config.configFilePath);
    if (isFirstRun) {
      writeFileSync(
        Config.configFilePath,
        JSON.stringify(
          {
            parallel: true,
            concurrency: 5,
            intervalCap: 50,
            logSize: 15,
            directory: "",
            mode: 1,
            useSubfolder: true,
            osuPath: "",
            mirror: Mirror.Catboy,
            catboyServer: CatboyServer.Default,
            skipExisting: true,
            lang: "none",
            proxy: "",
            activeProxyIndex: -1,
            vlessServers: [],
          },
          null,
          2
        )
      );
    }
    return new Config(undefined, isFirstRun);
  }

  save(): void {
    writeFileSync(
      Config.configFilePath,
      JSON.stringify(
        {
          parallel: this.parallel,
          concurrency: this.concurrency,
          intervalCap: this.intervalCap,
          logSize: this.logSize,
          directory: this.directory,
          mode: this.mode,
          useSubfolder: this.useSubfolder,
          osuPath: this.osuPath,
          mirror: this.mirror,
          catboyServer: this.catboyServer,
          skipExisting: this.skipExisting,
          lang: this.lang,
          proxy: this.proxy,
          activeProxyIndex: this.activeProxyIndex,
          vlessServers: this.vlessServers,
        },
        null,
        2
      )
    );
  }

  private _getMode(data: JsonValues): WorkingMode {
    const mode = Number(data);
    return mode >= 1 && mode <= 5 ? (mode as WorkingMode) : 1;
  }

  private _getPath(data: JsonValues): string {
    const cwd = path.resolve();
    if (typeof data !== "string" || !data) return cwd;
    return path.isAbsolute(data) ? data : cwd;
  }

  private _getOsuPath(data: JsonValues): string {
    if (typeof data !== "string" || !data) return "";
    return path.isAbsolute(data) ? data : "";
  }

  private _getMirror(data: JsonValues): Mirror {
    if (
      typeof data === "string" &&
      Object.values(Mirror).includes(data as Mirror)
    ) {
      return data as Mirror;
    }
    return Mirror.Catboy;
  }

  private _getCatboyServer(data: JsonValues): CatboyServer {
    if (
      typeof data === "string" &&
      Object.values(CatboyServer).includes(data as CatboyServer)
    ) {
      return data as CatboyServer;
    }
    return CatboyServer.Default;
  }

  private _getLang(data: JsonValues): "en" | "ru" | "none" {
    if (data === "en" || data === "ru" || data === "none") return data;
    return "none";
  }
}
