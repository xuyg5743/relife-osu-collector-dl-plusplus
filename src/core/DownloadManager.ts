import { createWriteStream, existsSync, readdirSync, unlinkSync } from "fs";
import { Response } from "undici";
import _path from "path";
import OcdlError from "../struct/OcdlError";
import Util from "../util";
import EventEmitter from "events";
import { BeatMapSet } from "../struct/BeatMapSet";
import Manager from "./Manager";
import PQueue from "p-queue";
import { Requestor } from "./Requestor";
import { Mirror, getFallbackMirrors } from "../struct/Constant";
import ProxyManager from "./ProxyManager";

interface DownloadManagerEvents {
  downloaded: (beatMapSet: BeatMapSet) => void;
  skipped: (beatMapSet: BeatMapSet) => void;
  error: (beatMapSet: BeatMapSet, e: unknown) => void;
  retrying: (beatMapSet: BeatMapSet) => void;
  downloading: (beatMapSet: BeatMapSet) => void;
  rateLimited: () => void;
  dailyRateLimited: (beatMapSets: BeatMapSet[]) => void;
  blocked: (beatMapSets: BeatMapSet[]) => void;
  unavailable: (beatMapSets: BeatMapSet[]) => void;
  end: (beatMapSets: BeatMapSet[]) => void;
}

export declare interface DownloadManager {
  on<U extends keyof DownloadManagerEvents>(
    event: U,
    listener: DownloadManagerEvents[U]
  ): this;

  emit<U extends keyof DownloadManagerEvents>(
    event: U,
    ...args: Parameters<DownloadManagerEvents[U]>
  ): boolean;
}

export class DownloadManager extends EventEmitter {
  path: string;
  private queue: PQueue;
  private downloadedBeatMapSetSize = 0;
  private skippedBeatMapSetSize = 0;
  private existingBeatmapsetIds: Set<number> | null = null;
  private remainingDownloadsLimit: number | null;
  private lastDownloadsLimitCheck: number | null = null;
  private testRequest = false;
  private bannedMirrors: Set<Mirror> = new Set();

  constructor(remainingDownloadsLimit: number | null) {
    super();

    this.remainingDownloadsLimit = remainingDownloadsLimit;

    if (Manager.config.mode === 4) {
      this.path = Manager.config.songsPath;
    } else {
      this.path = Manager.config.useSubfolder
        ? _path.join(
            Manager.config.directory,
            Manager.collection.getCollectionFolderName()
          )
        : Manager.config.directory;
    }

    // Mirrors without rate limiting skip intervalCap
    const noRateLimit =
      Manager.config.mirror === Mirror.Nerinyan ||
      Manager.config.mirror === Mirror.Sayobot ||
      Manager.config.mirror === Mirror.Beatconnect ||
      Manager.config.mirror === Mirror.Nekoha;

    this.queue = noRateLimit
      ? new PQueue({
          concurrency: Manager.config.parallel ? Manager.config.concurrency : 1,
        })
      : new PQueue({
          concurrency: Manager.config.parallel ? Manager.config.concurrency : 1,
          intervalCap: Manager.config.intervalCap,
          interval: 60e3,
        });
  }

  public bulkDownload(): void {
    // Pre-populate existing beatmapset IDs for skip check
    if (Manager.config.skipExisting && existsSync(this.path)) {
      this.existingBeatmapsetIds = new Set<number>();
      try {
        const entries = readdirSync(this.path);
        for (const entry of entries) {
          const match = entry.match(/^(\d+)\s/);
          if (match) {
            this.existingBeatmapsetIds.add(parseInt(match[1]));
          }
        }
      } catch {
        this.existingBeatmapsetIds = null;
      }
    }

    Manager.collection.beatMapSets.forEach((beatMapSet) => {
      void this.queue.add(async () => {
        if (this.existingBeatmapsetIds?.has(beatMapSet.id)) {
          this.skippedBeatMapSetSize++;
          this.downloadedBeatMapSetSize++;
          this.emit("skipped", beatMapSet);
          Manager.collection.beatMapSets.delete(beatMapSet.id);
          return;
        }

        const success = await this._downloadFile(beatMapSet);
        if (success) {
          Manager.collection.beatMapSets.delete(beatMapSet.id);
        }
      });
    });

    this.queue.on("idle", () => {
      this.emit("end", this.getNotDownloadedBeatapSets());
    });

    this.on("rateLimited", () => {
      if (!this.queue.isPaused) {
        this.testRequest = true;
        this.queue.pause();
        this.queue.concurrency = 1;
        setTimeout(() => this.queue.start(), 60e3);
      }
    });
  }

  public getDownloadedBeatMapSetSize() {
    return this.downloadedBeatMapSetSize;
  }

  public getSkippedBeatMapSetSize() {
    return this.skippedBeatMapSetSize;
  }

  public getRemainingDownloadsLimit() {
    return this.remainingDownloadsLimit;
  }

  private async _downloadFile(
    beatMapSet: BeatMapSet,
    options: { remainingMirrors?: Mirror[] } = {}
  ): Promise<boolean> {
    let allMirrors: Mirror[];
    if (options.remainingMirrors !== undefined) {
      allMirrors = options.remainingMirrors.filter(
        (m) => !this.bannedMirrors.has(m)
      );
    } else {
      allMirrors = this.bannedMirrors.has(Manager.config.mirror)
        ? getFallbackMirrors(Manager.config.mirror).filter(
            (m) => !this.bannedMirrors.has(m)
          )
        : [
            Manager.config.mirror,
            ...getFallbackMirrors(Manager.config.mirror).filter(
              (m) => !this.bannedMirrors.has(m)
            ),
          ];
    }

    if (allMirrors.length === 0) {
      this.emit("error", beatMapSet, "All mirrors are banned");
      return false;
    }

    const currentMirror = allMirrors[0];
    const nextMirrors = allMirrors.slice(1);

    let isProbeRequest = false;
    if (this.testRequest) {
      isProbeRequest = true;
      this.testRequest = false;
    }

    if (
      this.remainingDownloadsLimit != null &&
      this.remainingDownloadsLimit <= 0
    ) {
      this.emit("dailyRateLimited", this.getNotDownloadedBeatapSets());
      return false;
    }

    try {
      this.emit("downloading", beatMapSet);

      if (!this._checkIfDirectoryExists()) {
        this.path = process.cwd();
      }

      const response = await Requestor.fetchDownloadCollection(beatMapSet.id, {
        mirror: currentMirror,
      });

      // Rate limit check only for mirrors that track it
      if (
        currentMirror !== Mirror.Nerinyan &&
        currentMirror !== Mirror.Sayobot &&
        currentMirror !== Mirror.Beatconnect &&
        currentMirror !== Mirror.Nekoha
      ) {
        const xRateLimit = response.headers.get("x-ratelimit-remaining");
        if (xRateLimit) {
          const limit = parseInt(xRateLimit);
          const pm = ProxyManager.instance;
          if (pm.isAvailable && pm.activeIndex >= 0) {
            pm.updateCachedLimit(pm.activeIndex, limit);
          }
          if (limit <= 12) {
            if (!this.queue.isPaused) {
              this.emit("rateLimited");
            }
          }
        }
      }

      if (response.status === 429) {
        if (
          currentMirror === Mirror.Nerinyan ||
          currentMirror === Mirror.Sayobot ||
          currentMirror === Mirror.Beatconnect ||
          currentMirror === Mirror.Nekoha
        ) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.queue.add(async () => await this._downloadFile(beatMapSet, options));
          return false;
        }

        if (isProbeRequest) {
          if (
            !this.lastDownloadsLimitCheck ||
            Date.now() - this.lastDownloadsLimitCheck > 5e3
          ) {
            this.lastDownloadsLimitCheck = Date.now();
            const rateLimitStatus = await Requestor.checkRateLimitation();
            if (rateLimitStatus === 0) {
              this.emit("dailyRateLimited", this.getNotDownloadedBeatapSets());
            } else {
              this.remainingDownloadsLimit = rateLimitStatus;
            }
          }
        }

        if (!this.queue.isPaused) {
          this.emit("rateLimited");
        }
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.queue.add(async () => await this._downloadFile(beatMapSet, options));
        return false;
      } else if (response.status === 403 || response.status === 451) {
        if (response.status === 403) {
          this.bannedMirrors.add(currentMirror);
        }
        if (nextMirrors.length > 0) {
          throw `Status Code: ${response.status}`;
        }
        if (response.status === 403) {
          this.emit("blocked", this.getNotDownloadedBeatapSets());
        } else {
          this.emit("unavailable", this.getNotDownloadedBeatapSets());
        }
        return false;
      } else if (response.status !== 200) {
        throw `Status Code: ${response.status}`;
      }

      if (isProbeRequest) {
        this.queue.concurrency = Manager.config.parallel
          ? Manager.config.concurrency
          : 1;
      }

      const fileName = this._getFilename(response);
      const filePath = _path.join(this.path, fileName);
      const file = createWriteStream(filePath);

      let bytesWritten = 0;
      if (response.body) {
        for await (const chunk of response.body) {
          file.write(chunk);
          bytesWritten += (chunk as Buffer).length;
        }
      } else {
        throw "res.body is null";
      }

      await new Promise<void>((resolve, reject) => {
        file.end(() => resolve());
        file.on("error", reject);
      });

      if (bytesWritten < 1024) {
        try {
          unlinkSync(filePath);
        } catch { /* ignore */ }
        throw `Downloaded file is too small (${bytesWritten} bytes)`;
      }

      this.downloadedBeatMapSetSize++;
      if (this.remainingDownloadsLimit != null) this.remainingDownloadsLimit--;
      this.emit("downloaded", beatMapSet);
    } catch (e) {
      if (isProbeRequest) {
        this.testRequest = true;
      }

      if (nextMirrors.length > 0) {
        this.emit("retrying", beatMapSet);
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.queue.add(async () => {
          const success = await this._downloadFile(beatMapSet, {
            remainingMirrors: nextMirrors,
          });
          if (success) {
            Manager.collection.beatMapSets.delete(beatMapSet.id);
          }
        });
      } else {
        Manager.collection.beatMapSets.set(beatMapSet.id, beatMapSet);
        this.emit("error", beatMapSet, e);
      }

      return false;
    }

    return true;
  }

  public getNotDownloadedBeatapSets(): BeatMapSet[] {
    return Array.from(Manager.collection.beatMapSets.values());
  }

  private _getFilename(response: Response): string {
    const contentDisposition = response.headers.get("content-disposition");

    let fileName = "Untitled.osz";
    if (contentDisposition) {
      const result = /filename=([^;]+)/g.exec(contentDisposition);
      if (result) {
        try {
          fileName = Util.replaceForbiddenChars(decodeURIComponent(result[1]));
        } catch (e) {
          throw new OcdlError("FILE_NAME_EXTRACTION_FAILED", e);
        }
      }
    }

    return fileName;
  }

  private _checkIfDirectoryExists(): boolean {
    return existsSync(this.path);
  }
}
