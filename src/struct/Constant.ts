export enum Constant {
  OsuCollectorApiUrl = "https://osucollector.com/api/collections/",
  OsuCollectorTournamentApiUrl = "https://osucollector.com/api/tournaments/",
  GithubReleaseUrl = "https://github.com/roogue/osu-collector-dl/releases/tag/",
  GithubReleaseApiUrl = "https://api.github.com/repos/roogue/osu-collector-dl/releases",
}

export enum Mirror {
  Catboy = "catboy",
  Nerinyan = "nerinyan",
  OsuDirect = "osu.direct",
  Sayobot = "sayobot",
  Beatconnect = "beatconnect",
  Nekoha = "nekoha",
}

export enum CatboyServer {
  Default = "default",
  Central = "central",
  US = "us",
  Asia = "sg",
}

export const CatboyServerBaseUrls: Record<CatboyServer, string> = {
  [CatboyServer.Default]: "https://catboy.best",
  [CatboyServer.Central]: "https://central.catboy.best",
  [CatboyServer.US]: "https://us.catboy.best",
  [CatboyServer.Asia]: "https://sg.catboy.best",
};

export const MirrorUrls: Record<Mirror, string> = {
  [Mirror.Catboy]: "https://catboy.best/d/",
  [Mirror.Nerinyan]: "https://api.nerinyan.moe/d/",
  [Mirror.OsuDirect]: "https://osu.direct/api/d/",
  [Mirror.Sayobot]: "https://dl.sayobot.cn/beatmaps/download/novideo/",
  [Mirror.Beatconnect]: "https://beatconnect.io/b/",
  [Mirror.Nekoha]: "https://mirror.nekoha.moe/api4/download/",
};

export function getCatboyRateLimitUrl(server: CatboyServer): string {
  return CatboyServerBaseUrls[server] + "/api/ratelimits";
}

export function getCatboyDownloadUrl(server: CatboyServer): string {
  return CatboyServerBaseUrls[server] + "/d/";
}

export function getFallbackMirrors(current: Mirror): Mirror[] {
  return Object.values(Mirror).filter((m) => m !== current);
}
