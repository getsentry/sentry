import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {useMatches} from 'react-router-dom';

import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';
import {useParams} from 'sentry/utils/useParams';

import type {
  LLMContextInternalValue,
  LLMContextLocation,
  LLMContextNode,
  LLMContextNodeSnapshot,
  LLMContextSnapshot,
  LLMContextState,
} from './llmContextTypes';

/**
 * The half of the location that needs router hooks to know. The URL and query
 * string are read from `window.location` at snapshot time instead.
 */
interface RouteIdentity {
  name: string;
  params: Record<string, string>;
}

// Internal context — holds the registry operations (registerNode, etc.)

const LLMInternalContext = createContext<LLMContextInternalValue | undefined>(undefined);

/**
 * Hook for internal use by registerLLMContext and useLLMContext to access
 * the registry operations (registerNode, unregisterNode, updateNodeData, getSnapshot).
 * Throws if called outside an LLMContextProvider.
 */
export function useLLMContextRegistry(): LLMContextInternalValue {
  const context = useContext(LLMInternalContext);
  if (context === undefined) {
    throw new Error('useContext for "LLMContext" must be inside a Provider with a value');
  }
  return context;
}

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
      const raw = nodeData.has(id) ? nodeData.get(id) : {};
      let priority = 0;
      let data = raw;
      if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
        const {priority: p, ...rest} = raw as Record<string, unknown>;
        if (typeof p === 'number') {
          priority = p;
        }
        data = rest;
      }
      children.push({
        nodeType: node.nodeType,
        priority,
        data,
        children: buildTree(nodes, nodeData, id),
      });
    }
  }
  return children;
}

/**
 * Reports the current route into the provider's location ref.
 *
 * A separate component on purpose: `useLocation`/`useParams`/`useMatches` all
 * re-render their caller on every navigation, and the provider wraps the entire
 * app — it currently never re-renders after mount and should stay that way. This
 * renders null, so its own re-renders cost nothing.
 *
 * Only the route *pattern* and params need router hooks. The URL and query string
 * are read straight off `window.location` at snapshot time, which is why they are
 * absent here.
 */
function LocationWatcher({
  onChange,
}: {
  onChange: (location: RouteIdentity) => void;
}): null {
  const params = useParams();
  const matches = useMatches();
  const name = getRouteStringFromRoutes({matches});

  useEffect(() => {
    onChange({name, params});
  }, [name, params, onChange]);

  return null;
}

/**
 * Assembles the location at snapshot time. The URL and query string come from
 * `window.location` rather than a subscription, so they cannot go stale; the
 * route pattern and params come from the watcher's last report.
 */
function readLocation(route: RouteIdentity | null): LLMContextLocation | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const query: Record<string, string | string[]> = {};
  for (const key of new Set(new URLSearchParams(window.location.search).keys())) {
    const all = new URLSearchParams(window.location.search).getAll(key);
    query[key] = all.length > 1 ? all : (all[0] ?? '');
  }

  return {
    url: window.location.href,
    name: route?.name ?? '',
    params: route?.params ?? {},
    query,
  };
}

function serializeState(
  state: LLMContextState,
  nodeData: Map<string, unknown>,
  route: RouteIdentity | null,
  fromNodeId?: string
): LLMContextSnapshot {
  const location = readLocation(route);
  if (fromNodeId) {
    const node = state.nodes.get(fromNodeId);
    if (!node) {
      return {version: state.version, nodes: [], location};
    }
    const raw = nodeData.has(fromNodeId) ? nodeData.get(fromNodeId) : {};
    let priority = 0;
    let data = raw;
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      const {priority: p, ...rest} = raw as Record<string, unknown>;
      if (typeof p === 'number') {
        priority = p;
      }
      data = rest;
    }
    return {
      version: state.version,
      nodes: [
        {
          nodeType: node.nodeType,
          priority,
          data,
          children: buildTree(state.nodes, nodeData, fromNodeId),
        },
      ],
      location,
    };
  }
  return {
    version: state.version,
    nodes: buildTree(state.nodes, nodeData, undefined),
    location,
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
  const stateRef = useRef(INITIAL_STATE);
  const nodeDataRef = useRef(new Map<string, unknown>());
  const routeRef = useRef<RouteIdentity | null>(null);

  // Stable so LocationWatcher's effect doesn't refire on every provider render.
  const handleRouteChange = useCallback((route: RouteIdentity) => {
    routeRef.current = route;
  }, []);

  const getSnapshot = useCallback((fromNodeId?: string): LLMContextSnapshot => {
    return serializeState(
      stateRef.current,
      nodeDataRef.current,
      routeRef.current,
      fromNodeId
    );
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

  return (
    <LLMInternalContext value={value}>
      <LocationWatcher onChange={handleRouteChange} />
      {children}
    </LLMInternalContext>
  );
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
  const prevDataRef = useRef('');

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
