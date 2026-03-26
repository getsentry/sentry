import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';

import {
  INITIAL_SEER_CONTEXT_STATE,
  SeerContextAction,
  seerContextReducer,
} from './seerContextReducer';
import type {
  SeerContextInternalValue,
  SeerContextNodeSnapshot,
  SeerContextSnapshot,
  SeerContextState,
} from './seerContextTypes';

// ---------------------------------------------------------------------------
// Internal context — holds the registry operations (registerNode, etc.)
// ---------------------------------------------------------------------------

const [_SeerContextProvider, _useSeerContextValue] =
  createDefinedContext<SeerContextInternalValue>({
    name: 'SeerContext',
    strict: false,
  });

/**
 * Hook for internal use by registerSeerContext and useSeerContext to access
 * the registry operations (registerNode, unregisterNode, updateNodeData, getSnapshot).
 * Returns undefined when called outside a SeerContextProvider.
 */
export const useSeerContextRegistry = _useSeerContextValue;

// ---------------------------------------------------------------------------
// SeerNodeContext — carries the current component's nodeId down the tree
// so child registerSeerContext wrappers can declare their parentId immediately
// during render (before any effects have fired).
// Default undefined = no parent (root level).
// ---------------------------------------------------------------------------

export const SeerNodeContext = createContext<string | undefined>(undefined);

// ---------------------------------------------------------------------------
// Tree assembly helpers — convert the flat node map to a nested snapshot.
// Data is read from nodeData (imperative ref) rather than the reducer state
// so that writes from useSeerContext(data) are visible immediately even
// before the HOC's registerNode effect has fired.
// ---------------------------------------------------------------------------

function buildTree(
  nodes: SeerContextState['nodes'],
  nodeData: Map<string, Record<string, unknown>>,
  parentId: string | undefined
): SeerContextNodeSnapshot[] {
  const children: SeerContextNodeSnapshot[] = [];
  for (const [id, node] of nodes) {
    if (node.parentId === parentId) {
      children.push({
        nodeType: node.nodeType,
        data: nodeData.get(id) ?? {},
        children: buildTree(nodes, nodeData, id),
      });
    }
  }
  return children;
}

function serializeState(
  state: SeerContextState,
  nodeData: Map<string, Record<string, unknown>>,
  fromNodeId?: string
): SeerContextSnapshot {
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
          data: nodeData.get(fromNodeId) ?? {},
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

// ---------------------------------------------------------------------------
// SeerContextProvider — root of the entire context tree
// ---------------------------------------------------------------------------

interface SeerContextProviderProps {
  children: ReactNode;
}

export function SeerContextProvider({children}: SeerContextProviderProps) {
  const [state, dispatch] = useReducer(seerContextReducer, INITIAL_SEER_CONTEXT_STATE);

  // Ref so that getSnapshot always reads the latest structural state without
  // needing to be re-created when state changes (which would break memoization).
  const stateRef = useRef(state);
  stateRef.current = state;

  // Imperative ref for node data — written directly without dispatch.
  // This decouples data writes from the render/effect cycle entirely:
  // useSeerContext(data) effects fire before registerNode effects (children
  // run before parents), so data is pre-populated in the ref by the time
  // getSnapshot() is called.
  const nodeDataRef = useRef<Map<string, Record<string, unknown>>>(new Map());

  const getSnapshot = useCallback((fromNodeId?: string): SeerContextSnapshot => {
    return serializeState(stateRef.current, nodeDataRef.current, fromNodeId);
  }, []);

  const registerNode = useCallback(
    (nodeId: string, nodeType: string, parentId?: string): void => {
      dispatch({
        type: SeerContextAction.REGISTER_NODE,
        nodeId,
        nodeType,
        parentId,
      });
    },
    []
  );

  const unregisterNode = useCallback((nodeId: string) => {
    dispatch({type: SeerContextAction.UNREGISTER_NODE, nodeId});
  }, []);

  const updateNodeData = useCallback((nodeId: string, data: Record<string, unknown>) => {
    const existing = nodeDataRef.current.get(nodeId) ?? {};
    nodeDataRef.current.set(nodeId, {...existing, ...data});
  }, []);

  // Memoize so that the context value reference is stable across re-renders.
  // Without this, any state change (dispatch) would create a new value object,
  // causing the HOC's useEffect (which has ctx in its deps) to re-fire on
  // every registration, creating an infinite loop.
  const value = useMemo<SeerContextInternalValue>(
    () => ({getSnapshot, registerNode, unregisterNode, updateNodeData}),
    [getSnapshot, registerNode, unregisterNode, updateNodeData]
  );

  return <_SeerContextProvider value={value}>{children}</_SeerContextProvider>;
}

// ---------------------------------------------------------------------------
// useSeerContext — write overload
//
// Call inside a registerSeerContext-wrapped component (or any descendant)
// to push structured data into the nearest registered context node.
//
//   useSeerContext({ title: 'Error Rate', threshold: 5 });
// ---------------------------------------------------------------------------

export function useSeerContext(data: Record<string, unknown>): void;

// ---------------------------------------------------------------------------
// useSeerContext — read overload
//
// Call with no arguments to get getSeerContext.
//
//   const { getSeerContext } = useSeerContext();
//   getSeerContext()      // full tree from root
//   getSeerContext(true)  // current component's subtree only
// ---------------------------------------------------------------------------

export function useSeerContext(): {
  getSeerContext: (componentOnly?: boolean) => SeerContextSnapshot;
};

export function useSeerContext(
  data?: Record<string, unknown>
): void | {getSeerContext: (componentOnly?: boolean) => SeerContextSnapshot} {
  const ctx = useSeerContextRegistry();
  const nodeId = useContext(SeerNodeContext);
  const prevDataRef = useRef<string>('');

  // Write path: sync data into the nearest node whenever it changes.
  // No dep array so it picks up every render. JSON equality guard prevents
  // redundant writes. The HOC provides nodeId synchronously (via useMemo),
  // so this is non-null on first render inside a registered component.
  // updateNodeData writes imperatively to a ref — no dispatch, no re-render
  // required, and no timing dependency on registerNode having fired first.
  useEffect(() => {
    if (!ctx || !nodeId || data === undefined) {
      return;
    }
    const serialized = JSON.stringify(data);
    if (serialized !== prevDataRef.current) {
      prevDataRef.current = serialized;
      ctx.updateNodeData(nodeId, data);
    }
  });

  // Read path: always created so hooks run unconditionally.
  // Only returned when called without data.
  const getSeerContext = useCallback(
    (componentOnly?: boolean): SeerContextSnapshot => {
      if (!ctx) {
        return {version: 0, nodes: []};
      }
      if (componentOnly && nodeId) {
        return ctx.getSnapshot(nodeId);
      }
      return ctx.getSnapshot();
    },
    [ctx, nodeId]
  );

  if (data === undefined) {
    return {getSeerContext};
  }
  return undefined;
}
