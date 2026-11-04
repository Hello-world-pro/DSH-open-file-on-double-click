/**
 * Headless check for the browser half.
 *
 * The script loads `client.js` into a minimal DOM stub, drives clicks through
 * the capture handler the plugin installs and asserts the contracts that
 * matter: a single click keeps the Sidebar, a double-click opens the resolved
 * absolute path or the web link natively, and a failed open falls back to the
 * Sidebar.
 */
const fs = require("node:fs");
const path = require("node:path");

let mod = null;
const openedUrls = [];
global.window = {
	open(url, target, features) {
		openedUrls.push({ url, target, features });
		return null;
	},
	__ModuleLoader__: {
		load({ id, factory }) {
			mod = factory(() => {
				throw new Error("no require");
			});
			mod.__id = id;
		},
	},
};

const listeners = new Map();
global.document = {
	addEventListener(type, listener) {
		if (!listeners.has(type)) listeners.set(type, []);
		listeners.get(type).push(listener);
	},
	removeEventListener(type, listener) {
		const list = listeners.get(type) ?? [];
		const index = list.indexOf(listener);
		if (index >= 0) list.splice(index, 1);
	},
};

const clientPath = path.join(__dirname, "..", "client.js");
new Function("window", fs.readFileSync(clientPath, "utf8"))(global.window);

/**
 * Minimal element stub: just enough for the plugin's class, title, href, image
 * and click handling.
 * @param tagName - element tag.
 * @param className - CSS class list.
 * @param title - link path, when the renderer exposes one.
 * @param imageAlt - alt text of a nested preview image, when any.
 * @param href - anchor destination, when any.
 * @returns the stub element.
 */
function makeElement(tagName, className = "", title = null, imageAlt = null, href = null) {
	const image =
		imageAlt === null
			? null
			: {
					getAttribute(name) {
						return name === "alt" ? imageAlt : null;
					},
			  };
	return {
		nodeType: 1,
		tagName,
		className,
		parentElement: null,
		isConnected: true,
		clicks: 0,
		getAttribute(name) {
			if (name === "title") return title;
			if (name === "href") return href;
			return null;
		},
		querySelector() {
			return image;
		},
		click() {
			this.clicks += 1;
		},
	};
}

/**
 * Drive the capture handler as a trusted browser click would.
 * @param target - element the click lands on.
 * @param overrides - event fields to override.
 */
function click(target, overrides = {}) {
	const event = {
		target,
		button: 0,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		altKey: false,
		isTrusted: true,
		prevented: false,
		stopped: false,
		preventDefault() {
			this.prevented = true;
		},
		stopPropagation() {
			this.stopped = true;
		},
		...overrides,
	};
	for (const listener of listeners.get("click") ?? []) listener(event);
	return event;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const opened = [];
let failNext = false;
const ctx = {
	effect(fn) {
		const dispose = fn();
		return typeof dispose === "function" ? dispose : () => {};
	},
	sessions: {
		list: {
			getSnapshot() {
				return {
					byId: {
						"s1": { id: "s1", cwd: "C:\\work\\default-workspace", retainedBy: { mainView: 1 } },
					},
				};
			},
		},
	},
	remote: {
		session: {
			async openWorkspacePath({ path: target }) {
				if (failNext) throw new Error("open rejected");
				opened.push(target);
				return { ok: true, value: { opened: true } };
			},
		},
	},
};

mod.apply(ctx);

const failures = [];
const check = (label, actual, expected) => {
	if (actual !== expected) failures.push(`${label}: ожидалось ${JSON.stringify(expected)}, получено ${JSON.stringify(actual)}`);
};

const link = makeElement("BUTTON", "_fileMention_1ypvv_85 _fileLink_1ypvv_59", "README.md");
const absoluteLink = makeElement("BUTTON", "_fileLink_1ypvv_59", "D:\\data\\report.xlsx");
const webLink = makeElement("A", "", null, null, "https://example.com/docs");
const plain = makeElement("DIV", "chat-body");

const WAIT = 420;

(async () => {
	// 1. Single click: held for the double-click window, then the preview replays.
	click(link);
	check("одиночный клик: сразу без preview", link.clicks, 0);
	await sleep(WAIT);
	check("одиночный клик: preview", link.clicks, 1);
	check("одиночный клик: внешнее открытие не вызвано", opened.length, 0);

	// 2. Double click: native open of the path resolved against the Session cwd.
	link.clicks = 0;
	click(link);
	click(link);
	await sleep(30);
	check("двойной клик: открытие", opened.length, 1);
	check("двойной клик: путь", opened[0], "C:\\work\\default-workspace\\README.md");
	check("двойной клик: preview не открывался", link.clicks, 0);

	// 3. Absolute path is passed through untouched.
	absoluteLink.clicks = 0;
	click(absoluteLink);
	click(absoluteLink);
	await sleep(30);
	check("двойной клик: абсолютный путь", opened[1], "D:\\data\\report.xlsx");
	check("двойной клик: абсолютный путь без preview", absoluteLink.clicks, 0);

	// 4. The Host rejects the path: the shipped preview still opens.
	failNext = true;
	link.clicks = 0;
	click(link);
	click(link);
	await sleep(30);
	check("ошибка открытия: preview", link.clicks, 1);
	check("ошибка открытия: нет новой записи", opened.length, 2);
	failNext = false;

	// 5. A click outside links is ignored.
	plain.clicks = 0;
	click(plain);
	await sleep(WAIT);
	check("клик вне ссылки", plain.clicks, 0);

	// 6. Synthetic clicks never start the hold, so programmatic preview works.
	link.clicks = 0;
	click(link, { isTrusted: false });
	await sleep(WAIT);
	check("синтетический клик не перехвачен", link.clicks, 0);

	// 7. Image links keep the path in the preview image's alt text.
	const imageLink = makeElement("BUTTON", "_fileLink_1ypvv_59", null, "assets\\shot.png");
	click(imageLink);
	click(imageLink);
	await sleep(30);
	check("ссылка-картинка", opened[2], "C:\\work\\default-workspace\\assets\\shot.png");

	// 8. A single click on a web link keeps the Sidebar browser.
	webLink.clicks = 0;
	click(webLink);
	check("сайт: один клик без браузера", openedUrls.length, 0);
	await sleep(WAIT);
	check("сайт: один клик в панель", webLink.clicks, 1);

	// 9. A double click on a web link opens the default browser.
	webLink.clicks = 0;
	click(webLink);
	click(webLink);
	await sleep(30);
	check("сайт: двойной клик", openedUrls.length, 1);
	check("сайт: адрес", openedUrls[0].url, "https://example.com/docs");
	check("сайт: новая вкладка", openedUrls[0].target, "_blank");
	check("сайт: без sidebar", webLink.clicks, 0);

	// 10. Modified clicks are left to the browser.
	webLink.clicks = 0;
	click(webLink, { ctrlKey: true });
	await sleep(WAIT);
	check("ctrl+клик не перехвачен", webLink.clicks, 0);

	console.log(`id: ${mod.__id}`);
	console.log(`inject: ${JSON.stringify(mod.inject)}`);
	console.log(`открыто путей: ${opened.length}`);
	for (const entry of opened) console.log(` - ${entry}`);
	console.log(`открыто сайтов: ${openedUrls.length}`);
	for (const entry of openedUrls) console.log(` - ${entry.url}`);
	if (failures.length > 0) {
		console.error(`\nОШИБКИ:\n${failures.map((f) => ` - ${f}`).join("\n")}`);
		process.exitCode = 1;
	} else {
		console.log("все проверки пройдены");
	}
})();
