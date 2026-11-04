# Open File on Double-Click

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin:
double-click a local file link or a web link in a chat message and it opens with
the operating system's default application — the same gesture as double-clicking
a desktop shortcut. A single click keeps the shipped behavior and opens the
target in the right Sidebar (file preview or browser tab).

```
single click  →  Sidebar (file preview / browser tab), unchanged
double click  →  default application: the file association, or the default browser
```

The first click is held for 350 ms so the Sidebar never moves the chat layout
between the two clicks — the second click cannot miss.

Русское описание — [ниже](#русский).

## Install

### From a Git address

1. Open **Plugins** in the DSH sidebar and choose **Add plugin**.
2. Paste the repository address:

   ```
   https://github.com/Hello-world-pro/DSH-open-file-on-double-click
   ```

   The short form `github:Hello-world-pro/DSH-open-file-on-double-click` also works.
3. Press **Install** and enable the plugin when DSH offers it.
4. Reload the page (Ctrl+F5). If the plugin list asks for a restart, restart
   the application once.

### From a local folder

1. Download or clone this repository to a permanent location.
2. **Plugins → Add plugin** → paste the absolute path to the folder →
   **Install**.
3. Reload the page; restart the application if DSH asks for it.

### Manually

```bash
# Windows (junction)
mklink /J "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-open-file-on-double-click" "C:\path\to\dsh-open-file-on-double-click"

# macOS / Linux
ln -s /path/to/dsh-open-file-on-double-click ~/.dsh/profiles/desktop/node_modules/dsh-open-file-on-double-click
```

Then add the dependency to the profile's `package.json`:

```json
"dependencies": {
  "dsh-open-file-on-double-click": "link:C:/path/to/dsh-open-file-on-double-click"
}
```

and add the bundle to `dsh.profile.bundles`:

```json
"bundles": [
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "dsh-open-file-on-double-click"
]
```

Restart DSH. The package's own `cordis.patch.yml` inserts the plugin row, so no
manual edit of the profile patch is needed.

## How it works

The browser half listens for clicks in the capture phase. When the click lands
on a file link (the `fileLink` / `fileMention` button rendered by the Markdown
renderer) or on an `http(s)` anchor, the plugin:

1. Holds the click for 350 ms — the double-click window. The Sidebar is not
   touched yet, so the chat does not reflow between the two clicks.
2. On a second click on the same target:
   - a file link resolves its path against the main Session's working directory
     and calls `remote.session.openWorkspacePath({ path })`; the Host verifies
     the path through the composed filesystem and launches the OS default
     opener;
   - a web link calls `window.open(url, "_blank", "noopener,noreferrer")`. The
     DSH Electron shell intercepts that call and hands `http(s)` URLs to
     `shell.openExternal`, which is the default browser; in a plain browser the
     call opens a new tab.
3. If no second click arrives, or if the native open fails, it replays the
   click, so the built-in Sidebar behavior still opens the target.

A relative file link such as `README.md` resolves against the Session `cwd`, an
absolute link such as `D:\data\report.xlsx` is passed through unchanged. Windows
drive paths, POSIX paths and UNC paths are recognized. Links in the composer,
`mailto:` links and fragment-only anchors are never touched.

## Requirements

- DeepSeek Harness `0.2.1-rc.x` (desktop build; checked against `0.2.1-rc.5`).
- Web links work in every Web GUI. File links additionally need a Host that can
  open paths natively (`session.canOpenWorkspacePath`); on a headless Web host
  file links keep their normal Sidebar behavior.
- No build step: `client.js` is already a ready browser bundle.

## Limitations

- A file link must point at an existing file. Missing paths are rejected by the
  Host and fall back to the preview.
- Relative file links resolve against the **main** Session working directory,
  which is what the chat view shows. A link in a second panel with a different
  workspace may resolve differently.
- Files open with the OS association; choosing a specific editor is out of scope
  (use the Sidebar preview's own "Open in…" controls for that).
- A line suffix in the link (`README.md#L10`) opens the file, not the line.
- Web links always open in the default browser; a site that wants a specific
  profile or container cannot be targeted.

## Development

```
dsh-open-file-on-double-click/
├── package.json             manifest: dsh.bundle.patch + dsh.client
├── cordis.patch.yml         one plugin row inserted into the profile
├── index.js                 host half: empty on purpose
├── client.js                browser half: click capture and native open
├── scripts/test-client.cjs  headless check of the click logic
├── icon.svg
└── README.md
```

Run the headless check with any Node.js 20+:

```bash
node scripts/test-client.cjs
```

After editing `client.js`, reload the DSH page with **Ctrl+F5**; a restart is
only needed when `package.json` or `index.js` changes.

## License

[MIT](LICENSE). DeepSeek Harness is distributed under its own license; this
package contains only the plugin code.

---

## Русский

Плагин для [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness):
двойной клик по ссылке на локальный файл или по веб-ссылке в сообщении
открывает её приложением по умолчанию — как двойной клик по ярлыку на рабочем
столе. Одиночный клик оставляет прежнее поведение: цель открывается в правой
панели (предпросмотр файла или вкладка браузера).

```
одиночный клик  →  боковая панель (предпросмотр / вкладка браузера)
двойной клик    →  приложение по умолчанию (ассоциация файла или браузер)
```

Первый клик держится 350 мс, поэтому панель не сдвигает текст чата между
кликами, и второй клик не промахивается.

### Установка

1. В сайдбаре DSH откройте **Plugins → Add plugin**.
2. Вставьте адрес репозитория:

   ```
   https://github.com/Hello-world-pro/DSH-open-file-on-double-click
   ```

3. Нажмите **Install** и включите плагин, когда DSH предложит.
4. Обновите страницу (**Ctrl+F5**). Если DSH попросит перезапуск — перезапустите
   приложение один раз.

Локальная папка устанавливается так же: **Add plugin** → абсолютный путь к
папке → **Install**.

### Как это работает

Клиентская половина перехватывает клики в фазе перехвата. Если клик попал на
кнопку локальной ссылки (`fileLink` / `fileMention`) или на `http(s)`-ссылку,
плагин держит его 350 мс — окно двойного клика. Панель в этот момент не
трогается, поэтому текст чата не переезжает.

Второй клик по той же цели:

- для файла резолвит путь относительно рабочей папки главной сессии и вызывает
  `remote.session.openWorkspacePath` — хост проверяет путь и запускает
  приложение по умолчанию;
- для сайта вызывает `window.open(url, "_blank", "noopener,noreferrer")`.
  Electron-оболочка DSH перехватывает этот вызов и отдаёт `http(s)`-адрес в
  `shell.openExternal`, то есть в браузер по умолчанию; в обычном браузере
  откроется новая вкладка.

Если второго клика не было или открытие не удалось, плагин воспроизводит
клик — прежнее поведение боковой панели продолжает работать.

Относительный путь (`README.md`) резолвится от `cwd` сессии, абсолютный
(`D:\data\report.xlsx`) передаётся как есть. Ссылки в поле ввода, `mailto:` и
якоря не затрагиваются.

### Ограничения

- Файл должен существовать; иначе хост отклонит открытие, и сработает
  предпросмотр.
- Относительные ссылки считаются от рабочей папки **главной** сессии.
- Для файлов нужен хост с доступом к рабочему столу; на headless-хосте ссылки
  на файлы работают как раньше. Веб-ссылки работают всегда.
- Суффикс строки (`README.md#L10`) открывает файл, но не переходит к строке.
- Веб-ссылка всегда открывается в браузере по умолчанию; выбрать конкретный
  профиль или контейнер нельзя.

### Разработка

```bash
node scripts/test-client.cjs
```

После правок `client.js` обновите страницу DSH через **Ctrl+F5**.

### Лицензия

[MIT](LICENSE).

