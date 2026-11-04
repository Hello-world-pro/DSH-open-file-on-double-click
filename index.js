/**
 * Host half of dsh-open-file-on-double-click.
 *
 * The browser half (`client.js`) intercepts a double-click on a local file link
 * and asks the Session Remote to open the path with the operating system's
 * default application. Nothing on the Host side needs to change: the plugin
 * reuses `session.openWorkspacePath`, which already validates the path through
 * the composed filesystem and launches the desktop opener.
 *
 * This `apply` exists only so the package owns a Loader row; the client module
 * system then serves `client.js` to the Web GUI.
 */

/** No Host services are required. */
export const inject = [];

/** Register nothing on the Host; the feature lives entirely in the browser. */
export function apply() {}
