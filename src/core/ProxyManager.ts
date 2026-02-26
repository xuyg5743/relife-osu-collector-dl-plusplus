import { existsSync, writeFileSync, unlinkSync, readFileSync } from "fs";
import { chmodSync } from "fs";
import _path from "path";
import { ProxyAgent, request } from "undici";
import { getCatboyDownloadUrl } from "../struct/Constant";
import Manager from "./Manager";
import { LIB_VERSION } from "../version";

const BASE_PORT = 10810;
const TEST_BEATMAPSET_ID = 2423811;

function getAppDirectory(): string {
  if (process.pkg) {
    return _path.dirname(process.execPath);
  }
  return process.cwd();
}

interface VlessConfig {
  name: string;
  uuid: string;
  address: string;
  port: number;
  encryption: string;
  network: string;
  security: string;
  path: string;
  sni: string;
  fingerprint: string;
  publicKey: string;
  shortId: string;
  flow: string;
  alpn: string;
  host: string;
  localPort: number;
}

interface ProcHandle {
  kill: () => boolean;
  on: (event: string, listener: () => void) => void;
}

export default class ProxyManager {
  private static _instance: ProxyManager | null = null;
  private configs: VlessConfig[] = [];
  private processes = new Map<number, ProcHandle>();
  private xrayPath: string | null = null;
  private _activeIndex = -1;
  private cachedLimits = new Map<number, number | null>();

  private constructor() {
    this.xrayPath = this.findXray();
    this.configs = this.loadConfigs();

    process.on("exit", () => this.stopAll());
  }

  static get instance(): ProxyManager {
    if (!this._instance) {
      this._instance = new ProxyManager();
    }
    return this._instance;
  }

  get isAvailable(): boolean {
    return this.xrayPath !== null && this.configs.length > 0;
  }

  get hasXray(): boolean {
    return this.xrayPath !== null;
  }

  get hasConfigs(): boolean {
    return this.configs.length > 0;
  }

  get count(): number {
    return this.configs.length;
  }

  get activeIndex(): number {
    return this._activeIndex;
  }

  set activeIndex(index: number) {
    this._activeIndex = index;
  }

  getDispatcher(): ProxyAgent | undefined {
    if (this._activeIndex < 0 || this._activeIndex >= this.configs.length) {
      return undefined;
    }
    if (!this.processes.has(this._activeIndex)) return undefined;
    const config = this.configs[this._activeIndex];
    return new ProxyAgent(`http://127.0.0.1:${config.localPort}`);
  }

  getName(index: number): string {
    return this.configs[index]?.name ?? `Proxy ${index + 1}`;
  }

  getActiveName(): string {
    if (this._activeIndex < 0) return "Direct";
    return this.getName(this._activeIndex);
  }

  isRunning(index: number): boolean {
    return this.processes.has(index);
  }

  async startAll(): Promise<number> {
    if (!this.xrayPath) return 0;
    const results = await Promise.all(
      this.configs.map((_, i) => this.startProxy(i))
    );
    return results.filter(Boolean).length;
  }

  async startProxy(index: number): Promise<boolean> {
    if (!this.xrayPath || index < 0 || index >= this.configs.length) return false;
    if (this.processes.has(index)) return true;

    const config = this.configs[index];
    const xrayConfig = this.generateXrayConfig(config);
    const appDir = getAppDirectory();
    const configPath = _path.join(appDir, `.xray-config-${index}.json`);
    writeFileSync(configPath, JSON.stringify(xrayConfig, null, 2));

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const cp = require("child_process") as typeof import("child_process");

      const proc = cp.spawn(this.xrayPath, ["run", "-c", configPath], {
        stdio: "pipe",
        windowsHide: true,
      }) as unknown as ProcHandle;

      this.processes.set(index, proc);

      proc.on("exit", () => {
        this.processes.delete(index);
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      return this.processes.has(index);
    } catch {
      return false;
    }
  }

  stopProxy(index: number): void {
    const proc = this.processes.get(index);
    if (proc) {
      try { proc.kill(); } catch { /* ignore */ }
      this.processes.delete(index);
    }
  }

  stopAll(): void {
    for (const [idx] of this.processes) {
      this.stopProxy(idx);
    }
    const appDir = getAppDirectory();
    for (let i = 0; i < this.configs.length; i++) {
      const configPath = _path.join(appDir, `.xray-config-${i}.json`);
      try { unlinkSync(configPath); } catch { /* ignore */ }
    }
  }

  async checkRateLimit(index: number, useCache = true): Promise<number | null> {
    if (!this.isRunning(index)) return null;

    if (useCache && this.cachedLimits.has(index)) {
      return this.cachedLimits.get(index) ?? null;
    }

    const config = this.configs[index];
    const dispatcher = new ProxyAgent(`http://127.0.0.1:${config.localPort}`);
    const testUrl = getCatboyDownloadUrl(Manager.config.catboyServer) + TEST_BEATMAPSET_ID.toString();

    try {
      const res = await request(testUrl, {
        method: "HEAD",
        headers: { "User-Agent": `osu-collector-dl/v${LIB_VERSION}` },
        dispatcher,
      });

      const xRateLimit = res.headers["x-ratelimit-remaining"];
      if (xRateLimit) {
        const limit = parseInt(Array.isArray(xRateLimit) ? xRateLimit[0] : xRateLimit);
        if (!isNaN(limit)) {
          this.cachedLimits.set(index, limit);
          return limit;
        }
      }

      this.cachedLimits.set(index, null);
      return null;
    } catch {
      this.cachedLimits.set(index, null);
      return null;
    }
  }

  async checkAllRateLimits(useCache = true): Promise<(number | null)[]> {
    return Promise.all(
      this.configs.map((_, i) => this.checkRateLimit(i, useCache))
    );
  }

  getCachedLimit(index: number): number | null {
    return this.cachedLimits.get(index) ?? null;
  }

  updateCachedLimit(index: number, limit: number | null): void {
    this.cachedLimits.set(index, limit);
  }

  clearCache(): void {
    this.cachedLimits.clear();
  }

  private extractXray(): string | null {
    const isWin = process.platform === "win32";
    const exeName = isWin ? "xray.exe" : "xray";
    const appDir = getAppDirectory();
    const extractPath = _path.join(appDir, exeName);

    if (existsSync(extractPath)) return extractPath;

    const bundledPaths = [
      _path.join("/snapshot", "osusource", "bin", exeName),
      _path.join(process.execPath, "..", "bin", exeName),
    ];

    for (const src of bundledPaths) {
      try {
        const data = readFileSync(src);
        writeFileSync(extractPath, data);
        if (!isWin) {
          chmodSync(extractPath, 0o755);
        }
        return extractPath;
      } catch { /* try next */ }
    }

    return null;
  }

  private findXray(): string | null {
    const isWin = process.platform === "win32";
    const exeName = isWin ? "xray.exe" : "xray";
    const appDir = getAppDirectory();

    const candidates = [
      _path.join(appDir, exeName),
      _path.join(appDir, "bin", exeName),
    ];

    for (const p of candidates) {
      if (existsSync(p)) return p;
    }

    if (process.pkg) {
      const extracted = this.extractXray();
      if (extracted) return extracted;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const cp = require("child_process") as typeof import("child_process");
      cp.execSync(`${exeName} version`, { stdio: "pipe" });
      return exeName;
    } catch {
      return null;
    }
  }

  private loadConfigs(): VlessConfig[] {
    const lines = Manager.config.vlessServers;
    if (!lines || lines.length === 0) return [];

    return lines
      .map((line, i) => {
        const config = this.parseVlessUri(line.trim());
        if (config) config.localPort = BASE_PORT + i;
        return config;
      })
      .filter((c): c is VlessConfig => c !== null);
  }

  async reloadConfigs(): Promise<void> {
    this.stopAll();
    this.cachedLimits.clear();
    this.configs = this.loadConfigs();

    if (this._activeIndex >= this.configs.length) {
      this._activeIndex = this.configs.length > 0 ? 0 : -1;
    }

    if (this.xrayPath && this.configs.length > 0) {
      await this.startAll();
    }
  }

  addServer(vlessUri: string): boolean {
    const parsed = this.parseVlessUri(vlessUri.trim());
    if (!parsed) return false;
    Manager.config.vlessServers.push(vlessUri.trim());
    Manager.config.save();
    return true;
  }

  removeServer(index: number): boolean {
    if (index < 0 || index >= Manager.config.vlessServers.length) return false;
    Manager.config.vlessServers.splice(index, 1);
    Manager.config.save();
    return true;
  }

  getServerUri(index: number): string | null {
    return Manager.config.vlessServers[index] ?? null;
  }

  private parseVlessUri(uri: string): VlessConfig | null {
    try {
      const url = new URL(uri);
      const uuid = url.username;
      const address = url.hostname;
      const port = parseInt(url.port) || 443;
      const name = url.hash
        ? decodeURIComponent(url.hash.slice(1))
        : `${address}:${port}`;
      const params = url.searchParams;

      return {
        name,
        uuid,
        address,
        port,
        encryption: params.get("encryption") || "none",
        network: params.get("type") || "tcp",
        security: params.get("security") || "none",
        path: params.get("path") || "/",
        sni: params.get("sni") || address,
        fingerprint: params.get("fp") || "chrome",
        publicKey: params.get("pbk") || "",
        shortId: params.get("sid") || "",
        flow: params.get("flow") || "",
        alpn: params.get("alpn") || "",
        host: params.get("host") || "",
        localPort: 0,
      };
    } catch {
      return null;
    }
  }

  private generateXrayConfig(config: VlessConfig): Record<string, unknown> {
    const streamSettings: Record<string, unknown> = {
      network: config.network,
    };

    if (config.security === "tls") {
      const tlsSettings: Record<string, unknown> = {
        serverName: config.sni,
        fingerprint: config.fingerprint,
        allowInsecure: false,
      };
      if (config.alpn) {
        tlsSettings.alpn = config.alpn.split(",");
      }
      streamSettings.security = "tls";
      streamSettings.tlsSettings = tlsSettings;
    } else if (config.security === "reality") {
      streamSettings.security = "reality";
      streamSettings.realitySettings = {
        serverName: config.sni,
        fingerprint: config.fingerprint,
        publicKey: config.publicKey,
        shortId: config.shortId,
      };
    }

    if (config.network === "ws") {
      const wsSettings: Record<string, unknown> = { path: config.path };
      if (config.host) {
        wsSettings.headers = { Host: config.host };
      }
      streamSettings.wsSettings = wsSettings;
    } else if (config.network === "grpc") {
      streamSettings.grpcSettings = {
        serviceName: config.path.replace(/^\//, ""),
      };
    } else if (config.network === "h2" || config.network === "http") {
      streamSettings.httpSettings = {
        path: config.path,
        host: [config.sni],
      };
    } else if (config.network === "httpupgrade") {
      streamSettings.httpupgradeSettings = { path: config.path };
    }

    const user: Record<string, string> = {
      id: config.uuid,
      encryption: config.encryption,
    };
    if (config.flow) user.flow = config.flow;

    return {
      log: { loglevel: "none" },
      inbounds: [
        {
          port: config.localPort,
          listen: "127.0.0.1",
          protocol: "http",
        },
      ],
      outbounds: [
        {
          protocol: "vless",
          settings: {
            vnext: [
              {
                address: config.address,
                port: config.port,
                users: [user],
              },
            ],
          },
          streamSettings,
        },
      ],
    };
  }
}
