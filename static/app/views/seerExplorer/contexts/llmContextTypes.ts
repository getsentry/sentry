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
export type LLMContextNodeType = 'chart' | 'dashboard' | 'widget';

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
 * The snapshot format returned by `getSnapshot()`. This is what gets sent
 * to the LLM API — a plain-JSON-serializable nested tree.
 */
export interface LLMContextSnapshot {
  nodes: LLMContextNodeSnapshot[];
  version: number;
}

export interface LLMContextNodeSnapshot {
  children: LLMContextNodeSnapshot[];
  data: unknown;
  nodeType: string;
}

/**
 * The value exposed by the internal LLMContext to the HOC and hooks.
 */
export interface LLMContextInternalValue {
  getSnapshot: (fromNodeId?: string) => LLMContextSnapshot;
  registerNode: (nodeId: string, nodeType: string, parentId?: string) => void;
  unregisterNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: unknown) => void;
}
