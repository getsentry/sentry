/**
 * LLM Context System — Types
 *
 * A flat map of context nodes that captures semantic state from the currently
 * rendered page. Each node corresponds to a React component (dashboard,
 * widget, etc.) and holds key-value data about it. The LLM context reader
 * (e.g. Seer Explorer) reads a snapshot of this tree instead of scraping
 * the DOM.
 *
 * Nodes are stored flat (keyed by ID) with a `parentId` pointer. The nested
 * tree structure is assembled lazily at getSnapshot() time. This avoids
 * ordering dependencies during registration — a child can declare its
 * parentId immediately even before the parent's effect has fired.
 */

/**
 * Known node types for the LLM context tree.
 * Add new types here as new context-aware components are registered.
 */
export type LLMContextNodeType =
  | 'autofix'
  | 'chart'
  | 'dashboard'
  | 'issue-detail'
  | 'issue-list'
  | 'logs-explorer'
  | 'metrics-explorer'
  | 'navigation'
  | 'profiling-explorer'
  | 'releases-list'
  | 'replay-detail'
  | 'replays-list'
  | 'trace'
  | 'traces-explorer'
  | 'widget'
  | 'widget-builder';

/**
 * A single node in the flat registry.
 *
 * - `nodeType` — what kind of thing this is ("dashboard", "widget", etc.)
 * - `parentId` — ID of the parent node, or undefined for root-level nodes
 *
 * Note: node data is stored separately in the provider's imperative
 * `nodeDataRef` rather than on this struct, so that writes from
 * `useLLMContext(data)` don't require a state mutation.
 */
export interface LLMContextNode {
  nodeType: string;
  parentId?: string;
}

/**
 * The full state held by the provider (stored in a ref, not reactive).
 *
 * - `nodes` — flat map of all registered nodes keyed by ID
 * - `version` — bumped on every mutation so consumers can detect updates cheaply
 */
export interface LLMContextState {
  nodes: Map<string, LLMContextNode>;
  version: number;
}

/**
 * Where the user is in the app, independent of what any page registered.
 *
 * `name` is the route pattern and `params` its filled-in values, so
 * `/issues/:groupId/` plus `{groupId: '123'}` tells the reader what `123` *is* —
 * something a bare URL leaves it to guess.
 */
export interface LLMContextLocation {
  name: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  url: string;
}

/**
 * The snapshot format returned by `getSnapshot()`. This is what gets sent
 * to the LLM API — a plain-JSON-serializable nested tree.
 *
 * `location` is present regardless of whether any component registered a node,
 * so a page with no LLMContext coverage still reports where the user is.
 */
export interface LLMContextSnapshot {
  nodes: LLMContextNodeSnapshot[];
  version: number;
  location?: LLMContextLocation;
}

export interface LLMContextNodeSnapshot {
  children: LLMContextNodeSnapshot[];
  data: unknown;
  nodeType: string;
  priority: number;
}

/**
 * A single registered node, flattened for DOM-position overlays (e.g. Seer
 * XRay Mode). Unlike `LLMContextNodeSnapshot` this carries `nodeId`, which an
 * overlay needs to locate the node's DOM anchor via
 * `data-seer-xray-node-id`. Not used by the LLM-facing snapshot, where ids
 * would be meaningless.
 */
export interface LLMContextOverlayNode {
  data: unknown;
  nodeId: string;
  nodeType: string;
  parentId?: string;
}

/**
 * The value exposed by the internal LLMContext to the HOC and hooks.
 */
export interface LLMContextInternalValue {
  getOverlayNodes: () => LLMContextOverlayNode[];
  getSnapshot: (fromNodeId?: string) => LLMContextSnapshot;
  registerNode: (nodeId: string, nodeType: string, parentId?: string) => void;
  unregisterNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: unknown) => void;
}
