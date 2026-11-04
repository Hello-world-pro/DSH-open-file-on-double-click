# Changelog

## 1.1.0 — 2026-11-05

- Double-clicking an `http(s)` link now opens it in the default browser through
  `window.open`; the DSH Electron shell hands it to `shell.openExternal`.
- The single-click hold grows to 350 ms, so the Sidebar does not reflow the chat
  between the two clicks of a double-click.

## 1.0.0 — 2026-11-04

- First release.
- Double-clicking a Markdown file link opens the file with the operating
  system's default application through `session.openWorkspacePath`.
- Single clicks keep the shipped Sidebar preview; a failed open falls back to
  it.
- Windows drive paths, POSIX paths and UNC paths are supported; relative links
  resolve against the main Session's working directory.
