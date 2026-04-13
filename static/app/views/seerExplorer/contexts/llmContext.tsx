import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';

import type {
  LLMContextInternalValue,
  LLMContextNode,
  LLMContextNodeSnapshot,
  LLMContextSnapshot,
  LLMContextState,
} from './llmContextTypes';

// Internal context — holds the registry operations (registerNode, etc.)

const [_LLMContextProvider, _useLLMContextValue] =
  createDefinedContext<LLMContextInternalValue>({
    name: 'LLMContext',
    strict: true,
  });

/**
 * Hook for internal use by registerLLMContext and useLLMContext to access
 * the registry operations (registerNode, unregisterNode, updateNodeData, getSnapshot).
 * Throws if called outside an LLMContextProvider.
 */
export const useLLMContextRegistry = _useLLMContextValue;

/**
 * LLMNodeContext — carries the current component's nodeId down the tree
 * so child registerLLMContext wrappers can declare their parentId immediately
 * during render (before any effects have fired).
 * Default undefined = no parent (root level).
 */
export const LLMNodeContext = createContext<string | undefined>(undefined);

// Tree assembly helpers — convert the flat node map to a nested snapshot.
// Data is read from nodeData (imperative ref) rather than the reducer state
// so that writes from useLLMContext(data) are visible immediately even
// before the HOC's registerNode effect has fired.

function collectDescendantIds(
  nodes: Map<string, LLMContextNode>,
  nodeId: string,
  result = new Set<string>()
): Set<string> {
  result.add(nodeId);
  for (const [id, node] of nodes) {
    if (node.parentId === nodeId) {
      collectDescendantIds(nodes, id, result);
    }
  }
  return result;
}

function buildTree(
  nodes: LLMContextState['nodes'],
  nodeData: Map<string, unknown>,
  parentId: string | undefined
): LLMContextNodeSnapshot[] {
  const children: LLMContextNodeSnapshot[] = [];
  for (const [id, node] of nodes) {
    if (node.parentId === parentId) {
      children.push({
        nodeType: node.nodeType,
        data: nodeData.has(id) ? nodeData.get(id) : {},
        children: buildTree(nodes, nodeData, id),
      });
    }
  }
  return children;
}

function serializeState(
  state: LLMContextState,
  nodeData: Map<string, unknown>,
  fromNodeId?: string
): LLMContextSnapshot {
  if (fromNodeId) {
    const node = state.nodes.get(fromNodeId);
    if (!node) {
      return {version: state.version, nodes: []};
    }
    return {
      version: state.version,
      nodes: [
        {
          nodeType: node.nodeType,
          data: nodeData.has(fromNodeId) ? nodeData.get(fromNodeId) : {},
          children: buildTree(state.nodes, nodeData, fromNodeId),
        },
      ],
    };
  }
  return {
    version: state.version,
    nodes: buildTree(state.nodes, nodeData, undefined),
  };
}

// LLMContextProvider — root of the entire context tree

interface LLMContextProviderProps {
  children: ReactNode;
}

const INITIAL_STATE: LLMContextState = {
  nodes: new Map(),
  version: 0,
};

export function LLMContextProvider({children}: LLMContextProviderProps) {
  // All state lives in refs — no re-renders needed. Consumers read
  // the latest data imperatively via getSnapshot().
  const stateRef = useRef<LLMContextState>(INITIAL_STATE);
  const nodeDataRef = useRef<Map<string, unknown>>(new Map());

  const getSnapshot = useCallback((fromNodeId?: string): LLMContextSnapshot => {
    return serializeState(stateRef.current, nodeDataRef.current, fromNodeId);
  }, []);

  const registerNode = useCallback(
    (nodeId: string, nodeType: string, parentId?: string): void => {
      const prev = stateRef.current;
      const newNodes = new Map(prev.nodes);
      newNodes.set(nodeId, {nodeType, parentId});
      stateRef.current = {nodes: newNodes, version: prev.version + 1};
    },
    []
  );

  const unregisterNode = useCallback((nodeId: string) => {
    const prev = stateRef.current;
    if (!prev.nodes.has(nodeId)) {
      return;
    }
    const toRemove = collectDescendantIds(prev.nodes, nodeId);
    const newNodes = new Map(prev.nodes);
    for (const id of toRemove) {
      newNodes.delete(id);
      nodeDataRef.current.delete(id);
    }
    stateRef.current = {nodes: newNodes, version: prev.version + 1};
  }, []);

  const updateNodeData = useCallback((nodeId: string, data: unknown) => {
    nodeDataRef.current.set(nodeId, data);
    // Bump version so consumers using it as a change token detect data updates.
    stateRef.current = {...stateRef.current, version: stateRef.current.version + 1};
  }, []);

  // Memoize so that the context value reference is stable across re-renders.
  const value = useMemo<LLMContextInternalValue>(
    () => ({getSnapshot, registerNode, unregisterNode, updateNodeData}),
    [getSnapshot, registerNode, unregisterNode, updateNodeData]
  );

  return <_LLMContextProvider value={value}>{children}</_LLMContextProvider>;
}

/**
 * useLLMContext — write overload
 *
 * Call inside a registerLLMContext-wrapped component (or any descendant)
 * to push structured data into the nearest registered context node.
 * Accepts any value type — objects, arrays, strings, numbers, etc.
 *
 *   useLLMContext({ title: 'Error Rate', threshold: 5 });
 *   useLLMContext(someComputedValue);
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- {} here means "any non-undefined value" to distinguish from the no-arg read overload
export function useLLMContext(data: {} | null): void;

/**
 * useLLMContext — read overload
 *
 * Call with no arguments to get getLLMContext.
 *
 *   const { getLLMContext } = useLLMContext();
 *   getLLMContext()      // full tree from root
 *   getLLMContext(true)  // current component's subtree only
 */
export function useLLMContext(): {
  getLLMContext: (componentOnly?: boolean) => LLMContextSnapshot;
};

export function useLLMContext(
  data?: unknown
): void | {getLLMContext: (componentOnly?: boolean) => LLMContextSnapshot} {
  const ctx = useLLMContextRegistry();
  const nodeId = useContext(LLMNodeContext);
  const prevDataRef = useRef<string>('');

  // Write path: sync data into the nearest node whenever it changes.
  // JSON equality guard prevents redundant writes. updateNodeData writes
  // imperatively to a ref — no dispatch, no re-render required.
  useEffect(() => {
    if (!nodeId || data === undefined) {
      return;
    }
    let serialized: string | null;
    let safeData: unknown = data;
    try {
      serialized = JSON.stringify(data);
    } catch {
      // Non-serializable value (e.g. circular reference) — store a
      // placeholder so getSnapshot() remains JSON-serializable.
      serialized = null;
      safeData = {error: 'non-serializable value'};
    }
    if (serialized === null || serialized !== prevDataRef.current) {
      if (serialized !== null) {
        prevDataRef.current = serialized;
      }
      ctx.updateNodeData(nodeId, safeData);
    }
  });

  // Read path: always created so hooks run unconditionally.
  // Only returned when called without data.
  const getLLMContext = useCallback(
    (componentOnly?: boolean): LLMContextSnapshot => {
      if (componentOnly && nodeId) {
        return ctx.getSnapshot(nodeId);
      }
      return ctx.getSnapshot();
    },
    [ctx, nodeId]
  );

  if (data === undefined) {
    return {getLLMContext};
  }
  return undefined;
}
