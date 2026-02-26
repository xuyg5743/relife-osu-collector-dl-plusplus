import {
  existsSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
} from "fs";
import _path from "path";
import OcdlError from "../struct/OcdlError";
import Manager from "./Manager";

interface CollectionDbEntry {
  name: string;
  md5Hashes: string[];
}

export default class CollectionDbManager {
  private collectionDbPath: string;
  private version = 20150203;
  private collections: CollectionDbEntry[] = [];
  private offset = 0;
  private lastBackupPath: string | null = null;

  constructor() {
    this.collectionDbPath = Manager.config.collectionDbPath;
  }

  private readOsuString(buffer: Buffer): string {
    const indicator = buffer.readUInt8(this.offset);
    this.offset += 1;

    if (indicator === 0x00) return "";
    if (indicator !== 0x0b) {
      throw new Error(`Invalid string indicator: ${indicator}`);
    }

    let length = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = buffer.readUInt8(this.offset);
      this.offset += 1;
      length |= (byte & 0x7f) << shift;
      shift += 7;
    } while ((byte & 0x80) !== 0);

    const str = buffer.toString("utf-8", this.offset, this.offset + length);
    this.offset += length;
    return str;
  }

  readCollectionDb(): boolean {
    try {
      if (!existsSync(this.collectionDbPath)) {
        this.collections = [];
        return true;
      }

      const buffer = readFileSync(this.collectionDbPath);
      this.offset = 0;

      this.version = buffer.readInt32LE(this.offset);
      this.offset += 4;

      const collectionCount = buffer.readInt32LE(this.offset);
      this.offset += 4;

      for (let i = 0; i < collectionCount; i++) {
        const name = this.readOsuString(buffer);
        const beatmapCount = buffer.readInt32LE(this.offset);
        this.offset += 4;

        const md5Hashes: string[] = [];
        for (let j = 0; j < beatmapCount; j++) {
          md5Hashes.push(this.readOsuString(buffer));
        }

        this.collections.push({ name, md5Hashes });
      }

      return true;
    } catch (e) {
      throw new OcdlError("COLLECTION_DB_READ_FAILED", e);
    }
  }

  hasCollection(collectionName: string): boolean {
    return this.collections.some((c) => c.name === collectionName);
  }

  getCollectionSize(collectionName: string): number {
    const coll = this.collections.find((c) => c.name === collectionName);
    return coll ? coll.md5Hashes.length : 0;
  }

  addCollection(collectionName: string, md5Hashes: string[]): void {
    const existingIndex = this.collections.findIndex(
      (c) => c.name === collectionName
    );

    if (existingIndex !== -1) {
      const existing = this.collections[existingIndex];
      const uniqueHashes = new Set([...existing.md5Hashes, ...md5Hashes]);
      this.collections[existingIndex].md5Hashes = Array.from(uniqueHashes);
    } else {
      this.collections.push({ name: collectionName, md5Hashes });
    }
  }

  replaceCollection(collectionName: string, md5Hashes: string[]): void {
    const existingIndex = this.collections.findIndex(
      (c) => c.name === collectionName
    );

    if (existingIndex !== -1) {
      this.collections[existingIndex].md5Hashes = md5Hashes;
    } else {
      this.collections.push({ name: collectionName, md5Hashes });
    }
  }

  private writeOsuString(str: string): Buffer {
    if (!str || str.length === 0) {
      return Buffer.from([0x00]);
    }

    const strBuffer = Buffer.from(str, "utf-8");
    const length = strBuffer.length;

    const lengthBytes: number[] = [];
    let value = length;
    do {
      let byte = value & 0x7f;
      value >>= 7;
      if (value !== 0) byte |= 0x80;
      lengthBytes.push(byte);
    } while (value !== 0);

    return Buffer.concat([
      Buffer.from([0x0b]),
      Buffer.from(lengthBytes),
      strBuffer,
    ]);
  }

  writeCollectionDb(): boolean {
    try {
      this.lastBackupPath = this._createBackup();

      const buffers: Buffer[] = [];

      const versionBuffer = Buffer.allocUnsafe(4);
      versionBuffer.writeInt32LE(this.version, 0);
      buffers.push(versionBuffer);

      const countBuffer = Buffer.allocUnsafe(4);
      countBuffer.writeInt32LE(this.collections.length, 0);
      buffers.push(countBuffer);

      for (const coll of this.collections) {
        buffers.push(this.writeOsuString(coll.name));

        const beatmapCountBuffer = Buffer.allocUnsafe(4);
        beatmapCountBuffer.writeInt32LE(coll.md5Hashes.length, 0);
        buffers.push(beatmapCountBuffer);

        for (const hash of coll.md5Hashes) {
          buffers.push(this.writeOsuString(hash));
        }
      }

      writeFileSync(this.collectionDbPath, Buffer.concat(buffers));
      return true;
    } catch (e) {
      throw new OcdlError("COLLECTION_DB_WRITE_FAILED", e);
    }
  }

  private _createBackup(): string | null {
    if (existsSync(this.collectionDbPath)) {
      const dbDir = _path.dirname(this.collectionDbPath);
      const backupDir = _path.join(dbDir, "backup collections");

      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/:/g, "-")
        .replace(/\..+/, "")
        .replace("T", "_");
      const backupPath = _path.join(
        backupDir,
        `collection.db.${timestamp}.backup`
      );

      copyFileSync(this.collectionDbPath, backupPath);
      return backupPath;
    }
    return null;
  }

  getLastBackupPath(): string | null {
    return this.lastBackupPath;
  }

  static isOsuRunning(): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const { execSync } = require("child_process") as typeof import("child_process");
      const result = execSync('tasklist /FI "IMAGENAME eq osu!.exe"', {
        encoding: "utf-8",
      });
      return result.includes("osu!.exe");
    } catch {
      return false;
    }
  }

  /**
   * Get MD5 hashes, replacing API hashes with real ones from osu!.db where possible.
   * @param beatmapIdToRealHash mapping beatmapId -> realHash from osu!.db
   * @param savedBeatMaps optional saved beatmaps (use when collection.beatMapSets may be modified)
   */
  static getMd5HashesWithRealHashes(
    beatmapIdToRealHash: Map<number, string>,
    savedBeatMaps?: Array<{ id: number; checksum: string }>
  ): { hashes: string[]; replaced: number; notFound: number } {
    const hashes: string[] = [];
    let replaced = 0;
    let notFound = 0;

    if (savedBeatMaps) {
      for (const beatMap of savedBeatMaps) {
        const realHash = beatmapIdToRealHash.get(beatMap.id);
        if (realHash) {
          hashes.push(realHash);
          if (realHash !== beatMap.checksum) replaced++;
        } else if (beatMap.checksum) {
          hashes.push(beatMap.checksum);
          notFound++;
        }
      }
    } else {
      Manager.collection.beatMapSets.forEach((beatMapSet) => {
        beatMapSet.beatMaps.forEach((beatMap) => {
          const realHash = beatmapIdToRealHash.get(beatMap.id);
          if (realHash) {
            hashes.push(realHash);
            if (realHash !== beatMap.checksum) replaced++;
          } else if (beatMap.checksum) {
            hashes.push(beatMap.checksum);
            notFound++;
          }
        });
      });
    }

    return { hashes, replaced, notFound };
  }
}
