import { clear } from "console";
import { DownloadManager } from "./DownloadManager";
import OsdbGenerator from "./OsdbGenerator";
import OcdlError from "../struct/OcdlError";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "fs";
import _path from "path";
import Util from "../util";
import Monitor, {
  DisplayTextColor,
  FreezeCondition,
  GO_BACK_SIGNAL,
} from "./Monitor";
import Logger from "./Logger";
import { Message, Msg, type Language } from "../struct/Message";
import Manager from "./Manager";
import { type WorkingMode } from "../types";
import {
  Requestor,
  v2ResCollectionType,
  type TournamentResponse,
  type TournamentRound,
  type TournamentBeatMap,
} from "./Requestor";
import { LIB_VERSION } from "../version";
import { BeatMapSet } from "../struct/BeatMapSet";
import { BeatMap } from "../struct/BeatMap";
import { Mirror, CatboyServer } from "../struct/Constant";
import CollectionDbManager from "./CollectionDbManager";
import OsuDbReader from "./OsuDbReader";
import ProxyManager from "./ProxyManager";
import { Collection } from "../struct/Collection";

const MIRROR_CHOICES: Record<string, Mirror> = {
  "1": Mirror.Catboy,
  "2": Mirror.Nerinyan,
  "3": Mirror.OsuDirect,
  "4": Mirror.Sayobot,
  "5": Mirror.Beatconnect,
  "6": Mirror.Nekoha,
};

const CATBOY_SERVER_CHOICES: Record<string, CatboyServer> = {
  "1": CatboyServer.Default,
  "2": CatboyServer.Central,
  "3": CatboyServer.US,
  "4": CatboyServer.Asia,
};

const VALID_MODES = ["1", "2", "3", "4", "5"] as const;

export default class Worker extends Manager {
  monitor: Monitor;
  private savedBeatMaps: Array<{ id: number; checksum: string }> | null = null;
  private resumeMissingBeatmapIds: Set<number> | null = null;

  constructor() {
    super();
    this.monitor = new Monitor();
  }

  async run(): Promise<void> {
    this.ensureLanguage();

    this.monitor.update();

    if (Manager.config.isFirstRun) {
      this.runSetupWizard();
    }

    const pm = ProxyManager.instance;
    if (pm.isAvailable) {
      this.monitor.displayMessage(Msg.PROXY_STARTING);
      const started = await pm.startAll();
      if (started > 0) {
        const savedIdx = Manager.config.activeProxyIndex;
        pm.activeIndex = savedIdx >= 0 ? savedIdx : 0;
        if (savedIdx < 0) {
          Manager.config.activeProxyIndex = 0;
          Manager.config.save();
        }
        this.monitor.displayMessage(
          Msg.PROXY_STARTED,
          { count: started.toString() },
          DisplayTextColor.SUCCESS
        );
      }
    }

    this.monitor.displayMessage(Msg.CHECK_CONNECTION_TO_SERVER);
    const onlineStatus = await Util.isOnline();
    if (!onlineStatus) {
      return this.monitor.freeze(
        Msg.NO_CONNECTION,
        {},
        FreezeCondition.ERRORED
      );
    }

    this.monitor.displayMessage(Msg.CHECK_NEW_VERSION);
    const newVersion = await Requestor.checkNewVersion(LIB_VERSION);
    if (newVersion) {
      this.monitor.setCondition({ new_version: newVersion });
    }

    let rateLimitStatus: number | null = null;
    if (pm.isAvailable && pm.count > 0) {
      this.monitor.displayMessage(Msg.PROXY_CHECKING);
      const allLimits = await pm.checkAllRateLimits(false);
      const totalLimit = allLimits.reduce<number>((sum, l) => sum + (l ?? 0), 0);
      const validCount = allLimits.filter(l => l !== null).length;
      if (validCount > 0) {
        this.monitor.displayMessage(
          Msg.PROXY_TOTAL_LIMIT,
          { total: totalLimit.toString(), count: validCount.toString() },
          DisplayTextColor.SUCCESS
        );
        rateLimitStatus = totalLimit;
        this.monitor.setCondition({ remaining_downloads: rateLimitStatus });
      }
    }

    const hasRateLimit =
      Manager.config.mirror === Mirror.Catboy ||
      Manager.config.mirror === Mirror.OsuDirect;
    if (hasRateLimit && !pm.isAvailable) {
    this.monitor.displayMessage(Msg.CHECK_RATE_LIMIT);
      rateLimitStatus = await Requestor.checkRateLimitation();
    if (rateLimitStatus === null) {
      this.monitor.freeze(
        Msg.UNABLE_TO_GET_DAILY_RATE_LIMIT,
        {},
        FreezeCondition.WARNING
      );
    }
    this.monitor.setCondition({ remaining_downloads: rateLimitStatus });
    }

    for (;;) {
      await this.selectMainAction(rateLimitStatus);
      clear();
      this.monitor.reset();
      Manager.collection = new Collection();
      this.savedBeatMaps = null;
      this.resumeMissingBeatmapIds = null;
    }
  }

  private ensureLanguage(): void {
    let lang: Language;

    if (Manager.config.lang === "none") {
      let selected: Language | null = null;
      this.monitor.displayMessage(Msg.SELECT_LANGUAGE_PROMPT);
      while (selected === null) {
        const key = this.monitor.readKey();
        if (key === "1") {
          process.stdout.write(key + "\n");
          selected = "en";
        } else if (key === "2") {
          process.stdout.write(key + "\n");
          selected = "ru";
        }
      }
      Manager.config.lang = selected;
      Manager.config.save();
      lang = selected;
    } else {
      lang = Manager.config.lang === "ru" ? "ru" : "en";
    }

    Message.language = lang;
  }

  private async selectMainAction(rateLimitStatus: number | null): Promise<void> {
    this.monitor.displayMessage(Msg.SELECT_MAIN_ACTION);

    for (;;) {
      const key = this.monitor.readKey();

      if (key === "1") {
        process.stdout.write(key + "\n");
        await this.runCollectionFlow(rateLimitStatus);
        return;
      }

      if (key === "2") {
        process.stdout.write(key + "\n");
        await this.runTournamentFlow(rateLimitStatus);
        return;
      }

      if (key === "3") {
        process.stdout.write(key + "\n");
        while (await this.openSettings()) { /* */ }
        clear();
        this.monitor.displayMessage(Msg.SELECT_MAIN_ACTION);
        continue;
      }

      if (key === "4") {
        process.stdout.write(key + "\n");
        await this.runFixCommand();
        return;
      }

      if (key === "5") {
        process.stdout.write(key + "\n");
        this.runBackupCommand();
        return;
      }

    }
  }

  private runSetupWizard(): void {
    this.monitor.displayMessage(
      Msg.SETUP_WELCOME,
      {},
      DisplayTextColor.PRIMARY
    );

    let setupType: "standard" | "advanced" | null = null;
    this.monitor.displayMessage(Msg.SETUP_TYPE);
    while (!setupType) {
      const choice = this.monitor.awaitInput(Msg.SETUP_TYPE_INPUT, {}, "1");
      if (choice === "1") setupType = "standard";
      else if (choice === "2") setupType = "advanced";
    }

    if (setupType === "standard") {
      this.runStandardSetup();
    } else {
      this.runAdvancedSetup();
    }

    Manager.config.isFirstRun = false;
    Manager.config.save();
    this.monitor.displayMessage(
      Msg.SETUP_COMPLETE,
      {},
      DisplayTextColor.SUCCESS
    );
  }

  private runStandardSetup(): void {
    this.promptOsuPath(true);
    Manager.config.mode = 4;
    Manager.config.mirror = Mirror.Catboy;
    Manager.config.catboyServer = CatboyServer.Default;
  }

  private runAdvancedSetup(): void {
    this.promptOsuPath(false);

    this.monitor.displayMessage(Msg.SETUP_MIRROR);
    let validMirror = false;
    while (!validMirror) {
      const choice = this.monitor.awaitInput(Msg.SETUP_MIRROR_INPUT, {}, "1");
      if (choice in MIRROR_CHOICES) {
        Manager.config.mirror = MIRROR_CHOICES[choice];
        validMirror = true;
      }
    }

    if (Manager.config.mirror === Mirror.Catboy) {
      this.promptCatboyServer();
    }

    this.monitor.displayMessage(Msg.SETUP_MODE);
    let validMode = false;
    while (!validMode) {
      const choice = this.monitor.awaitInput(Msg.SETUP_MODE_INPUT, {}, "1");
      if (VALID_MODES.includes(choice as typeof VALID_MODES[number])) {
        Manager.config.mode = parseInt(choice) as WorkingMode;
        validMode = true;
      }
    }

    if (Manager.config.mode >= 1 && Manager.config.mode <= 3) {
      let validDir = false;
      while (!validDir) {
        const dir = this.monitor.awaitInput(
          Msg.SETUP_DIRECTORY,
          {},
          process.cwd()
        );
        if (dir && existsSync(dir)) {
          Manager.config.directory = _path.isAbsolute(dir)
            ? dir
            : _path.resolve(dir);
          validDir = true;
        } else if (!dir) {
          Manager.config.directory = process.cwd();
          validDir = true;
        } else {
          this.monitor.displayMessage(
            Msg.SETUP_DIRECTORY_INVALID,
            {},
            DisplayTextColor.DANGER
          );
        }
      }
    }
  }

  private promptOsuPath(required: boolean): void {
    let valid = false;
    while (!valid) {
      const input = this.monitor.awaitInput(Msg.SETUP_OSU_PATH, {}, "");
      if (input) {
        const full = _path.isAbsolute(input) ? input : _path.resolve(input);
        const songs = _path.join(full, "Songs");
        const osuDb = _path.join(full, "osu!.db");

        if (existsSync(full) && existsSync(songs) && existsSync(osuDb)) {
          Manager.config.osuPath = full;
          valid = true;
        } else {
          this.monitor.displayMessage(
            Msg.SETUP_OSU_PATH_INVALID,
            {},
            DisplayTextColor.DANGER
          );
        }
      } else if (!required) {
        valid = true;
      }
    }
  }

  private promptCatboyServer(): void {
    this.monitor.displayMessage(Msg.SETUP_CATBOY_SERVER);
    let valid = false;
    while (!valid) {
      const choice = this.monitor.awaitInput(
        Msg.SETUP_CATBOY_SERVER_INPUT,
        {},
        "1"
      );
      if (choice in CATBOY_SERVER_CHOICES) {
        Manager.config.catboyServer = CATBOY_SERVER_CHOICES[choice];
        valid = true;
      }
    }
  }

  private async openSettings(): Promise<boolean> {
    clear();
    this.monitor.displayMessage(
      Msg.SETTINGS_HEADER,
      {},
      DisplayTextColor.PRIMARY
    );
    const pm = ProxyManager.instance;
    const proxyVlessLabel = pm.isAvailable
      ? pm.getActiveName()
      : "(not configured)";

    let vlessLimitsText = "";
    if (pm.isAvailable && pm.count > 0) {
      const allLimits = await pm.checkAllRateLimits(true);
      const lines: string[] = [];
      for (let i = 0; i < pm.count; i++) {
        const name = pm.getName(i);
        const limit = allLimits[i];
        const limitStr = limit !== null ? limit.toString() : "N/A";
        lines.push(`   ${i + 1}. ${name}: ${limitStr}`);
      }
      if (lines.length > 0) {
        vlessLimitsText = "\n" + lines.join("\n") + "\n";
      }
    }

    this.monitor.displayMessage(Msg.SETTINGS_CURRENT, {
      osuPath: Manager.config.osuPath || "(not set)",
      directory: Manager.config.directory,
      mirror:
        Manager.config.mirror +
        (Manager.config.mirror === Mirror.Catboy
          ? ` [${Manager.config.catboyServer}]`
          : ""),
      mode: Manager.config.mode.toString(),
      parallel: Manager.config.parallel ? "Yes" : "No",
      concurrency: Manager.config.concurrency.toString(),
      skipExisting: Manager.config.skipExisting ? "Yes" : "No",
      proxyVless: proxyVlessLabel,
      vlessLimits: vlessLimitsText,
    });

    const choice = this.monitor.awaitInput(Msg.SETTINGS_SELECT, {}, "");

    switch (choice) {
      case "1": {
        this.monitor.displayMessage(Msg.SETUP_MIRROR);
        const mc = this.monitor.awaitInput(Msg.SETUP_MIRROR_INPUT, {}, "1");
        if (mc in MIRROR_CHOICES) {
          Manager.config.mirror = MIRROR_CHOICES[mc];
          if (Manager.config.mirror === Mirror.Catboy) {
            this.promptCatboyServer();
          }
        }
        break;
      }
      case "2": {
        this.monitor.displayMessage(Msg.SETUP_MODE);
        const mc = this.monitor.awaitInput(
          Msg.SETUP_MODE_INPUT,
          {},
          Manager.config.mode.toString()
        );
        if (VALID_MODES.includes(mc as typeof VALID_MODES[number])) {
          Manager.config.mode = parseInt(mc) as WorkingMode;
        }
        break;
      }
      case "3": {
        const c = this.monitor.awaitInput(
          Msg.SETTINGS_CONCURRENCY,
          {},
          Manager.config.concurrency.toString()
        );
        const n = parseInt(c);
        if (!isNaN(n) && n >= 1 && n <= 10) Manager.config.concurrency = n;
        break;
      }
      case "4": {
        const p = this.monitor.awaitInput(
          Msg.SETTINGS_PARALLEL,
          {},
          Manager.config.parallel ? "y" : "n"
        );
        Manager.config.parallel = p.toLowerCase() === "y";
        break;
      }
      case "5": {
        const s = this.monitor.awaitInput(
          Msg.SETTINGS_SKIP_EXISTING,
          {},
          Manager.config.skipExisting ? "y" : "n"
        );
        Manager.config.skipExisting = s.toLowerCase() === "y";
        break;
      }
      case "6": {
        const op = this.monitor.awaitInput(
          Msg.SETUP_OSU_PATH,
          {},
          Manager.config.osuPath
        );
        if (op) {
          const full = _path.isAbsolute(op) ? op : _path.resolve(op);
          if (
            existsSync(full) &&
            existsSync(_path.join(full, "Songs")) &&
            existsSync(_path.join(full, "osu!.db"))
          ) {
            Manager.config.osuPath = full;
          } else {
            this.monitor.displayMessage(
              Msg.SETUP_OSU_PATH_INVALID,
              {},
              DisplayTextColor.DANGER
            );
          }
        }
        break;
      }
      case "7": {
        const dir = this.monitor.awaitInput(
          Msg.SETUP_DIRECTORY,
          {},
          Manager.config.directory
        );
        if (dir && existsSync(dir)) {
          Manager.config.directory = _path.isAbsolute(dir)
            ? dir
            : _path.resolve(dir);
        }
        break;
      }
      case "8": {
        await this.openProxySettings();
        break;
      }
      case "":
        return false;
      default:
        return true;
    }

    Manager.config.save();
    this.monitor.displayMessage(
      Msg.SETTINGS_SAVED,
      {},
      DisplayTextColor.SUCCESS
    );
    return true;
  }

  private async openProxySettings(): Promise<void> {
    const pm = ProxyManager.instance;

    if (!pm.hasXray) {
      this.monitor.displayMessage(
        Msg.PROXY_XRAY_NOT_FOUND,
        {},
        DisplayTextColor.DANGER
      );
    }

    clear();
    this.monitor.displayMessage(Msg.VLESS_MENU_HEADER, {}, DisplayTextColor.PRIMARY);

    if (pm.count > 0) {
      const limits = await pm.checkAllRateLimits(true);
      let list = "";
      for (let i = 0; i < pm.count; i++) {
        const name = pm.getName(i);
        const running = pm.isRunning(i);
        const active = pm.activeIndex === i;
        const limit = limits[i];

        list += `  ${i + 1}. ${name}`;
        if (active) list += " [ACTIVE]";
        if (running && limit !== null) list += ` (limit: ${limit})`;
        else if (!running) list += " (not running)";
        list += "\n";
      }
      const directActive = pm.activeIndex === -1 ? " [ACTIVE]" : "";
      list = `  0. Direct${directActive}\n` + list;
      this.monitor.displayMessage(Msg.PROXY_LIST_HEADER, { list }, DisplayTextColor.PRIMARY);
    } else {
      this.monitor.displayMessage(Msg.VLESS_EMPTY, {}, DisplayTextColor.SECONDARY);
    }

    this.monitor.displayMessage(Msg.VLESS_MENU_OPTIONS);
    const choice = this.monitor.awaitInput(Msg.VLESS_MENU_SELECT, {}, "");
    if (!choice) return;

    switch (choice) {
      case "1":
        this.vlessSelectProxy();
        break;
      case "2":
        await this.vlessAddServer();
        break;
      case "3":
        await this.vlessRemoveServer();
        break;
    }
  }

  private vlessSelectProxy(): void {
    const pm = ProxyManager.instance;
    if (pm.count === 0) {
      this.monitor.displayMessage(Msg.VLESS_EMPTY, {}, DisplayTextColor.DANGER);
      return;
    }

    const input = this.monitor.awaitInput(
      Msg.PROXY_SELECT,
      { max: pm.count.toString() },
      ""
    );
    if (!input) return;

    const idx = parseInt(input);
    if (isNaN(idx) || idx < 0 || idx > pm.count) return;

    pm.activeIndex = idx - 1;
    Manager.config.activeProxyIndex = pm.activeIndex;
    Manager.config.save();

    this.monitor.displayMessage(
      Msg.PROXY_SWITCHED,
      { name: pm.getActiveName() },
      DisplayTextColor.SUCCESS
    );
  }

  private async vlessAddServer(): Promise<void> {
    const pm = ProxyManager.instance;
    const input = this.monitor.awaitInput(Msg.VLESS_ADD_PROMPT, {}, "");
    if (!input) return;

    if (!input.startsWith("vless://")) {
      this.monitor.displayMessage(Msg.VLESS_ADD_INVALID, {}, DisplayTextColor.DANGER);
      return;
    }

    const added = pm.addServer(input);
    if (!added) {
      this.monitor.displayMessage(Msg.VLESS_ADD_INVALID, {}, DisplayTextColor.DANGER);
      return;
    }

    let name = "Server";
    try {
      const url = new URL(input);
      name = url.hash ? decodeURIComponent(url.hash.slice(1)) : `${url.hostname}:${url.port}`;
    } catch { /* use default */ }

    this.monitor.displayMessage(
      Msg.VLESS_ADD_SUCCESS,
      { name },
      DisplayTextColor.SUCCESS
    );

    await pm.reloadConfigs();
    this.monitor.displayMessage(
      Msg.VLESS_RELOADED,
      { count: pm.count.toString() },
      DisplayTextColor.SUCCESS
    );
  }

  private async vlessRemoveServer(): Promise<void> {
    const pm = ProxyManager.instance;
    if (pm.count === 0) {
      this.monitor.displayMessage(Msg.VLESS_EMPTY, {}, DisplayTextColor.DANGER);
      return;
    }

    const input = this.monitor.awaitInput(
      Msg.VLESS_REMOVE_PROMPT,
      { max: pm.count.toString() },
      ""
    );
    if (!input) return;

    const idx = parseInt(input);
    if (isNaN(idx) || idx < 1 || idx > pm.count) {
      this.monitor.displayMessage(Msg.VLESS_REMOVE_INVALID, {}, DisplayTextColor.DANGER);
      return;
    }

    const name = pm.getName(idx - 1);
    const removed = pm.removeServer(idx - 1);
    if (!removed) {
      this.monitor.displayMessage(Msg.VLESS_REMOVE_INVALID, {}, DisplayTextColor.DANGER);
      return;
    }

    this.monitor.displayMessage(
      Msg.VLESS_REMOVE_SUCCESS,
      { name },
      DisplayTextColor.SUCCESS
    );

    await pm.reloadConfigs();

    if (pm.activeIndex >= pm.count) {
      pm.activeIndex = pm.count > 0 ? 0 : -1;
      Manager.config.activeProxyIndex = pm.activeIndex;
      Manager.config.save();
    }

    this.monitor.displayMessage(
      Msg.VLESS_RELOADED,
      { count: pm.count.toString() },
      DisplayTextColor.SUCCESS
    );
  }

  private async runCollectionFlow(
    rateLimitStatus: number | null
  ): Promise<void> {
    let id: number | null = null;

    try {
      this.monitor.nextTask();

      while (id === null) {
        this.monitor.update();
        const input = this.monitor.awaitInput(
          Msg.INPUT_ID_HINT,
          {},
          "None"
        );

        const result = parseInt(input);
        if (!isNaN(result)) {
          id = result;
        }
        this.monitor.setCondition({ retry_input: true });
      }

      Manager.collection.id = id;

      if (rateLimitStatus === 0 && Manager.config.mirror !== Mirror.Nerinyan) {
        Manager.config.mirror = Mirror.Nerinyan;
        this.monitor.freeze(
          Msg.MIRROR_SWITCHED_DUE_TO_RATE_LIMIT,
          { mirror: Mirror.Nerinyan },
          FreezeCondition.WARNING
        );
      }
    } catch (e) {
      throw new OcdlError("GET_USER_INPUT_FAILED", e);
    }

      this.monitor.nextTask();
    try {
      const v1Data = await Requestor.fetchCollection(Manager.collection.id);
      Manager.collection.resolveData(v1Data);
    } catch (e) {
      throw new OcdlError("REQUEST_DATA_FAILED", e);
    }

    if (Manager.config.mode === 5) {
      if (!Manager.config.isOsuPathValid()) {
        return this.monitor.freeze(
          Msg.SETUP_OSU_PATH_INVALID,
          {},
          FreezeCondition.ERRORED
        );
      }
      try {
        this.addToCollectionDb();
      } catch (e) {
        this.monitor.freeze(
          Msg.PROCESS_ERRORED,
          { error: String(e) },
          FreezeCondition.ERRORED
        );
      }
      return;
    }

    await this.handleCollectionDownload(rateLimitStatus, {
      skipBriefInfo: true,
      skipFullData: false,
    });
  }

  private async runTournamentFlow(
    rateLimitStatus: number | null
  ): Promise<void> {
    this.monitor.nextTask();

    let tournament: TournamentResponse | null = null;

    while (tournament === null) {
      this.monitor.update();
      const input = this.monitor.awaitInput(
        Msg.INPUT_TOURNAMENT_ID,
        {},
        "None"
      );
      const tournamentId = parseInt(input, 10);

      if (isNaN(tournamentId)) {
        this.monitor.setCondition({ retry_input: true });
        continue;
      }

      try {
        tournament = await Requestor.fetchTournament(tournamentId);
    } catch (e) {
        throw new OcdlError("REQUEST_DATA_FAILED", e);
      }
    }

    const rounds = tournament.rounds ?? [];
    if (!rounds.length) {
      throw new OcdlError("CORRUPTED_RESPONSE", "No rounds found in tournament");
    }

    const list = rounds
      .map((round, index) => `${index + 1}: ${round.round}`)
      .join("\n");

    this.monitor.displayMessage(
      Msg.TOURNAMENT_ROUND_LIST,
      { list },
      DisplayTextColor.PRIMARY
    );

    let selectedRounds: TournamentRound[] = [];
    while (!selectedRounds.length) {
      const input = this.monitor.awaitInput(
        Msg.INPUT_TOURNAMENT_ROUND,
        { max: rounds.length.toString() },
        "0"
      );
      const value = input === "" ? 0 : parseInt(input, 10);

      if (isNaN(value) || value < 0 || value > rounds.length) {
        this.monitor.displayMessage(
          Msg.INPUT_TOURNAMENT_ROUND_ERR,
          { max: rounds.length.toString() },
          DisplayTextColor.DANGER
        );
        continue;
      }

      selectedRounds = value === 0 ? rounds : [rounds[value - 1]];
    }

    this.buildCollectionFromTournament(tournament, selectedRounds);

    this.monitor.nextTask();

    if (Manager.config.mode === 5) {
      if (!Manager.config.isOsuPathValid()) {
        return this.monitor.freeze(
          Msg.SETUP_OSU_PATH_INVALID,
          {},
          FreezeCondition.ERRORED
        );
      }
      try {
        this.addToCollectionDb();
    } catch (e) {
        this.monitor.freeze(
          Msg.PROCESS_ERRORED,
          { error: String(e) },
          FreezeCondition.ERRORED
        );
      }
      return;
    }

    await this.handleCollectionDownload(rateLimitStatus, {
      skipBriefInfo: true,
      skipFullData: true,
    });
  }

  private buildCollectionFromTournament(
    tournament: TournamentResponse,
    selectedRounds: TournamentRound[]
  ): void {
    const collection = Manager.collection;

    collection.id = tournament.id;
    if (selectedRounds.length === tournament.rounds.length) {
      collection.name = tournament.name;
    } else if (selectedRounds.length === 1) {
      collection.name = `${tournament.name} - ${selectedRounds[0].round}`;
    } else {
      collection.name = `${tournament.name} - Selected rounds`;
    }
    collection.uploader = {
      username: tournament.uploader?.username ?? "Unknown",
    };

    const beatMapSets: Map<number, BeatMapSet> = new Map();
    const fullBeatmaps: TournamentBeatMap[] = [];

    for (const round of selectedRounds) {
      for (const modGroup of round.mods ?? []) {
        for (const map of modGroup.maps ?? []) {
          const setId = map.beatmapset.id;

          let beatMapSet = beatMapSets.get(setId);
          if (!beatMapSet) {
            beatMapSet = new BeatMapSet({ id: setId, beatmaps: [] });
            beatMapSets.set(setId, beatMapSet);
          }

          if (!beatMapSet.beatMaps.has(map.id)) {
            beatMapSet.beatMaps.set(map.id, new BeatMap({ id: map.id, checksum: map.checksum }));
          }

          fullBeatmaps.push(map);
        }
      }
    }

    collection.beatMapSets = beatMapSets;
    collection.beatMapSetCount = beatMapSets.size;
    collection.beatMapCount = Array.from(beatMapSets.values()).reduce(
      (acc, set) => acc + set.beatMaps.size,
      0
    );

    collection.resolveFullData(
      fullBeatmaps.map((m) => ({
        id: m.id,
        mode: m.mode,
        difficulty_rating: m.difficulty_rating,
        version: m.version,
        beatmapset: {
          id: m.beatmapset.id,
          title: m.beatmapset.title,
          artist: m.beatmapset.artist,
        },
      })) as unknown as v2ResCollectionType["beatmaps"]
    );
  }

  private async handleCollectionDownload(
    rateLimitStatus: number | null,
    options: { skipBriefInfo: boolean; skipFullData: boolean }
  ): Promise<void> {
    const { skipFullData } = options;

    this.monitor.nextTask();

    let folderPath: string;
    if (Manager.config.mode === 4) {
      if (!Manager.config.isOsuPathValid()) {
        return this.monitor.freeze(
          Msg.SETUP_OSU_PATH_INVALID,
          {},
          FreezeCondition.ERRORED
        );
      }
      folderPath = Manager.config.songsPath;
    } else {
      folderPath = Manager.config.useSubfolder
        ? _path.join(
      Manager.config.directory,
      Manager.collection.getCollectionFolderName()
          )
        : Manager.config.directory;
    }

    const logFolderPath = Manager.config.useSubfolder
      ? folderPath
      : _path.dirname(Manager.config.directory);

    const missingLogPath = _path.join(logFolderPath, Logger.missingLogPath);

    if (Manager.config.useSubfolder && !existsSync(folderPath)) {
      try {
        mkdirSync(folderPath);
      } catch (e) {
        throw new OcdlError("FOLDER_GENERATION_FAILED", e);
      }
    }

    if (existsSync(missingLogPath)) {
      try {
        let option: 1 | 2 | null = null;
        while (option === null) {
          this.monitor.setCondition({ missing_log_found: true });
          this.monitor.update();
          const result = this.monitor.awaitInputWithBack(
            Msg.INPUT_CONTINUE_DOWNLOAD,
            {}
          );

          if (result === GO_BACK_SIGNAL) return;

          if (["1", "2"].includes(result)) {
            option = parseInt(result) as 1 | 2;
          }
          this.monitor.setCondition({ retry_missing_log_input: true });
        }

        if (option === 1) {
          Manager.config.mode = 1;
          const missingLog = readFileSync(missingLogPath, "utf-8");
          const lines = missingLog.split("\n").slice(2);

          this.resumeMissingBeatmapIds = new Set<number>();
          for (const line of lines) {
            const match = line.trim().match(/\/beatmapsets\/(\d+)/);
            if (match) this.resumeMissingBeatmapIds.add(+match[1]);
          }
        }

        unlinkSync(missingLogPath);
      } catch (e) {
        throw new OcdlError("GET_USER_INPUT_FAILED", e);
      }
    }

    this.monitor.nextTask();

    if (
      (Manager.config.mode === 2 || Manager.config.mode === 3) &&
      !skipFullData
    ) {
      let cursor: number | undefined = undefined;
      let fetchedCount = 0;
      do {
        const v2Data = await Requestor.fetchCollection(Manager.collection.id, {
          v2: true,
          cursor,
        });

        const und = Util.checkUndefined(v2Data, ["nextPageCursor", "beatmaps"]);
        if (und) {
          throw new OcdlError("CORRUPTED_RESPONSE", `${und} is required`);
        }

        const { nextPageCursor, beatmaps } = v2Data as v2ResCollectionType;
        cursor = nextPageCursor;
        Manager.collection.resolveFullData(beatmaps);

        fetchedCount += beatmaps.length;
        this.monitor.setCondition({ fetched_collection: fetchedCount });
        this.monitor.update();
      } while (cursor);
    }

    this.monitor.nextTask();

    if (Manager.config.mode === 2 || Manager.config.mode === 3) {
      try {
        const generator = new OsdbGenerator();
        generator.writeOsdb();
      } catch (e) {
        throw new OcdlError("GENERATE_OSDB_FAILED", e);
      }
    }

    if (Manager.config.mode === 3) {
      return this.monitor.freeze(Msg.GENERATED_OSDB, {
        name: Manager.collection.name,
      });
    }

    this.monitor.nextTask();

    try {
      if (
        rateLimitStatus !== null &&
        rateLimitStatus < Manager.collection.beatMapSetCount
      ) {
        this.monitor.freeze(
          Msg.TO_DOWNLOADS_EXCEED_DAILY_RATE_LIMIT,
          {
            collection: Manager.collection.beatMapSetCount.toString(),
            limit: rateLimitStatus.toString(),
          },
          FreezeCondition.WARNING
        );
      }

      if (this.resumeMissingBeatmapIds !== null) {
        const filtered: Map<number, BeatMapSet> = new Map();
        for (const id of this.resumeMissingBeatmapIds) {
          const bs = Manager.collection.beatMapSets.get(id);
          if (bs) filtered.set(id, bs);
        }
        Manager.collection.beatMapSets = filtered;
        Manager.collection.beatMapSetCount = filtered.size;
      }

      if (Manager.config.mode === 4) {
        const saved: Array<{ id: number; checksum: string }> = [];
        Manager.collection.beatMapSets.forEach((bs) => {
          bs.beatMaps.forEach((bm) => {
            saved.push({ id: bm.id, checksum: bm.checksum });
          });
        });
        this.savedBeatMaps = saved;
      }

      const downloadManager = new DownloadManager(rateLimitStatus);

      downloadManager
        .on("downloading", (beatMapSet) => {
          this.monitor.appendDownloadLog(
            Msg.DOWNLOADING_FILE,
            { id: beatMapSet.id.toString(), name: beatMapSet.title ?? "" },
            DisplayTextColor.SECONDARY
          );
          this.monitor.update();
        })
        .on("retrying", (beatMapSet) => {
          this.monitor.appendDownloadLog(
            Msg.RETRYING_DOWNLOAD,
            { id: beatMapSet.id.toString(), name: beatMapSet.title ?? "" },
            DisplayTextColor.SECONDARY
          );
          this.monitor.update();
        })
        .on("skipped", (beatMapSet) => {
          this.monitor.setCondition({
            downloaded_beatmapset: downloadManager.getDownloadedBeatMapSetSize(),
          });
          this.monitor.appendDownloadLog(
            Msg.SKIPPED_FILE,
            { id: beatMapSet.id.toString(), name: beatMapSet.title ?? "" },
            DisplayTextColor.SECONDARY
          );
          this.monitor.update();
        })
        .on("downloaded", (beatMapSet) => {
          this.monitor.setCondition({
            downloaded_beatmapset: downloadManager.getDownloadedBeatMapSetSize(),
            remaining_downloads: downloadManager.getRemainingDownloadsLimit(),
          });
          this.monitor.appendDownloadLog(
            Msg.DOWNLOADED_FILE,
            { id: beatMapSet.id.toString(), name: beatMapSet.title ?? "" },
            DisplayTextColor.SUCCESS
          );
          this.monitor.update();
        })
        .on("rateLimited", () => {
          this.monitor.appendDownloadLog(
            Msg.RATE_LIMITED,
            {},
            DisplayTextColor.DANGER
          );
          this.monitor.update();
        })
        .on("dailyRateLimited", (beatMapSets) => {
          if (beatMapSets.length > 0) {
            Logger.generateMissingLog(logFolderPath, beatMapSets);
          }
          this.monitor.setCondition({ remaining_downloads: 0 });
          this.monitor.update();
          this.monitor.freeze(
            Msg.DAILY_RATE_LIMIT_HIT,
            {},
            FreezeCondition.ERRORED
          );
        })
        .on("blocked", (beatMapSets) => {
          if (beatMapSets.length > 0) {
            Logger.generateMissingLog(logFolderPath, beatMapSets);
          }
          this.monitor.freeze(
            Msg.REQUEST_BLOCKED,
            {},
            FreezeCondition.ERRORED
          );
        })
        .on("unavailable", (beatMapSets) => {
          if (beatMapSets.length > 0) {
            Logger.generateMissingLog(logFolderPath, beatMapSets);
          }
          this.monitor.freeze(
            Msg.RESOURCE_UNAVAILBALE,
            {},
            FreezeCondition.ERRORED
          );
        })
        .on("end", (beatMapSets) => {
          if (beatMapSets.length > 0) {
            Logger.generateMissingLog(logFolderPath, beatMapSets);
          }

          if (Manager.config.mode === 4) {
            try {
              this.addToCollectionDb();
            } catch (e) {
              this.monitor.freeze(
                Msg.PROCESS_ERRORED,
                { error: String(e) },
                FreezeCondition.ERRORED
              );
            }
          } else {
            this.monitor.freeze(Msg.DOWNLOAD_COMPLETED);
          }
        })
        .on("error", (beatMapSet, e) => {
          this.monitor.appendDownloadLog(
            Msg.DOWNLOAD_FILE_FAILED,
            {
              id: beatMapSet.id.toString(),
              name: beatMapSet.title ?? "",
              error: String(e),
            },
            DisplayTextColor.DANGER
          );
          this.monitor.update();
        });

      const cleanUp = () => {
        const notDownloaded = downloadManager.getNotDownloadedBeatapSets();
        if (notDownloaded.length > 0) {
          Logger.generateMissingLog(logFolderPath, notDownloaded);
        }
      };
      ["SIGINT", "SIGTERM", "SIGHUP"].forEach((signal) => {
        process.on(signal, () => cleanUp());
      });

      downloadManager.bulkDownload();

      await new Promise<void>((resolve) => {
        downloadManager.on("end", () => resolve());
        downloadManager.on("dailyRateLimited", () => resolve());
        downloadManager.on("blocked", () => resolve());
        downloadManager.on("unavailable", () => resolve());
      });
    } catch (e) {
      throw new OcdlError("MANAGE_DOWNLOAD_FAILED", e);
    }
  }

  private waitForOsuClosed(): boolean {
    this.monitor.displayMessage(Msg.CHECK_OSU_RUNNING);
    while (CollectionDbManager.isOsuRunning()) {
      this.monitor.displayMessage(
        Msg.OSU_IS_RUNNING_WAIT,
        {},
        DisplayTextColor.DANGER
      );
      this.monitor.awaitInput(Msg.OSU_IS_RUNNING_PROMPT, {}, "");
      this.monitor.displayMessage(Msg.CHECK_OSU_RUNNING);
      if (CollectionDbManager.isOsuRunning()) {
        this.monitor.displayMessage(
          Msg.OSU_STILL_RUNNING,
          {},
          DisplayTextColor.DANGER
        );
      }
    }
    return true;
  }

  private addToCollectionDb(): boolean {
    if (!this.waitForOsuClosed()) return false;

    let beatmapIdToRealHash: Map<number, string> = new Map();
    this.monitor.displayMessage(Msg.FIX_READING_OSU_DB);
    try {
      const reader = new OsuDbReader(Manager.config.osuDbPath);
      beatmapIdToRealHash = reader.readBeatmapIdToHash();
      this.monitor.displayMessage(Msg.FIX_OSU_DB_COMPLETE, {
        count: beatmapIdToRealHash.size.toString(),
      });
    } catch { /* use API hashes if osu!.db unreadable */ }

    const dbManager = new CollectionDbManager();
    this.monitor.displayMessage(Msg.READING_COLLECTION_DB);
    dbManager.readCollectionDb();

    let collectionName = Manager.collection.name;
    let collectionAction: "merge" | "replace" = "merge";

    if (dbManager.hasCollection(collectionName)) {
      const existingSize = dbManager.getCollectionSize(collectionName);
      this.monitor.displayMessage(Msg.COLLECTION_CONFLICT, {
        name: collectionName,
        count: existingSize.toString(),
      });

      let valid = false;
      while (!valid) {
        const choice = this.monitor.awaitInput(
          Msg.COLLECTION_CONFLICT_INPUT,
          {},
          "1"
        );
        if (choice === "1") {
          collectionAction = "merge";
          valid = true;
        } else if (choice === "2") {
          collectionAction = "replace";
          valid = true;
        } else if (choice === "3") {
          let suffix = 2;
          while (dbManager.hasCollection(`${Manager.collection.name}_${suffix}`)) suffix++;
          collectionName = `${Manager.collection.name}_${suffix}`;
          collectionAction = "merge";
          valid = true;
        } else if (choice === "4") {
          return false;
        }
      }
    }

    const { hashes, replaced } = CollectionDbManager.getMd5HashesWithRealHashes(
      beatmapIdToRealHash,
      this.savedBeatMaps ?? undefined
    );

    this.monitor.displayMessage(Msg.ADDING_TO_COLLECTION_DB);
    if (collectionAction === "replace") {
      dbManager.replaceCollection(collectionName, hashes);
    } else {
      dbManager.addCollection(collectionName, hashes);
    }

    dbManager.writeCollectionDb();

    const backupPath = dbManager.getLastBackupPath();
    if (backupPath) {
      this.monitor.displayMessage(Msg.COLLECTION_DB_BACKUP_CREATED, {
        path: backupPath,
      });
    }

    if (replaced > 0) {
      this.monitor.displayMessage(Msg.FIX_COLLECTION_STATS, {
        name: collectionName,
        fixed: replaced.toString(),
        total: hashes.length.toString(),
      });
    }

    this.monitor.freeze(Msg.COLLECTION_DB_UPDATED, {
      name: collectionName,
      count: hashes.length.toString(),
    });

    return true;
  }

  private async runFixCommand(): Promise<void> {
    this.monitor.displayMessage(Msg.FIX_START, {}, DisplayTextColor.PRIMARY);

    if (!Manager.config.isOsuPathValid()) {
      const input = this.monitor.awaitInput(Msg.SETUP_OSU_PATH, {}, "");
      if (input) {
        const full = _path.isAbsolute(input) ? input : _path.resolve(input);
        if (
          existsSync(full) &&
          existsSync(_path.join(full, "Songs")) &&
          existsSync(_path.join(full, "osu!.db"))
        ) {
          Manager.config.osuPath = full;
          Manager.config.save();
        } else {
          return this.monitor.freeze(
            Msg.SETUP_OSU_PATH_INVALID,
            {},
            FreezeCondition.ERRORED
          );
        }
      } else {
        return this.monitor.freeze(
          Msg.SETUP_OSU_PATH_INVALID,
          {},
          FreezeCondition.ERRORED
        );
      }
    }

    let collectionId: number | null = null;
    while (collectionId === null) {
      const input = this.monitor.awaitInput(
        Msg.FIX_INPUT_COLLECTION_ID,
        {},
        ""
      );
      if (!input) return;
      const parsed = parseInt(input);
      if (!isNaN(parsed)) collectionId = parsed;
    }

    if (!this.waitForOsuClosed()) return;

    this.monitor.displayMessage(Msg.FETCH_BRIEF_INFO, {
      id: collectionId.toString(),
    });
    try {
      const apiData = await Requestor.fetchCollection(collectionId);
      Manager.collection.id = collectionId;
      Manager.collection.resolveData(apiData);
    } catch (e) {
      return this.monitor.freeze(
        Msg.PROCESS_ERRORED,
        { error: String(e) },
        FreezeCondition.ERRORED
      );
    }

    this.monitor.displayMessage(Msg.FIX_READING_OSU_DB);
    const osuDbReader = new OsuDbReader(Manager.config.osuDbPath);
    let beatmapIdToRealHash: Map<number, string>;
    let existingBeatmapsetIds: Set<number>;
    try {
      beatmapIdToRealHash = osuDbReader.readBeatmapIdToHash();
      existingBeatmapsetIds = osuDbReader.readAllBeatmapsetIds();
    } catch (e) {
      return this.monitor.freeze(
        Msg.PROCESS_ERRORED,
        { error: String(e) },
        FreezeCondition.ERRORED
      );
    }

    this.monitor.displayMessage(Msg.FIX_OSU_DB_COMPLETE, {
      count: beatmapIdToRealHash.size.toString(),
    });

    this.monitor.displayMessage(Msg.FIX_HASHES_FIXING);
    const { hashes, replaced } =
      CollectionDbManager.getMd5HashesWithRealHashes(beatmapIdToRealHash);

    const dbManager = new CollectionDbManager();
    dbManager.readCollectionDb();
    dbManager.replaceCollection(Manager.collection.name, hashes);
    dbManager.writeCollectionDb();

    const backupPath = dbManager.getLastBackupPath();
    if (backupPath) {
      this.monitor.displayMessage(Msg.COLLECTION_DB_BACKUP_CREATED, {
        path: backupPath,
      });
    }

    this.monitor.displayMessage(Msg.FIX_HASHES_COMPLETE, {
      fixed: replaced.toString(),
      total: hashes.length.toString(),
      name: Manager.collection.name,
    });

    const missingIds = new Set<number>();
    for (const [beatmapsetId, beatMapSet] of Manager.collection.beatMapSets) {
      let hasAny = existingBeatmapsetIds.has(beatmapsetId);
      if (!hasAny && beatMapSet.beatMaps) {
        for (const bm of beatMapSet.beatMaps.values()) {
          if (beatmapIdToRealHash.has(bm.id)) {
            hasAny = true;
            break;
          }
        }
      }
      if (!hasAny) missingIds.add(beatmapsetId);
    }

    if (missingIds.size === 0) {
      return this.monitor.freeze(Msg.FIX_ALL_DOWNLOADED, {
        fixed: replaced.toString(),
        total: hashes.length.toString(),
        name: Manager.collection.name,
      });
    }

    this.monitor.displayMessage(Msg.FIX_MISSING_COUNT, {
      missing: missingIds.size.toString(),
      total: Manager.collection.beatMapSetCount.toString(),
    });

    const confirm = this.monitor.awaitInput(Msg.FIX_CONFIRM_DOWNLOAD, {}, "y");
    if (confirm.toLowerCase() !== "y") return;

    const filtered = new Map<number, BeatMapSet>();
    for (const id of missingIds) {
      const bs = Manager.collection.beatMapSets.get(id);
      if (bs) filtered.set(id, bs);
    }
    Manager.collection.beatMapSets = filtered;
    Manager.collection.beatMapSetCount = filtered.size;

    let rl: number | null = null;
    try {
      rl = await Requestor.checkRateLimitation();
    } catch { /* proceed without rate limit */ }

    this.monitor.setTask(6);

    const downloadManager = new DownloadManager(rl);
    const logFolderPath = _path.join(
      Manager.config.directory,
      Manager.collection.getCollectionFolderName()
    );

    downloadManager
      .on("downloading", (bs) => {
        this.monitor.appendDownloadLog(
          Msg.DOWNLOADING_FILE,
          { id: bs.id.toString(), name: bs.title ?? "" },
          DisplayTextColor.SECONDARY
        );
        this.monitor.update();
      })
      .on("skipped", (bs) => {
        this.monitor.setCondition({
          downloaded_beatmapset: downloadManager.getDownloadedBeatMapSetSize(),
        });
        this.monitor.appendDownloadLog(
          Msg.SKIPPED_FILE,
          { id: bs.id.toString(), name: bs.title ?? "" },
          DisplayTextColor.SECONDARY
        );
        this.monitor.update();
      })
      .on("downloaded", (bs) => {
        this.monitor.setCondition({
          downloaded_beatmapset: downloadManager.getDownloadedBeatMapSetSize(),
        });
        this.monitor.appendDownloadLog(
          Msg.DOWNLOADED_FILE,
          { id: bs.id.toString(), name: bs.title ?? "" },
          DisplayTextColor.SUCCESS
        );
        this.monitor.update();
      })
      .on("error", (bs, e) => {
        this.monitor.appendDownloadLog(
          Msg.DOWNLOAD_FILE_FAILED,
          { id: bs.id.toString(), name: bs.title ?? "", error: String(e) },
          DisplayTextColor.DANGER
        );
        this.monitor.update();
      })
      .on("end", () => {
        this.monitor.freeze(Msg.FIX_DOWNLOAD_COMPLETE, {
          downloaded: downloadManager.getDownloadedBeatMapSetSize().toString(),
          total: missingIds.size.toString(),
          name: Manager.collection.name,
        });
      });

      downloadManager.bulkDownload();

    await new Promise<void>((resolve) => {
      downloadManager.on("end", () => resolve());
      downloadManager.on("dailyRateLimited", () => resolve());
      downloadManager.on("blocked", () => resolve());
    });

    void logFolderPath; // used above
  }

  private runBackupCommand(): void {
    this.monitor.displayMessage(
      Msg.BACKUP_DESCRIPTION,
      {},
      DisplayTextColor.PRIMARY
    );

    const confirm = this.monitor.awaitInput(Msg.BACKUP_CONFIRM, {}, "n");
    if (confirm.toLowerCase() !== "y") {
      this.monitor.displayMessage(Msg.BACKUP_CANCELLED);
      return;
    }

    if (!Manager.config.isOsuPathValid()) {
      const input = this.monitor.awaitInput(Msg.SETUP_OSU_PATH, {}, "");
      if (input) {
        const full = _path.isAbsolute(input) ? input : _path.resolve(input);
        if (
          existsSync(full) &&
          existsSync(_path.join(full, "Songs")) &&
          existsSync(_path.join(full, "osu!.db"))
        ) {
          Manager.config.osuPath = full;
          Manager.config.save();
        } else {
          return this.monitor.freeze(
            Msg.SETUP_OSU_PATH_INVALID,
            {},
            FreezeCondition.ERRORED
          );
        }
      } else {
        return this.monitor.freeze(
          Msg.SETUP_OSU_PATH_INVALID,
          {},
          FreezeCondition.ERRORED
        );
      }
    }

    if (!this.waitForOsuClosed()) return;

    this.monitor.displayMessage(Msg.BACKUP_READING_OSU_DB);
    let allHashes: Set<string>;
    try {
      const reader = new OsuDbReader(Manager.config.osuDbPath);
      allHashes = reader.readAllHashes();
    } catch (e) {
      return this.monitor.freeze(
        Msg.PROCESS_ERRORED,
        { error: String(e) },
        FreezeCondition.ERRORED
      );
    }

    this.monitor.displayMessage(Msg.BACKUP_FOUND_MAPS, {
      count: allHashes.size.toString(),
    });

    if (allHashes.size === 0) {
      return this.monitor.freeze(
        Msg.BACKUP_NO_MAPS,
        {},
        FreezeCondition.ERRORED
      );
    }

    this.monitor.displayMessage(Msg.READING_COLLECTION_DB);
    const dbManager = new CollectionDbManager();
    dbManager.readCollectionDb();

    let collectionName = "backup maps";
    let collectionAction: "merge" | "replace" = "merge";

    if (dbManager.hasCollection(collectionName)) {
      const existingSize = dbManager.getCollectionSize(collectionName);
      this.monitor.displayMessage(Msg.COLLECTION_CONFLICT, {
        name: collectionName,
        count: existingSize.toString(),
      });

      let valid = false;
      while (!valid) {
        const choice = this.monitor.awaitInput(
          Msg.COLLECTION_CONFLICT_INPUT,
          {},
          "1"
        );
        if (choice === "1") {
          collectionAction = "merge";
          valid = true;
        } else if (choice === "2") {
          collectionAction = "replace";
          valid = true;
        } else if (choice === "3") {
          let suffix = 2;
          while (dbManager.hasCollection(`backup maps_${suffix}`)) suffix++;
          collectionName = `backup maps_${suffix}`;
          collectionAction = "merge";
          valid = true;
        } else if (choice === "4") {
          return;
        }
      }
    }

    this.monitor.displayMessage(Msg.BACKUP_WRITING);
    const hashArray = Array.from(allHashes);

    if (collectionAction === "replace") {
      dbManager.replaceCollection(collectionName, hashArray);
    } else {
      dbManager.addCollection(collectionName, hashArray);
    }

    dbManager.writeCollectionDb();

    const backupPath = dbManager.getLastBackupPath();
    if (backupPath) {
      this.monitor.displayMessage(Msg.COLLECTION_DB_BACKUP_CREATED, {
        path: backupPath,
      });
    }

    this.monitor.freeze(Msg.BACKUP_COMPLETE, {
      count: hashArray.length.toString(),
      name: collectionName,
    });
  }
}
