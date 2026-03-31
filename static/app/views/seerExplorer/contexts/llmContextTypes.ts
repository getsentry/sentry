/**
 * Seer Context System — Types
 *
 * A flat map of context nodes that captures semantic state from the currently
 * rendered page. Each node corresponds to a React component (dashboard,
 * widget, etc.) and holds key-value data about it. The Seer Explorer reads
 * a snapshot of this tree instead of scraping the DOM.
 *
 * Nodes are stored flat (keyed by ID) with a `parentId` pointer. The nested
 * tree structure is assembled lazily at getSnapshot() time. This avoids
 * ordering dependencies during registration — a child can declare its
 * parentId immediately even before the parent's effect has fired.
 */

/**
 * A single node in the flat registry.
 *
 * - `nodeType` — what kind of thing this is ("dashboard", "widget", etc.)
 * - `parentId` — ID of the parent node, or undefined for root-level nodes
 *
 * Note: node data is stored separately in the provider's imperative
 * `nodeDataRef` rather than on this struct, so that writes from
 * `useSeerContext(data)` don't require a reducer dispatch.
 */
export interface SeerContextNode {
  nodeType: string;
  parentId?: string;
}

/**
 * The full state held by the provider.
 *
 * - `nodes` — flat map of all registered nodes keyed by ID
 * - `version` — bumped on every mutation so consumers can detect updates cheaply
 */
export interface SeerContextState {
  nodes: Map<string, SeerContextNode>;
  version: number;
}

/**
 * The snapshot format returned by `getSnapshot()`. This is what gets sent
 * to the Seer API — a plain-JSON-serializable nested tree.
 */
export interface SeerContextSnapshot {
  nodes: SeerContextNodeSnapshot[];
  version: number;
}

export interface SeerContextNodeSnapshot {
  children: SeerContextNodeSnapshot[];
  data: Record<string, unknown>;
  nodeType: string;
}

/**
 * The value exposed by the internal SeerContext to the HOC and hooks.
 */
export interface SeerContextInternalValue {
  getSnapshot: (fromNodeId?: string) => SeerContextSnapshot;
  registerNode: (nodeId: string, nodeType: string, parentId?: string) => void;
  unregisterNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
}
