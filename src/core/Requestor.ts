import { Response, fetch, request, ProxyAgent } from "undici";
import {
  Constant,
  Mirror,
  MirrorUrls,
  getCatboyDownloadUrl,
  getCatboyRateLimitUrl,
} from "../struct/Constant";
import { Json, Mode } from "../types";
import OcdlError from "../struct/OcdlError";
import { CollectionId } from "../struct/Collection";
import { LIB_VERSION } from "../version";
import Manager from "./Manager";
import ProxyManager from "./ProxyManager";

function getDispatcher() {
  const pm = ProxyManager.instance;
  if (pm.isAvailable && pm.activeIndex >= 0) {
    const dispatcher = pm.getDispatcher();
    if (dispatcher) return dispatcher;
  }

  const proxyUrl = Manager.config.proxy;
  if (proxyUrl) {
    return new ProxyAgent(proxyUrl);
  }
  return undefined;
}

interface FetchCollectionQuery {
  perPage?: number;
  cursor?: number;
}

interface DownloadCollectionOptions {
  mirror?: Mirror;
}

interface FetchCollectionOptions {
  v2: boolean;
  cursor?: number;
}

// Basic collection data types
export interface v1ResCollectionType extends Json {
  beatmapIds: v1ResBeatMapType[];
  beatmapsets: v1ResBeatMapSetType[];
  id: number;
  name: string;
  uploader: {
    username: string;
  };
}
export interface v1ResBeatMapSetType extends Json {
  beatmaps: v1ResBeatMapType[];
  id: number;
}
export interface v1ResBeatMapType extends Json {
  checksum: string;
  id: number;
}

// Full collection data types
export interface v2ResCollectionType extends Json {
  hasMore: boolean;
  nextPageCursor: number;
  beatmaps: v2ResBeatMapType[];
}
export interface v2ResBeatMapType extends Json {
  id: number;
  mode: Mode;
  difficulty_rating: number;
  version: string;
  beatmapset: v2ResBeatMapSetType;
}
export interface v2ResBeatMapSetType extends Json {
  id: number;
  title: string;
  artist: string;
}

// Tournament data types
export interface TournamentBeatMapSet {
  id: number;
  artist: string;
  title: string;
}

export interface TournamentBeatMap {
  id: number;
  checksum: string;
  difficulty_rating: number;
  version: string;
  mode: Mode;
  beatmapset: TournamentBeatMapSet;
}

export interface TournamentModGroup {
  mod: string;
  maps: TournamentBeatMap[];
}

export interface TournamentRound {
  mods: TournamentModGroup[];
  round: string;
}

export interface TournamentResponse {
  id: number;
  name: string;
  description?: string;
  uploader?: {
    id: number;
    username: string;
  };
  rounds: TournamentRound[];
}

export class Requestor {
  static async fetchDownloadCollection(
    id: CollectionId,
    options: DownloadCollectionOptions = {}
  ): Promise<Response> {
    const mirror = options.mirror ?? Manager.config.mirror;
    const mirrorBaseUrl =
      mirror === Mirror.Catboy
        ? getCatboyDownloadUrl(Manager.config.catboyServer)
        : MirrorUrls[mirror];
    const baseUrl = mirrorBaseUrl + id.toString();

    // noVideo param for mirrors that support it; Sayobot has novideo in path already
    const url =
      mirror === Mirror.Nerinyan || mirror === Mirror.Catboy
        ? baseUrl + "?noVideo=1"
        : baseUrl;

    const res = await fetch(url, {
      headers: { "User-Agent": `osu-collector-dl/v${LIB_VERSION}` },
      method: "GET",
      dispatcher: getDispatcher(),
    });
    return res;
  }

  static async fetchCollection(
    id: CollectionId,
    options: FetchCollectionOptions = { v2: false }
  ): Promise<Json> {
    const { v2, cursor } = options;
    const url =
      Constant.OsuCollectorApiUrl + id.toString() + (v2 ? "/beatmapsV2" : "");

    const query: FetchCollectionQuery = v2
      ? { perPage: 100, cursor }
      : {};

    const data = await request(url, { method: "GET", query, dispatcher: getDispatcher() })
      .then(async (res) => {
        if (res.statusCode !== 200) {
          throw `Status code: ${res.statusCode}`;
        }
        return (await res.body.json()) as Json;
      })
      .catch((e: unknown) => {
        return new OcdlError("REQUEST_DATA_FAILED", e);
      });

    if (data instanceof OcdlError) {
      throw data;
    }

    return data;
  }

  static async checkRateLimitation(): Promise<number | null> {
    const rateLimitUrl = getCatboyRateLimitUrl(Manager.config.catboyServer);
    const res = await request(rateLimitUrl, {
      method: "GET",
      headers: { "User-Agent": `osu-collector-dl/v${LIB_VERSION}` },
      dispatcher: getDispatcher(),
    });

    if (!res || res.statusCode !== 200) return null;
    const data = (await res.body.json().catch(() => null)) as Json | null;
    if (!data) return null;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    return ((data as any).daily?.remaining?.downloads ?? null) as number | null;
  }

  static async checkNewVersion(
    current_version: string
  ): Promise<string | null> {
    if (current_version === "Unknown") return null;

    const res = await request(Constant.GithubReleaseApiUrl, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": `osu-collector-dl/v${current_version}`,
      },
      query: { per_page: 1 },
      dispatcher: getDispatcher(),
    }).catch(() => null);

    if (!res || res.statusCode !== 200) return null;
    const data = (await res.body.json().catch(() => null)) as Json[] | null;
    if (!data) return null;

    const version = data[0].tag_name as string;
    if (version === "v" + current_version) return null;
    return version;
  }

  static async fetchTournament(id: number): Promise<TournamentResponse> {
    const url = Constant.OsuCollectorTournamentApiUrl + id.toString();

    const res = await request(url, {
      method: "GET",
      headers: { "User-Agent": `osu-collector-dl/v${LIB_VERSION}` },
      dispatcher: getDispatcher(),
    }).catch(() => null);

    if (!res || res.statusCode !== 200) {
      throw new OcdlError(
        "REQUEST_DATA_FAILED",
        `Status code: ${res?.statusCode ?? "Unknown"}`
      );
    }

    const data = (await res.body.json().catch(() => null)) as Json | null;
    if (!data) {
      throw new OcdlError("REQUEST_DATA_FAILED", "Empty tournament response");
    }

    return data as unknown as TournamentResponse;
  }
}
