/**
 * Page Context System — Types
 *
 * A tree of context nodes that captures semantic state from the currently
 * rendered page. Each node corresponds to a React component (dashboard,
 * widget, etc.) and holds key-value data about it. The Seer Explorer reads
 * a snapshot of this tree instead of scraping the DOM.
 */

/**
 * A single node in the context tree. Each UI component that registers itself
 * gets one of these.
 *
 * - `nodeType` — what kind of thing this is ("dashboard", "widget", etc.)
 * - `data` — arbitrary key-value pairs describing its state
 * - `children` — nested nodes (e.g. widgets inside a dashboard)
 */
export interface PageContextNode {
  children: Map<string, PageContextNode>;
  data: Record<string, unknown>;
  nodeType: string;
}

/**
 * The full state held by the provider at the top of the tree.
 *
 * - `nodes` — top-level context nodes (keyed by unique ID)
 * - `version` — bumped on every change so consumers can detect updates cheaply
 */
export interface PageContextState {
  nodes: Map<string, PageContextNode>;
  version: number;
}

/**
 * The snapshot format returned by `getSnapshot()`. This is what gets sent
 * to the Seer API — a plain-JSON-serializable tree.
 */
export interface PageContextSnapshot {
  nodes: PageContextNodeSnapshot[];
  version: number;
}

export interface PageContextNodeSnapshot {
  children: PageContextNodeSnapshot[];
  data: Record<string, unknown>;
  nodeType: string;
}
