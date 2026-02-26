export type Language = "en" | "ru";

// Enum with string values representing different messages
export enum Msg {
  FREEZE = "Please press 'Enter' to {{action}}.",
  HEADER = "Collection: {{id}} - {{name}} | Working Mode: {{mode}}\n",

  CHECK_CONNECTION_TO_SERVER = "Connecting to server...",
  NO_CONNECTION = "Unable to connect to osu-collector's server, the server may be down, or you are not connected to internet.",

  CHECK_NEW_VERSION = "Checking for new version...",
  NEW_VERSION = "New version ({{version}}) is available! Download the latest version: \n{{url}}\n",

  CHECK_RATE_LIMIT = "Checking for rate limitation...",
  UNABLE_TO_GET_DAILY_RATE_LIMIT = "Warning: Unable to get daily rate limit, proceeding may cause incomplete downloads.",
  DAILY_RATE_LIMIT_HIT = "Your daily download rate limit hit!",
  DAILY_RATE_LIMIT_HIT_WARN = "Warning: Your daily download rate limit hit! Continue to generate .osdb only.",
  TO_DOWNLOADS_EXCEED_DAILY_RATE_LIMIT = "Warning: The collection size exceeds the remaining downloads limit ({{collection}} > {{limit}}), proceeding may cause incomplete downloads.",
  REMAINING_DOWNLOADS = "Remaining Downloads Available: {{amount}}",

  REQUEST_BLOCKED = "The download request is blocked. Please do not proceed with the download function to avoid potential ban.",

  RESOURCE_UNAVAILBALE = "The download request is blocked in your location for legal reasons, unable to download collection.",

  INPUT_ID = "Enter the collection ID you want to download:",
  INPUT_ID_ERR = "ID should be a number, Ex: '44' (without the quote)",

  INPUT_MODE_DESCRIPTION = "1: Download Beatmap Set only\n2: Download Beatmap Set + Generate .osdb\n3: Generate .osdb only\n4: Download to Songs + Add to collection.db\n5: Add to collection.db only (instant)\n",
  INPUT_MODE = "Please select a working mode. (Default: {{mode}}):",
  INPUT_MODE_ERR = "Invalid mode, please type '1', '2', '3', '4' or '5' (without the quote)",

  FETCH_BRIEF_INFO = "Fetching brief info for collection {{id}}...",

  FETCH_DATA = "Fetched [ {{amount}}/{{total}} ] of beatmaps' data...",

  CREATING_FOLDER = "Creating folder {{name}}...",

  PREVIOUS_DOWNLOAD_FOUND = "There are unfinished downloads from a previous session.\n\n1: Resume those downloads\n2: Discard them and start fresh\n",
  INPUT_CONTINUE_DOWNLOAD = "Please select an option to continue. (Default: 1):",
  INPUT_CONTINUE_DOWNLOAD_ERR = "Invalid mode, please type '1' or '2' (without the quote)",

  GENERATE_OSDB = "Generating {{name}}.osdb file...",
  GENERATED_OSDB = "Generated {{name}}.osdb file successfully.",

  DOWNLOAD_FILES = "Downloaded [ {{amount}}/{{total}} ] beatmap sets...",
  DOWNLOAD_LOG = "{{log}}",
  DOWNLOADING_FILE = "Downloading [{{id}}] {{name}}",
  RETRYING_DOWNLOAD = "Retrying [{{id}}] {{name}}",
  DOWNLOADED_FILE = "Downloaded [{{id}}] {{name}}",
  SKIPPED_FILE = "Skipped [{{id}}] {{name}} (already exists)",
  DOWNLOAD_FILE_FAILED = "Failed when downloading [{{id}}] {{name}}, due to error: {{error}}",
  RATE_LIMITED = "Download request rate is limited, cooling down for one minute...",
  MIRROR_SWITCHED_DUE_TO_RATE_LIMIT = "Rate limit reached. Switching mirror to {{mirror}}...",
  DOWNLOAD_COMPLETED = "Download completed.",

  PROCESS_ERRORED = "An error occurred: {{error}}",

  // osu! running check
  CHECK_OSU_RUNNING = "Checking if osu! is running...",
  OSU_IS_RUNNING_WAIT = "osu! is currently running. Please close it to continue.",
  OSU_IS_RUNNING_PROMPT = "Press Enter to retry...",
  OSU_STILL_RUNNING = "osu! is still running. Please close it first.",

  // Collection.db
  READING_COLLECTION_DB = "Reading collection.db...",
  ADDING_TO_COLLECTION_DB = "Adding collection to collection.db...",
  COLLECTION_DB_UPDATED = "Successfully added {{count}} beatmaps to collection '{{name}}' in collection.db!",
  COLLECTION_DB_BACKUP_CREATED = "Backup created: {{path}}",

  // Collection conflict (modes 4/5)
  COLLECTION_CONFLICT = "Collection '{{name}}' already exists with {{count}} beatmaps.\n1: Merge (add new beatmaps)\n2: Replace (overwrite completely)\n3: Rename (create '{{name}}_2')\n4: Cancel\n",
  COLLECTION_CONFLICT_INPUT = "Choose action (1-4):",

  // Navigation / Input hints
  INPUT_ID_COMMANDS = "'s' = settings, 'f' = fix hashes, 'b' = backup maps",
  INPUT_ID_HINT = "Enter collection ID:",
  GO_BACK_HINT = "(Press Enter without input to go back)",
  GOING_BACK = "Going back...",

  // Setup Wizard
  SETUP_WELCOME = "Welcome to osu-collector-dl! Let's set up your preferences.\n",
  SETUP_TYPE = "Select setup type:\n1: Standard (Recommended)\n2: Advanced\n",
  SETUP_TYPE_INPUT = "Choose (1-2):",
  SETUP_OSU_PATH = "Enter the path to your osu! game folder (e.g., C:\\osu!):",
  SETUP_OSU_PATH_INVALID = "Invalid osu! folder. Must contain Songs folder and osu!.db file.",
  SETUP_DIRECTORY = "Enter the download directory (for modes 1-3):",
  SETUP_DIRECTORY_INVALID = "Invalid path. Please enter a valid directory path.",
  SETUP_MIRROR = "Select download mirror:\n1: catboy.best (Recommended)\n2: nerinyan.moe\n3: osu.direct\n4: sayobot.cn\n5: beatconnect.io\n6: nekoha.moe\n",
  SETUP_MIRROR_INPUT = "Choose mirror (1-6):",
  SETUP_CATBOY_SERVER = "Select Catboy server:\n1: Default (catboy.best)\n2: Central (Falkenstein)\n3: US\n4: Asia (Singapore)\n",
  SETUP_CATBOY_SERVER_INPUT = "Choose server (1-4):",
  SETUP_MODE = "Select default working mode:\n1: Download only\n2: Download + Generate .osdb\n3: Generate .osdb only\n4: Download to Songs + Add to collection.db\n5: Add to collection.db only (instant)\n",
  SETUP_MODE_INPUT = "Choose mode (1-5):",
  SETUP_COMPLETE = "Setup complete! Your settings have been saved.\n",

  // Settings Menu
  SETTINGS_HEADER = "=== Settings === (Enter = Back)\n",
  SETTINGS_CURRENT = "Current settings:\n1: Mirror: {{mirror}}\n2: Download mode: {{mode}}\n3: Concurrency: {{concurrency}}\n4: Parallel downloads: {{parallel}}\n5: Skip existing maps: {{skipExisting}}\n6: osu! folder: {{osuPath}}\n7: Download directory (modes 1-3): {{directory}}\n8: VLESS Proxies: {{proxyVless}}\n{{vlessLimits}}",
  SETTINGS_SELECT = "Select option to change (1-8):",
  SETTINGS_PROXY = "Enter proxy URL (e.g. http://127.0.0.1:10809) or leave empty to disable:",
  SETTINGS_PROXY_SAVED = "Proxy set: {{proxy}}",
  SETTINGS_PROXY_DISABLED = "Proxy disabled.",
  SETTINGS_SKIP_EXISTING = "Skip downloading maps that already exist in Songs? (y/n):",
  SETTINGS_SAVED = "Settings saved!",
  SETTINGS_PARALLEL = "Enable parallel downloads? (y/n):",
  SETTINGS_CONCURRENCY = "Enter concurrency (1-10):",

  // Fix command
  FIX_START = "Download missing beatmaps from collection\n",
  FIX_INPUT_COLLECTION_ID = "Enter collection ID from osucollector.com:",
  FIX_READING_OSU_DB = "Reading osu!.db...",
  FIX_OSU_DB_COMPLETE = "Found {{count}} beatmaps in osu!.db",
  FIX_MISSING_COUNT = "Missing: {{missing}}/{{total}} beatmapsets need to be downloaded",
  FIX_ALL_DOWNLOADED = "All beatmaps are downloaded. Fixed {{fixed}}/{{total}} hashes in collection '{{name}}'.",
  FIX_HASHES_FIXING = "Fixing hashes in collection.db...",
  FIX_HASHES_COMPLETE = "Fixed {{fixed}}/{{total}} hashes in collection '{{name}}'.",
  FIX_CONFIRM_DOWNLOAD = "Download missing beatmaps? (y/n):",
  FIX_DOWNLOAD_COMPLETE = "Downloaded {{downloaded}}/{{total}} beatmapsets. Collection '{{name}}' updated in collection.db!",
  FIX_COLLECTION_STATS = "  {{name}}: {{fixed}}/{{total}} hashes fixed",

  // Backup command
  BACKUP_DESCRIPTION = "Backup all local beatmaps to collection.db\n\nThis will:\n  1. Read ALL beatmap hashes from your osu!.db\n  2. Add them to a 'backup maps' collection in collection.db\n  3. You can then upload this collection to osucollector.com\n     and download it on another PC using the collection ID\n\nNote: osu! must be closed during this operation.\n",
  BACKUP_CONFIRM = "Proceed with backup? (y/n):",
  BACKUP_READING_OSU_DB = "Reading all beatmaps from osu!.db...",
  BACKUP_FOUND_MAPS = "Found {{count}} beatmaps in osu!.db.",
  BACKUP_NO_MAPS = "No beatmaps found in osu!.db. Nothing to back up.",
  BACKUP_WRITING = "Writing 'backup maps' collection to collection.db...",
  BACKUP_COMPLETE = "Successfully backed up {{count}} beatmaps to collection '{{name}}' in collection.db!",
  BACKUP_CANCELLED = "Backup cancelled.",

  // Language selection
  SELECT_LANGUAGE_PROMPT = "Select language / Выберите язык:\n1: English\n2: Русский\n(Default: 1)\n",
  SELECT_LANGUAGE_INVALID = "Invalid language, please type '1' or '2'.",

  // Main menu: collection vs tournament
  SELECT_MAIN_ACTION = "Select an action:\n1: Download collection by ID\n2: Download maps from tournament by ID\n3: Settings\n4: Fix hashes + download missing\n5: Backup maps to collection.db\n",
  SELECT_MAIN_ACTION_INVALID = "Invalid option, please type '1'-'5'.",

  // Tournament input and selection
  INPUT_TOURNAMENT_ID = "Enter the tournament ID you want to download:",
  INPUT_TOURNAMENT_ID_ERR = "ID should be a number, Ex: '1641' (without the quote)",

  TOURNAMENT_ROUND_LIST = "Tournament rounds:\n{{list}}\n",
  INPUT_TOURNAMENT_ROUND = "Enter round number to download or 0 to download all rounds. (Default: 0):",
  INPUT_TOURNAMENT_ROUND_ERR = "Invalid round number. Please type a number between 0 and {{max}}.",

  // VLESS Proxy
  PROXY_STARTING = "Starting VLESS proxies...",
  PROXY_STARTED = "Started {{count}} VLESS proxies.",
  PROXY_XRAY_NOT_FOUND = "xray-core not found. Place xray.exe (or xray) in the application folder.\nDownload: https://github.com/XTLS/Xray-core/releases\n",
  PROXY_NO_CONFIGS = "No VLESS servers configured.\n",
  PROXY_LIST_HEADER = "=== VLESS Proxies ===\n{{list}}\n",
  PROXY_SELECT = "Select proxy (0 = direct, 1-{{max}} = proxy):",
  PROXY_SWITCHED = "Active proxy: {{name}}",
  PROXY_CHECKING = "Checking rate limits...",
  PROXY_TOTAL_LIMIT = "Total downloads across all VLESS: {{total}} ({{count}} proxies checked)",

  // VLESS Management
  VLESS_MENU_HEADER = "=== VLESS Proxy Management ===\n",
  VLESS_MENU_OPTIONS = "1: Select active proxy\n2: Add server\n3: Remove server\n",
  VLESS_MENU_SELECT = "Choose option (1-3, Enter = back):",
  VLESS_ADD_PROMPT = "Paste VLESS link (vless://...):",
  VLESS_ADD_SUCCESS = "Server '{{name}}' added! Restarting proxies...",
  VLESS_ADD_INVALID = "Invalid VLESS link. Must start with vless://",
  VLESS_REMOVE_PROMPT = "Enter server number to remove (1-{{max}}):",
  VLESS_REMOVE_SUCCESS = "Server '{{name}}' removed! Restarting proxies...",
  VLESS_REMOVE_INVALID = "Invalid server number.",
  VLESS_EMPTY = "No VLESS servers configured. Use option 2 to add one.",
  VLESS_RELOADED = "Proxies reloaded. {{count}} running.",
}

const RU_MESSAGES: Record<Msg, string> = {
  [Msg.FREEZE]: "Нажмите 'Enter', чтобы {{action}}.",
  [Msg.HEADER]:
    "Коллекция: {{id}} - {{name}} | Режим работы: {{mode}}\n",

  [Msg.CHECK_CONNECTION_TO_SERVER]: "Проверка соединения с сервером...",
  [Msg.NO_CONNECTION]:
    "Не удалось подключиться к серверу osu-collector. Сервер может быть недоступен или отсутствует подключение к интернету.",

  [Msg.CHECK_NEW_VERSION]: "Проверка наличия новой версии...",
  [Msg.NEW_VERSION]:
    "Доступна новая версия ({{version}})! Скачайте последнюю версию:\n{{url}}\n",

  [Msg.CHECK_RATE_LIMIT]: "Проверка ограничения на загрузку...",
  [Msg.UNABLE_TO_GET_DAILY_RATE_LIMIT]:
    "Предупреждение: не удалось получить дневной лимит загрузок, продолжение может привести к неполному скачиванию.",
  [Msg.DAILY_RATE_LIMIT_HIT]:
    "Вы достигли дневного лимита загрузок!",
  [Msg.DAILY_RATE_LIMIT_HIT_WARN]:
    "Предупреждение: вы достигли дневного лимита загрузок! Продолжение возможно только для генерации .osdb.",
  [Msg.TO_DOWNLOADS_EXCEED_DAILY_RATE_LIMIT]:
    "Предупреждение: размер коллекции превышает оставшийся лимит загрузок ({{collection}} > {{limit}}), продолжение может привести к неполному скачиванию.",
  [Msg.REMAINING_DOWNLOADS]:
    "Оставшиеся доступные загрузки: {{amount}}",

  [Msg.REQUEST_BLOCKED]:
    "Запрос на скачивание заблокирован. Пожалуйста, не продолжайте загрузку, чтобы избежать возможного бана.",

  [Msg.RESOURCE_UNAVAILBALE]:
    "Запрос на скачивание заблокирован в вашем регионе по юридическим причинам, невозможно скачать коллекцию.",

  [Msg.INPUT_ID]:
    "Введите ID коллекции, которую хотите скачать:",
  [Msg.INPUT_ID_ERR]:
    "ID должен быть числом, пример: '44' (без кавычек)",

  [Msg.INPUT_MODE_DESCRIPTION]:
    "1: Скачивать только Beatmap Set\n2: Скачивать Beatmap Set + генерировать .osdb\n3: Генерировать только .osdb\n4: Скачать в Songs + добавить в collection.db\n5: Только добавить в collection.db (мгновенно)\n",
  [Msg.INPUT_MODE]:
    "Выберите режим работы. (По умолчанию: {{mode}}):",
  [Msg.INPUT_MODE_ERR]:
    "Неверный режим, введите '1', '2', '3', '4' или '5' (без кавычек)",

  [Msg.FETCH_BRIEF_INFO]:
    "Получение краткой информации о коллекции {{id}}...",

  [Msg.FETCH_DATA]:
    "Получено данных [ {{amount}}/{{total}} ] карт...",

  [Msg.CREATING_FOLDER]:
    "Создание папки {{name}}...",

  [Msg.PREVIOUS_DOWNLOAD_FOUND]:
    "Найдены незавершённые загрузки из предыдущей сессии.\n\n1: Продолжить эти загрузки\n2: Удалить их и начать заново\n",
  [Msg.INPUT_CONTINUE_DOWNLOAD]:
    "Выберите вариант продолжения. (По умолчанию: 1):",
  [Msg.INPUT_CONTINUE_DOWNLOAD_ERR]:
    "Неверный вариант, введите '1' или '2' (без кавычек)",

  [Msg.GENERATE_OSDB]:
    "Генерация файла {{name}}.osdb...",
  [Msg.GENERATED_OSDB]:
    "Файл {{name}}.osdb успешно сгенерирован.",

  [Msg.DOWNLOAD_FILES]:
    "Скачано Beatmap Set [ {{amount}}/{{total}} ]...",
  [Msg.DOWNLOAD_LOG]: "{{log}}",
  [Msg.DOWNLOADING_FILE]:
    "Скачивание [{{id}}] {{name}}",
  [Msg.RETRYING_DOWNLOAD]:
    "Повторная попытка [{{id}}] {{name}}",
  [Msg.DOWNLOADED_FILE]:
    "Скачано [{{id}}] {{name}}",
  [Msg.DOWNLOAD_FILE_FAILED]:
    "Ошибка при скачивании [{{id}}] {{name}}, причина: {{error}}",
  [Msg.SKIPPED_FILE]:
    "Пропущено [{{id}}] {{name}} (уже существует)",
  [Msg.RATE_LIMITED]:
    "Скорость запросов на скачивание ограничена, ожидание одну минуту...",
  [Msg.MIRROR_SWITCHED_DUE_TO_RATE_LIMIT]:
    "Лимит запросов исчерпан. Переключение зеркала на {{mirror}}...",
  [Msg.DOWNLOAD_COMPLETED]: "Загрузка завершена.",

  [Msg.PROCESS_ERRORED]: "Произошла ошибка: {{error}}",

  [Msg.CHECK_OSU_RUNNING]: "Проверка, запущен ли osu!...",
  [Msg.OSU_IS_RUNNING_WAIT]:
    "osu! запущен. Пожалуйста, закройте его, чтобы продолжить.",
  [Msg.OSU_IS_RUNNING_PROMPT]: "Нажмите Enter для повторной попытки...",
  [Msg.OSU_STILL_RUNNING]: "osu! всё ещё запущен. Сначала закройте его.",

  [Msg.READING_COLLECTION_DB]: "Чтение collection.db...",
  [Msg.ADDING_TO_COLLECTION_DB]: "Добавление коллекции в collection.db...",
  [Msg.COLLECTION_DB_UPDATED]:
    "Успешно добавлено {{count}} карт в коллекцию '{{name}}' в collection.db!",
  [Msg.COLLECTION_DB_BACKUP_CREATED]: "Резервная копия создана: {{path}}",

  [Msg.COLLECTION_CONFLICT]:
    "Коллекция '{{name}}' уже существует с {{count}} картами.\n1: Объединить (добавить новые карты)\n2: Заменить (полностью перезаписать)\n3: Переименовать (создать '{{name}}_2')\n4: Отмена\n",
  [Msg.COLLECTION_CONFLICT_INPUT]: "Выберите действие (1-4):",

  [Msg.INPUT_ID_COMMANDS]:
    "'s' = настройки, 'f' = исправить хеши, 'b' = бэкап карт",
  [Msg.INPUT_ID_HINT]: "Введите ID коллекции:",
  [Msg.GO_BACK_HINT]: "(Нажмите Enter без ввода для возврата)",
  [Msg.GOING_BACK]: "Возврат...",

  [Msg.SETUP_WELCOME]:
    "Добро пожаловать в osu-collector-dl! Давайте настроим параметры.\n",
  [Msg.SETUP_TYPE]:
    "Выберите тип настройки:\n1: Стандартная (Рекомендуется)\n2: Расширенная\n",
  [Msg.SETUP_TYPE_INPUT]: "Выберите (1-2):",
  [Msg.SETUP_OSU_PATH]:
    "Введите путь к папке с игрой osu! (например, C:\\osu!):",
  [Msg.SETUP_OSU_PATH_INVALID]:
    "Неверная папка osu!. Должна содержать папку Songs и файл osu!.db.",
  [Msg.SETUP_DIRECTORY]: "Введите папку для загрузки (для режимов 1-3):",
  [Msg.SETUP_DIRECTORY_INVALID]:
    "Неверный путь. Пожалуйста, введите существующую папку.",
  [Msg.SETUP_MIRROR]:
    "Выберите зеркало для загрузки:\n1: catboy.best (Рекомендуется)\n2: nerinyan.moe\n3: osu.direct\n4: sayobot.cn\n5: beatconnect.io\n6: nekoha.moe\n",
  [Msg.SETUP_MIRROR_INPUT]: "Выберите зеркало (1-6):",
  [Msg.SETUP_CATBOY_SERVER]:
    "Выберите сервер Catboy:\n1: По умолчанию (catboy.best)\n2: Центральный (Фалькенштайн)\n3: США\n4: Азия (Сингапур)\n",
  [Msg.SETUP_CATBOY_SERVER_INPUT]: "Выберите сервер (1-4):",
  [Msg.SETUP_MODE]:
    "Выберите режим работы по умолчанию:\n1: Только скачать\n2: Скачать + генерировать .osdb\n3: Только генерировать .osdb\n4: Скачать в Songs + добавить в collection.db\n5: Только добавить в collection.db (мгновенно)\n",
  [Msg.SETUP_MODE_INPUT]: "Выберите режим (1-5):",
  [Msg.SETUP_COMPLETE]:
    "Настройка завершена! Параметры сохранены.\n",

  [Msg.SETTINGS_HEADER]: "=== Настройки === (Enter = Назад)\n",
  [Msg.SETTINGS_CURRENT]:
    "Текущие настройки:\n1: Зеркало: {{mirror}}\n2: Режим загрузки: {{mode}}\n3: Параллельность: {{concurrency}}\n4: Параллельные загрузки: {{parallel}}\n5: Пропускать существующие: {{skipExisting}}\n6: Папка osu!: {{osuPath}}\n7: Папка загрузки (режимы 1-3): {{directory}}\n8: VLESS Прокси: {{proxyVless}}\n{{vlessLimits}}",
  [Msg.SETTINGS_SELECT]: "Выберите параметр для изменения (1-8):",
  [Msg.SETTINGS_PROXY]:
    "Введите URL прокси (например http://127.0.0.1:10809) или оставьте пустым для отключения:",
  [Msg.SETTINGS_PROXY_SAVED]: "Прокси задан: {{proxy}}",
  [Msg.SETTINGS_PROXY_DISABLED]: "Прокси отключён.",
  [Msg.SETTINGS_SKIP_EXISTING]:
    "Пропускать карты, которые уже есть в Songs? (y/n):",
  [Msg.SETTINGS_SAVED]: "Настройки сохранены!",
  [Msg.SETTINGS_PARALLEL]: "Включить параллельные загрузки? (y/n):",
  [Msg.SETTINGS_CONCURRENCY]: "Введите параллельность (1-10):",

  [Msg.FIX_START]: "Загрузка недостающих карт из коллекции\n",
  [Msg.FIX_INPUT_COLLECTION_ID]:
    "Введите ID коллекции с osucollector.com:",
  [Msg.FIX_READING_OSU_DB]: "Чтение osu!.db...",
  [Msg.FIX_OSU_DB_COMPLETE]: "Найдено {{count}} карт в osu!.db",
  [Msg.FIX_MISSING_COUNT]:
    "Отсутствует: {{missing}}/{{total}} beatmapset нужно загрузить",
  [Msg.FIX_ALL_DOWNLOADED]:
    "Все карты загружены. Исправлено {{fixed}}/{{total}} хешей в коллекции '{{name}}'.",
  [Msg.FIX_HASHES_FIXING]: "Исправление хешей в collection.db...",
  [Msg.FIX_HASHES_COMPLETE]:
    "Исправлено {{fixed}}/{{total}} хешей в коллекции '{{name}}'.",
  [Msg.FIX_CONFIRM_DOWNLOAD]:
    "Загрузить недостающие карты? (y/n):",
  [Msg.FIX_DOWNLOAD_COMPLETE]:
    "Загружено {{downloaded}}/{{total}} beatmapset. Коллекция '{{name}}' обновлена в collection.db!",
  [Msg.FIX_COLLECTION_STATS]:
    "  {{name}}: {{fixed}}/{{total}} хешей исправлено",

  [Msg.BACKUP_DESCRIPTION]:
    "Бэкап всех локальных карт в collection.db\n\nЭто:\n  1. Прочитает ВСЕ хеши карт из вашего osu!.db\n  2. Добавит их в коллекцию 'backup maps' в collection.db\n  3. Вы сможете загрузить эту коллекцию на osucollector.com\n     и скачать её на другом ПК по ID коллекции\n\nПримечание: osu! должен быть закрыт во время этой операции.\n",
  [Msg.BACKUP_CONFIRM]: "Продолжить бэкап? (y/n):",
  [Msg.BACKUP_READING_OSU_DB]:
    "Чтение всех карт из osu!.db...",
  [Msg.BACKUP_FOUND_MAPS]: "Найдено {{count}} карт в osu!.db.",
  [Msg.BACKUP_NO_MAPS]:
    "Карты не найдены в osu!.db. Нечего сохранять в бэкап.",
  [Msg.BACKUP_WRITING]:
    "Запись коллекции 'backup maps' в collection.db...",
  [Msg.BACKUP_COMPLETE]:
    "Успешно сохранено {{count}} карт в коллекцию '{{name}}' в collection.db!",
  [Msg.BACKUP_CANCELLED]: "Бэкап отменён.",

  [Msg.SELECT_LANGUAGE_PROMPT]:
    "Выберите язык / Select language:\n1: English\n2: Русский\n(По умолчанию: 1)\n",
  [Msg.SELECT_LANGUAGE_INVALID]:
    "Неверный выбор языка, введите '1' или '2'.",

  [Msg.SELECT_MAIN_ACTION]:
    "Выберите действие:\n1: Скачать коллекцию карт по ID\n2: Скачать карты с турнира по ID\n3: Настройки\n4: Исправить хеши + скачать недостающие\n5: Бэкап карт в collection.db\n",
  [Msg.SELECT_MAIN_ACTION_INVALID]:
    "Неверный выбор, введите '1'-'5'.",

  [Msg.INPUT_TOURNAMENT_ID]:
    "Введите ID турнира, который хотите скачать:",
  [Msg.INPUT_TOURNAMENT_ID_ERR]:
    "ID должен быть числом, пример: '1641' (без кавычек)",

  [Msg.TOURNAMENT_ROUND_LIST]:
    "Этапы турнира:\n{{list}}\n",
  [Msg.INPUT_TOURNAMENT_ROUND]:
    "Введите номер этапа для скачивания или 0, чтобы скачать все этапы. (По умолчанию: 0):",
  [Msg.INPUT_TOURNAMENT_ROUND_ERR]:
    "Неверный номер этапа. Введите число от 0 до {{max}}.",

  [Msg.PROXY_STARTING]: "Запуск VLESS прокси...",
  [Msg.PROXY_STARTED]: "Запущено {{count}} VLESS прокси.",
  [Msg.PROXY_XRAY_NOT_FOUND]:
    "xray-core не найден. Поместите xray.exe (или xray) в папку приложения.\nСкачать: https://github.com/XTLS/Xray-core/releases\n",
  [Msg.PROXY_NO_CONFIGS]:
    "VLESS серверы не настроены.\n",
  [Msg.PROXY_LIST_HEADER]: "=== VLESS Прокси ===\n{{list}}\n",
  [Msg.PROXY_SELECT]:
    "Выберите прокси (0 = прямое соединение, 1-{{max}} = прокси):",
  [Msg.PROXY_SWITCHED]: "Активный прокси: {{name}}",
  [Msg.PROXY_CHECKING]: "Проверка лимитов...",
  [Msg.PROXY_TOTAL_LIMIT]: "Суммарный лимит по всем VLESS: {{total}} (проверено {{count}} прокси)",

  [Msg.VLESS_MENU_HEADER]: "=== Управление VLESS прокси ===\n",
  [Msg.VLESS_MENU_OPTIONS]: "1: Выбрать активный прокси\n2: Добавить сервер\n3: Удалить сервер\n",
  [Msg.VLESS_MENU_SELECT]: "Выберите действие (1-3, Enter = назад):",
  [Msg.VLESS_ADD_PROMPT]: "Вставьте VLESS ссылку (vless://...):",
  [Msg.VLESS_ADD_SUCCESS]: "Сервер '{{name}}' добавлен! Перезапуск прокси...",
  [Msg.VLESS_ADD_INVALID]: "Неверная VLESS ссылка. Должна начинаться с vless://",
  [Msg.VLESS_REMOVE_PROMPT]: "Введите номер сервера для удаления (1-{{max}}):",
  [Msg.VLESS_REMOVE_SUCCESS]: "Сервер '{{name}}' удалён! Перезапуск прокси...",
  [Msg.VLESS_REMOVE_INVALID]: "Неверный номер сервера.",
  [Msg.VLESS_EMPTY]: "VLESS серверы не настроены. Используйте пункт 2, чтобы добавить.",
  [Msg.VLESS_RELOADED]: "Прокси перезагружены. {{count}} запущено.",
};

export class Message {
  static language: Language = "en";
  // Message object that will be constructed with a Msg enum value
  // and an optional object with variables to be replaced in the message string
  private message: Msg;
  private variable: Record<string, string>;

  // Constructor to create a new Message object
  constructor(message: Msg, variable: Record<string, string> = {}) {
    // Assign the provided message and variable to the class properties
    this.message = message;
    this.variable = variable;
  }

  // Method to convert the message to a string with variables replaced
  toString(): string {
    // Base template according to current language
    let msg: string = this.message;
    if (Message.language === "ru") {
      msg = RU_MESSAGES[this.message] ?? msg;
    }

    // Replace value if variable is provided
    for (const [key, value] of Object.entries(this.variable)) {
      // iterate over the variables and replace the placeholders in the message string
      const regex = new RegExp(`{{${key}}}`, "g"); // create a regex to match the placeholder
      msg = msg.replace(regex, value); // replace the placeholder with the value
    }
    return msg; // return the modified message string
  }
}
