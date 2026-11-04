window.__ModuleLoader__.load({
	id: "dsh-open-file-on-double-click",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		/**
		 * A single click keeps the shipped behavior: the target opens in the right
		 * Sidebar (a file preview, or a web link in the browser tab). A second click
		 * within this window is a double-click and opens it with the operating
		 * system's default application instead (the file association, or the default
		 * browser for a web link).
		 *
		 * The first click is therefore held for this long before the Sidebar is
		 * touched, so a double-click never moves the chat layout between the two
		 * clicks and the second click never misses.
		 */
		const DOUBLE_CLICK_MS = 350;

		/**
		 * Tell an absolute path from a workspace-relative one.
		 * A Windows drive letter, a POSIX root and a UNC prefix are absolute.
		 * @param path - path as authored in the Markdown link.
		 * @returns whether the path already names one Host location.
		 */
		function isAbsolutePath(path) {
			return path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\");
		}

		/**
		 * Resolve a workspace-relative path against the Session working directory.
		 * @param cwd - Session workspace root, when known.
		 * @param path - absolute or workspace-relative path.
		 * @returns the absolute Host-facing path when a root is available.
		 */
		function resolvePath(cwd, path) {
			if (isAbsolutePath(path)) return path;
			if (cwd === undefined || cwd === "") return path;
			const separator = /^[a-zA-Z]:[\\/]/.test(cwd) && cwd.includes("\\") ? "\\" : "/";
			return cwd.replace(/[/\\]+$/, "") + separator + path.replace(/^[/\\]+/, "");
		}

		/**
		 * Read the path a file link points at.
		 * The renderer stores it in `title`; image links instead keep it in the
		 * preview image's `alt` text.
		 * @param element - file-link button.
		 * @returns the authored path, or null when the element carries none.
		 */
		function pathOf(element) {
			const title = element.getAttribute("title");
			if (title !== null && title !== "") return title;
			const image = element.querySelector("img[alt]");
			if (image !== null) {
				const alt = image.getAttribute("alt");
				if (alt !== null && alt !== "") return alt;
			}
			return null;
		}

		/**
		 * Find the clickable target the event lands on.
		 * Local file links are buttons rendered by the Markdown renderer: Markdown
		 * file links carry the `fileLink` class and inline mentions carry
		 * `fileMention`. Web links are ordinary `http(s)` anchors.
		 * @param target - event target.
		 * @returns the owning target with its kind and value, or null.
		 */
		function findTarget(target) {
			let element = target;
			while (element !== null && element !== undefined) {
				if (element.nodeType === 1) {
					if (element.tagName === "BUTTON") {
						const className = typeof element.className === "string" ? element.className : "";
						if (className.includes("fileLink") || className.includes("fileMention")) {
							const path = pathOf(element);
							if (path !== null) return { kind: "file", element, value: path };
						}
					} else if (element.tagName === "A") {
						const href = element.getAttribute("href");
						if (typeof href === "string" && /^https?:\/\//i.test(href)) return { kind: "url", element, value: href };
					}
				}
				element = element.parentElement;
			}
			return null;
		}

		/**
		 * Read the working directory of the main Session.
		 * The chat view is bound to that Session, and its links resolve against its
		 * workspace root exactly like the Sidebar preview does.
		 * @param ctx - client plugin context.
		 * @returns the Session cwd, or undefined when no main Session is known yet.
		 */
		function currentCwd(ctx) {
			const snapshot = ctx.sessions.list.getSnapshot();
			const rows = snapshot !== null && snapshot !== undefined && snapshot.byId !== undefined ? Object.values(snapshot.byId) : [];
			const main = rows.find((row) => row !== null && row !== undefined && row.retainedBy !== undefined && (row.retainedBy.mainView ?? 0) > 0);
			return main === undefined ? undefined : main.cwd;
		}

		/**
		 * Open one path with the operating system's default application, the same
		 * action a double-click on a desktop shortcut performs.
		 * @param ctx - client plugin context.
		 * @param path - authored path from the link.
		 * @returns whether the Host acknowledged the launch.
		 */
		async function openExternally(ctx, path) {
			const openWorkspacePath = ctx.remote !== undefined && ctx.remote !== null && ctx.remote.session !== undefined ? ctx.remote.session.openWorkspacePath : undefined;
			if (typeof openWorkspacePath !== "function") return false;
			const absolute = resolvePath(currentCwd(ctx), path);
			if (!isAbsolutePath(absolute)) return false;
			try {
				const result = await ctx.remote.session.openWorkspacePath({ path: absolute });
				return result !== null && result !== undefined && result.ok === true;
			} catch {
				return false;
			}
		}

		/**
		 * Open one web link in the default browser.
		 * DSH's Electron shell intercepts `window.open` and hands `http(s)` URLs to
		 * `shell.openExternal`, which is exactly the OS default application; in a
		 * plain browser the call opens a new tab.
		 * @param url - absolute `http(s)` URL.
		 * @returns whether the call was made (the shell may still deny it).
		 */
		function openUrl(url) {
			try {
				window.open(url, "_blank", "noopener,noreferrer");
				return true;
			} catch {
				return false;
			}
		}

		/**
		 * Open one target with its default application.
		 * @param ctx - client plugin context.
		 * @param target - file or URL target found in the DOM.
		 * @returns whether the open was attempted successfully.
		 */
		async function openTarget(ctx, target) {
			if (target.kind === "url") return openUrl(target.value);
			return openExternally(ctx, target.value);
		}

		/**
		 * Hold single clicks on file and web links for the double-click window and
		 * open the target natively on the second one. Any failure falls back to the
		 * shipped Sidebar behavior, so the link never turns into a dead area.
		 * @param ctx - client plugin context.
		 */
		function apply(ctx) {
			/** The held first click, if any: its element and its Sidebar timer. */
			let pending = null;

			/**
			 * Replay the click the plugin swallowed, which reopens the shipped
			 * Sidebar path. The generated event is untrusted, so the capture handler
			 * ignores it and the click reaches the renderer's own handler.
			 * @param element - the link element to click again.
			 */
			function replay(element) {
				if (element.isConnected) element.click();
			}

			/**
			 * Capture handler: decides between the Sidebar and the native open.
			 * @param event - click event.
			 */
			function onClick(event) {
				if (event.isTrusted === false) return;
				if (event.button !== 0) return;
				if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
				const target = findTarget(event.target);
				if (target === null) return;

				if (pending !== null) {
					clearTimeout(pending.timer);
					const previous = pending;
					pending = null;
					if (previous.element === target.element) {
						event.preventDefault();
						event.stopPropagation();
						void openTarget(ctx, target).then((opened) => {
							if (!opened) replay(previous.element);
						});
						return;
					}
					replay(previous.element);
				}

				event.preventDefault();
				event.stopPropagation();
				const timer = setTimeout(() => {
					pending = null;
					replay(target.element);
				}, DOUBLE_CLICK_MS);
				pending = { element: target.element, timer };
			}

			ctx.effect(() => {
				document.addEventListener("click", onClick, true);
				return () => {
					document.removeEventListener("click", onClick, true);
					if (pending !== null) {
						clearTimeout(pending.timer);
						pending = null;
					}
				};
			}, "open-file-on-double-click: click handler");
		}

		exports.apply = apply;
		exports.inject = ["sessions", "remote", "remote.session"];
		return module.exports;
	}
});
