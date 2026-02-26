import chalk from "chalk";
import { clear, log } from "console";
import { readSync } from "fs";
import { Constant } from "../struct/Constant";
import { Message, Msg } from "../struct/Message";
import OcdlError from "../struct/OcdlError";
import Util from "../util";
import Manager from "./Manager";
import { LIB_VERSION } from "../version";
import { execSync } from "child_process";

interface Condition {
  new_version: string;
  retry_input: boolean;
  missing_log_found: boolean;
  retry_missing_log_input: boolean;
  fetched_collection: number;
  remaining_downloads: number | null;
  downloaded_beatmapset: number;
  download_log: string[];
}

export enum DisplayTextColor {
  PRIMARY = "yellowBright",
  SECONDARY = "grey",
  DANGER = "red",
  SUCCESS = "green",
  WHITE = "white",
}

export enum FreezeCondition {
  NORMAL,
  WARNING,
  ERRORED,
}

export const GO_BACK_SIGNAL = Symbol("GO_BACK");

export default class Monitor extends Manager {
  private progress = 0;
  private readonly task: Record<number, () => void>;
  private readonly condition: Condition;

  constructor() {
    super();

    this.condition = {
      new_version: "",
      retry_input: false,
      missing_log_found: false,
      retry_missing_log_input: false,
      fetched_collection: 0,
      downloaded_beatmapset: 0,
      remaining_downloads: 0,
      download_log: [],
    };

    Util.setTerminalTitle(`osu-collector-dl v${LIB_VERSION}`);

    this.task = {
      0: () => undefined,
      1: this.p_input_id.bind(this),
      2: this.p_fetch_brief_info.bind(this),
      3: this.p_check_folder.bind(this),
      4: this.p_fetch_collection.bind(this),
      5: this.p_generate_osdb.bind(this),
      6: this.p_download.bind(this),
    };
  }

  update(): void {
    clear();

    if (this.condition.new_version) {
      this.notifyNewVersion();
    }

    this.displayHeader();

    try {
      this.task[this.progress]();
    } catch (e) {
      throw new OcdlError("MESSAGE_GENERATION_FAILED", e);
    }
  }

  freeze(
    message: Msg,
    variable: Record<string, string> | undefined = {},
    freezeCondition: FreezeCondition = FreezeCondition.NORMAL
  ): void {
    let messageColor: DisplayTextColor;
    switch (freezeCondition) {
      case FreezeCondition.NORMAL:
        messageColor = DisplayTextColor.SUCCESS;
        break;
      case FreezeCondition.WARNING:
        messageColor = DisplayTextColor.PRIMARY;
        break;
      case FreezeCondition.ERRORED:
        messageColor = DisplayTextColor.DANGER;
        break;
    }

    this.displayMessage(message, variable, messageColor);

    this.awaitInput(Msg.FREEZE, {
      action: freezeCondition == FreezeCondition.ERRORED ? "exit" : "continue",
    });

    if (freezeCondition == FreezeCondition.ERRORED) {
      process.exit(1);
    }
  }

  displayMessage(
    message: Msg,
    variable: Record<string, string> | undefined = {},
    color: DisplayTextColor = DisplayTextColor.WHITE
  ) {
    const messageComponent = new Message(message, variable);
    log(chalk`{${color} ${messageComponent.toString()}}`);
  }

  reset(): void {
    this.progress = 0;
    this.condition.new_version = "";
    this.condition.retry_input = false;
    this.condition.missing_log_found = false;
    this.condition.retry_missing_log_input = false;
    this.condition.fetched_collection = 0;
    this.condition.downloaded_beatmapset = 0;
    this.condition.remaining_downloads = 0;
    this.condition.download_log = [];
  }

  awaitInput(
    message: Msg,
    variable: Record<string, string> | undefined = {},
    defaultValue = ""
  ): string {
    const messageComponent = new Message(message, variable);
    const result = this.syncPrompt(messageComponent.toString() + " ");
    if (result === "" && defaultValue) return defaultValue;
    return result;
  }

  awaitInputWithBack(
    message: Msg,
    variable: Record<string, string> | undefined = {}
  ): string | typeof GO_BACK_SIGNAL {
    this.displayMessage(Msg.GO_BACK_HINT, {}, DisplayTextColor.SECONDARY);
    const messageComponent = new Message(message, variable);
    const input = this.syncPrompt(messageComponent.toString() + " ");

    if (!input || input.trim() === "") {
      return GO_BACK_SIGNAL;
    }
    return input;
  }

  awaitKeyInput(
    message: Msg,
    variable: Record<string, string> | undefined = {}
  ): string {
    const messageComponent = new Message(message, variable);
    process.stdout.write(messageComponent.toString() + " ");
    const key = this.readKey();
    process.stdout.write(key + "\n");
    return key;
  }

  readKey(): string {
    const buf = Buffer.alloc(1);
    if (process.stdin.isTTY) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (process.stdin as any).setRawMode(true);
    }
    readSync(0, buf, 0, 1, null);
    if (process.stdin.isTTY) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (process.stdin as any).setRawMode(false);
    }

    const key = buf.toString("utf8");

    if (key === "\x03") {
      process.stdout.write("\n");
      process.exit(0);
    }

    return key;
  }

  private getClipboard(): string {
    try {
      if (process.platform === "win32") {
        return execSync("powershell -command \"Get-Clipboard\"", {
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        }).toString().replace(/\r?\n$/, "");
      } else if (process.platform === "darwin") {
        return execSync("pbpaste", { stdio: ["pipe", "pipe", "pipe"] })
          .toString().replace(/\r?\n$/, "");
      } else {
        return execSync("xclip -selection clipboard -o", {
          stdio: ["pipe", "pipe", "pipe"],
        }).toString().replace(/\r?\n$/, "");
      }
    } catch {
      return "";
    }
  }

  private syncPrompt(promptText: string): string {
    process.stdout.write(promptText);
    let input = "";
    let cursorPos = 0;

    if (process.stdin.isTTY) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      (process.stdin as any).setRawMode(true);
    }

    try {
      const buf = Buffer.alloc(4);
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const bytesRead = readSync(0, buf, 0, 4, null);
        if (bytesRead === 0) continue;

        const chunk = buf.toString("utf8", 0, bytesRead);

        for (let ci = 0; ci < chunk.length; ci++) {
          const ch = chunk[ci];

          if (ch === "\x03") {
            process.stdout.write("\n");
            process.exit(0);
          }

          if (ch === "\r" || ch === "\n") {
            process.stdout.write("\n");
            return input;
          }

          if (ch === "\x16") {
            const clipboard = this.getClipboard();
            if (clipboard) {
              const text = clipboard.split(/\r?\n/)[0];
              input = input.slice(0, cursorPos) + text + input.slice(cursorPos);
              cursorPos += text.length;
              process.stdout.write("\r" + promptText + input);
              const trailing = input.length - cursorPos;
              if (trailing > 0) {
                process.stdout.write(`\x1b[${trailing}D`);
              }
            }
            continue;
          }

          if (ch === "\x7f" || ch === "\b") {
            if (cursorPos > 0) {
              input = input.slice(0, cursorPos - 1) + input.slice(cursorPos);
              cursorPos--;
              process.stdout.write("\r" + promptText + input + " ");
              const moveBack = input.length - cursorPos + 1;
              process.stdout.write(`\x1b[${moveBack}D`);
            }
            continue;
          }

          if (ch === "\x1b") {
            ci += bytesRead - ci - 1;
            continue;
          }

          if (ch.charCodeAt(0) < 32) continue;

          input = input.slice(0, cursorPos) + ch + input.slice(cursorPos);
          cursorPos++;
          process.stdout.write("\r" + promptText + input);
          const trailing = input.length - cursorPos;
          if (trailing > 0) {
            process.stdout.write(`\x1b[${trailing}D`);
          }
        }
      }
    } finally {
      if (process.stdin.isTTY) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        (process.stdin as any).setRawMode(false);
      }
    }
  }

  nextTask(): void {
    this.progress++;
    this.update();
  }

  setTask(task: number): void {
    this.progress = task;
    this.update();
  }

  previousTask(): void {
    if (this.progress > 1) {
      this.progress--;
      this._resetConditions();
      this.update();
    }
  }

  private _resetConditions(): void {
    this.condition.retry_input = false;
    this.condition.missing_log_found = false;
    this.condition.retry_missing_log_input = false;
  }

  setCondition(new_condition: Partial<Condition>): void {
    Object.assign(this.condition, new_condition);
  }

  appendDownloadLog(
    message: Msg,
    variable: Record<string, string> | undefined = {},
    color: DisplayTextColor = DisplayTextColor.WHITE
  ): void {
    const messageComponent = new Message(message, variable);
    const entry = chalk`{${color} ${messageComponent.toString()}}`;

    this.condition.download_log.unshift(entry);
    if (this.condition.download_log.length > Manager.config.logSize) {
      this.condition.download_log.length = Manager.config.logSize;
    }
  }

  private displayHeader(): void {
    this.displayMessage(
      Msg.HEADER,
      {
        id: Manager.collection.id.toString(),
        name: Manager.collection.name,
        mode: Manager.config.mode.toString(),
      },
      DisplayTextColor.PRIMARY
    );
  }

  private notifyNewVersion(): void {
    this.displayMessage(
      Msg.NEW_VERSION,
      {
        version: this.condition.new_version,
        url: Constant.GithubReleaseUrl + this.condition.new_version,
      },
      DisplayTextColor.SECONDARY
    );
  }

  private p_input_id(): void {
    if (this.condition.retry_input) {
      this.displayMessage(Msg.INPUT_ID_ERR, {}, DisplayTextColor.DANGER);
    }
  }

  private p_fetch_brief_info(): void {
    this.displayMessage(Msg.FETCH_BRIEF_INFO, {
      id: Manager.collection.id.toString(),
    });
  }

  private p_check_folder(): void {
    if (!this.condition.missing_log_found) {
      this.displayMessage(Msg.CREATING_FOLDER, {
        name: Manager.collection.name,
      });
    } else {
      this.displayMessage(Msg.PREVIOUS_DOWNLOAD_FOUND);

      if (this.condition.retry_missing_log_input) {
        this.displayMessage(
          Msg.INPUT_CONTINUE_DOWNLOAD_ERR,
          {},
          DisplayTextColor.DANGER
        );
      }
    }
  }

  private p_fetch_collection(): void {
    this.displayMessage(Msg.FETCH_DATA, {
      amount: this.condition.fetched_collection.toString(),
      total: Manager.collection.beatMapCount.toString(),
    });
  }

  private p_generate_osdb(): void {
    this.displayMessage(Msg.GENERATE_OSDB, {
      name: Manager.collection.name,
    });
  }

  private p_download(): void {
    if (this.condition.remaining_downloads !== null) {
      this.displayMessage(Msg.REMAINING_DOWNLOADS, {
        amount: this.condition.remaining_downloads.toString(),
      });
    }

    this.displayMessage(Msg.DOWNLOAD_FILES, {
      amount: this.condition.downloaded_beatmapset.toString(),
      total: Manager.collection.beatMapSetCount.toString(),
    });

    this.displayMessage(Msg.DOWNLOAD_LOG, {
      log: this.condition.download_log.join("\n"),
    });
  }
}
