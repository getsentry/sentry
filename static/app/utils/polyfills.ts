/**
 * Explicit polyfills for ES2023+ built-ins that are used throughout the app.
 *
 * Our swc loader injects core-js polyfills in `usage` mode, but only for the
 * browsers listed in `browserslist.production` (package.json). Those targets
 * all ship these methods natively, so no polyfill is ever injected and older
 * engines that still load the app (e.g. iOS 15 WebKit) crash with errors like
 * `toSorted is not a function` before the UI can render.
 *
 * Importing them here, from the first module in each entrypoint, makes them
 * available everywhere. core-js skips installing anything the browser already
 * supports natively.
 *
 * The no-unnecessary-polyfills rule checks against the same browserslist
 * targets, which is exactly the gap these imports exist to cover.
 */
/* oxlint-disable unicorn-js/no-unnecessary-polyfills */
import 'core-js/actual/array/find-last';
import 'core-js/actual/array/find-last-index';
import 'core-js/actual/array/to-reversed';
import 'core-js/actual/array/to-sorted';
import 'core-js/actual/array/to-spliced';
import 'core-js/actual/array/with';
import 'core-js/actual/map/group-by';
import 'core-js/actual/object/group-by';
