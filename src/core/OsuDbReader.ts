import { existsSync, readFileSync } from "fs";
import OcdlError from "../struct/OcdlError";

interface OsuDbBeatmap {
  beatmapId: number;
  beatmapsetId: number;
  md5Hash: string;
}

/**
 * Reads osu!.db and extracts beatmap hashes and IDs.
 * Format: https://osu.ppy.sh/wiki/en/Client/File_formats/osu!.db
 */
export default class OsuDbReader {
  private filePath: string;
  private buffer: Buffer = Buffer.alloc(0);
  private offset = 0;
  private version = 0;

  constructor(osuDbPath: string) {
    this.filePath = osuDbPath;
  }

  readBeatmapIdToHash(): Map<number, string> {
    const { beatmapIdToHash } = this.parse();
    return beatmapIdToHash;
  }

  readAllHashes(): Set<string> {
    const { allHashes } = this.parse();
    return allHashes;
  }

  readAllBeatmapsetIds(): Set<number> {
    const { beatmapsetIds } = this.parse();
    return beatmapsetIds;
  }

  private parse(): {
    hashToBeatmapId: Map<string, number>;
    beatmapIdToHash: Map<number, string>;
    beatmapsetIds: Set<number>;
    allHashes: Set<string>;
  } {
    if (!existsSync(this.filePath)) {
      throw new OcdlError("OSU_DB_NOT_FOUND", `File not found: ${this.filePath}`);
    }

    this.buffer = readFileSync(this.filePath);
    this.offset = 0;

    const hashToBeatmapId = new Map<string, number>();
    const beatmapIdToHash = new Map<number, string>();
    const beatmapsetIds = new Set<number>();
    const allHashes = new Set<string>();

    try {
      this.version = this.readInt();
      this.readInt(); // Folder count
      this.readBool(); // Account unlocked
      this.offset += 8; // Date account unlocked (DateTime)
      this.readString(); // Player name

      const beatmapCount = this.readInt();

      for (let i = 0; i < beatmapCount; i++) {
        const beatmap = this.readBeatmap();
        if (beatmap && beatmap.md5Hash) {
          allHashes.add(beatmap.md5Hash);
          if (beatmap.beatmapId > 0) {
            hashToBeatmapId.set(beatmap.md5Hash, beatmap.beatmapId);
            beatmapIdToHash.set(beatmap.beatmapId, beatmap.md5Hash);
          }
          if (beatmap.beatmapsetId > 0) {
            beatmapsetIds.add(beatmap.beatmapsetId);
          }
        }
      }
    } catch (e) {
      throw new OcdlError("OSU_DB_READ_FAILED", e);
    }

    return { hashToBeatmapId, beatmapIdToHash, beatmapsetIds, allHashes };
  }

  private readBeatmap(): OsuDbBeatmap | null {
    try {
      if (this.version < 20191106) this.readInt(); // Size in bytes

      this.readString(); // Artist name
      this.readString(); // Artist name unicode
      this.readString(); // Song title
      this.readString(); // Song title unicode
      this.readString(); // Creator name
      this.readString(); // Difficulty
      this.readString(); // Audio file name

      const md5Hash = this.readString();

      this.readString(); // .osu file name
      this.readByte(); // Ranked status
      this.readShort(); // Number of hitcircles
      this.readShort(); // Number of sliders
      this.readShort(); // Number of spinners
      this.offset += 8; // Last modification time (Long)

      if (this.version < 20140609) {
        this.readByte(); // AR
        this.readByte(); // CS
        this.readByte(); // HP
        this.readByte(); // OD
      } else {
        this.readSingle(); // AR
        this.readSingle(); // CS
        this.readSingle(); // HP
        this.readSingle(); // OD
      }

      this.readDouble(); // Slider velocity

      if (this.version >= 20140609) {
        this.readIntDoublePairs(); // Star rating osu!
        this.readIntDoublePairs(); // Star rating Taiko
        this.readIntDoublePairs(); // Star rating CTB
        this.readIntDoublePairs(); // Star rating Mania
      }

      this.readInt(); // Drain time
      this.readInt(); // Total time
      this.readInt(); // Audio preview time

      const timingPointCount = this.readInt();
      this.offset += timingPointCount * 17; // Each timing point: Double + Double + Bool

      const beatmapId = this.readInt();
      const beatmapsetId = this.readInt();

      this.readInt(); // Thread ID
      this.readByte(); // Grade osu!
      this.readByte(); // Grade Taiko
      this.readByte(); // Grade CTB
      this.readByte(); // Grade Mania
      this.readShort(); // Local offset
      this.readSingle(); // Stack leniency
      this.readByte(); // Game mode
      this.readString(); // Song source
      this.readString(); // Song tags
      this.readShort(); // Online offset
      this.readString(); // Font
      this.readBool(); // Unplayed
      this.offset += 8; // Last played time (Long)
      this.readBool(); // Is osz2
      this.readString(); // Folder name
      this.offset += 8; // Last checked against repo (Long)
      this.readBool(); // Ignore beatmap sound
      this.readBool(); // Ignore beatmap skin
      this.readBool(); // Disable storyboard
      this.readBool(); // Disable video
      this.readBool(); // Visual override

      if (this.version < 20140609) this.readShort(); // Unknown

      this.readInt(); // Last modification time
      this.readByte(); // Mania scroll speed

      return { beatmapId, beatmapsetId, md5Hash };
    } catch {
      return null;
    }
  }

  private readByte(): number {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  private readShort(): number {
    const value = this.buffer.readInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  private readInt(): number {
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  private readSingle(): number {
    const value = this.buffer.readFloatLE(this.offset);
    this.offset += 4;
    return value;
  }

  private readDouble(): number {
    const value = this.buffer.readDoubleLE(this.offset);
    this.offset += 8;
    return value;
  }

  private readBool(): boolean {
    return this.readByte() !== 0;
  }

  private readString(): string {
    const indicator = this.readByte();
    if (indicator === 0x00) return "";
    if (indicator !== 0x0b) {
      throw new Error(`Invalid string indicator: ${indicator}`);
    }

    let length = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = this.readByte();
      length |= (byte & 0x7f) << shift;
      shift += 7;
    } while ((byte & 0x80) !== 0);

    const str = this.buffer.toString("utf-8", this.offset, this.offset + length);
    this.offset += length;
    return str;
  }

  private readIntDoublePairs(): void {
    const count = this.readInt();
    // Version >= 20250107: Int-Float pairs (10 bytes each)
    // Version < 20250107: Int-Double pairs (14 bytes each)
    const bytesPerPair = this.version >= 20250107 ? 10 : 14;
    this.offset += count * bytesPerPair;
  }
}
