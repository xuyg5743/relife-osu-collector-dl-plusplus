# osu-collector-dl++

Enhanced fork of [osu-collector-dl](https://github.com/roogue/osu-collector-dl) with VLESS proxy support, localization, and additional features.

## Features

- **Multi-language support**: English and Russian interface
- **VLESS Proxy Integration**: Built-in support for VLESS proxies with automatic rate limit tracking
- **Tournament Downloads**: Download map pools from osu! tournaments by ID
- **Multiple Download Modes**:
  - Mode 1: Download beatmaps only
  - Mode 2: Download + generate .osdb file
  - Mode 3: Generate .osdb only
  - Mode 4: Download to Songs folder + add to collection.db
  - Mode 5: Add to collection.db only (instant)
- **Collection Management**: Fix hashes and download missing beatmaps
- **Backup Tool**: Backup all local maps to collection.db
- **Clipboard Support**: Paste collection IDs, paths, and VLESS links with Ctrl+V
- **Multiple Mirror Support**: catboy.best, nerinyan.moe, osu.direct, sayobot.cn, beatconnect.io, nekoha.moe

## Installation

### Option 1: Download Pre-built Binary
1. Download `osu-collector-dl.exe` from the [releases](https://github.com/xuyg5743/relife-osu-collector-dl-plusplus/releases) page
2. Run the executable

### Option 2: Build from Source
See [Building](#building) section below.

## Usage

1. Run `osu-collector-dl.exe`
2. Select language on first launch
3. Complete setup wizard (Standard or Advanced)
4. Choose an action:
   - **1**: Download collection by ID
   - **2**: Download tournament maps by ID
   - **3**: Settings (configure proxies, mirrors, paths)
   - **4**: Fix hashes + download missing maps
   - **5**: Backup all local maps to collection.db

### VLESS Proxy Setup

1. Go to Settings (option 3)
2. Select option 8 (VLESS Proxies)
3. Choose "Add server" and paste your VLESS link
4. Select active proxy from the list
5. Rate limits are tracked automatically for each proxy

VLESS links format:
```
vless://uuid@host:port?type=ws&security=tls&path=%2Fpath&sni=host.com&fp=chrome#ServerName
```

## Configuration

Settings are managed through the in-app settings menu (option 3) or by editing `config.json`:

```json
{
  "parallel": true,
  "concurrency": 5,
  "intervalCap": 50,
  "logSize": 15,
  "directory": "",
  "mode": 1,
  "useSubfolder": true,
  "osuPath": "C:\\osu!",
  "mirror": "catboy",
  "catboyServer": "default",
  "skipExisting": true,
  "lang": "en",
  "proxy": "",
  "activeProxyIndex": -1,
  "vlessServers": []
}
```

### Key Settings

- **parallel**: Enable parallel downloads (true/false)
- **concurrency**: Number of simultaneous downloads (1-10)
- **intervalCap**: Max downloads per minute (0-120)
- **mode**: Default working mode (1-5)
- **osuPath**: Path to osu! installation folder
- **mirror**: Download mirror (catboy/nerinyan/osu.direct/sayobot/beatconnect/nekoha)
- **vlessServers**: Array of VLESS proxy links (managed via settings menu)
- **activeProxyIndex**: Currently active proxy (-1 = direct connection)

## Building

### Prerequisites
- Node.js 16+
- Yarn package manager
- xray-core binary (for VLESS support)

### Build Steps

1. **Install dependencies**:
```bash
yarn install
```

2. **Download xray-core** (optional, for VLESS proxy support):
   - Download from [Xray-core releases](https://github.com/XTLS/Xray-core/releases)
   - Create `bin/` folder in project root
   - Place `xray.exe` (Windows) or `xray` (Linux) in `bin/`

3. **Build for Windows**:
```bash
yarn build-app-win
```

4. **Build for Linux**:
```bash
yarn build-app-linux
```

5. **Output**:
   - Windows: `build/win-x64/osu-collector-dl.exe`
   - Linux: `build/linux-arm64/osu-collector-dl`

### Development

Run in development mode:
```bash
yarn start
```

Compile TypeScript only:
```bash
yarn build-ts
```

Lint code:
```bash
yarn lint
```

## FAQ

### How do I use VLESS proxies?

> Go to Settings → VLESS Proxies (option 8). Add your VLESS links one by one, then select which proxy to use. The app automatically tracks rate limits for each proxy. If xray-core is bundled in the .exe, it will be extracted automatically on first run.

### It says "Retrying" during the download process, am I doing anything wrong?

> This is normal. API requests can fail due to rate limiting or connection issues. The app automatically retries failed downloads.

### How do I download tournament map pools?

> Select option 2 from the main menu, enter the tournament ID from osucollector.com, then choose which stage to download (or 0 for all stages).

### Can I paste collection IDs or paths instead of typing?

> Yes! Use Ctrl+V to paste text in any input field (collection IDs, file paths, VLESS links, etc.).

### Can beatmaps be automatically added to my collections?

> Yes! Use Mode 4 (download to Songs + add to collection.db) or Mode 5 (add to collection.db only). The app safely manages your collection.db with automatic backups.

### I've reached my daily download limit. What can I do?

> Add VLESS proxies in Settings (option 8) to bypass rate limits, or use [Collection Manager](https://github.com/Piotrekol/CollectionManager) with the generated .osdb file.

### How do I stop downloads?

> Press Ctrl+C to exit immediately. The app will save a log of missing beatmaps so you can resume later.

### Where can I report bugs?

> Open an issue on the [Issue Page](https://github.com/xuyg5743/relife-osu-collector-dl-plusplus/issues).

## Please support

- [osucollector.com](https://osucollector.com) — the service that makes this possible
- [Collection Manager](https://github.com/Piotrekol/CollectionManager) — great tool for managing osu! collections
- Download mirrors: [catboy.best](https://catboy.best), [nerinyan.moe](https://nerinyan.moe), [osu.direct](https://osu.direct), [sayobot.cn](https://osu.sayobot.cn), [beatconnect.io](https://beatconnect.io), [nekoha.moe](https://nekoha.moe)

## Disclaimer

Not affiliated with osu! or ppy Pty Ltd.

## License

This project is licensed under the MIT License. See the [LICENSE](https://choosealicense.com/licenses/mit/) file for details.
