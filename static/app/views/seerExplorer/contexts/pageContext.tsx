import type {ReactNode} from 'react';
import {useCallback, useEffect, useReducer, useRef} from 'react';

import {uniqueId} from 'sentry/utils/guid';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';

import {
  INITIAL_PAGE_CONTEXT_STATE,
  PageContextAction,
  pageContextReducer,
} from './pageContextReducer';
import type {
  PageContextNode,
  PageContextNodeSnapshot,
  PageContextSnapshot,
  PageContextState,
} from './pageContextTypes';

interface PageContextValue {
  getSnapshot: () => PageContextSnapshot;
  registerNode: (nodeType: string, parentId?: string) => string;
  unregisterNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
}

const [_PageContextProvider, _usePageContextValue, _PageContext] =
  createDefinedContext<PageContextValue>({
    name: 'PageContextContext',
    strict: false,
  });

function serializeNode(node: PageContextNode): PageContextNodeSnapshot {
  return {
    nodeType: node.nodeType,
    data: node.data,
    children: Array.from(node.children.values()).map(serializeNode),
  };
}

function serializeState(state: PageContextState): PageContextSnapshot {
  return {
    version: state.version,
    nodes: Array.from(state.nodes.values()).map(serializeNode),
  };
}

interface PageContextProviderProps {
  children: ReactNode;
}

export function PageContextProvider({children}: PageContextProviderProps) {
  const [state, dispatch] = useReducer(pageContextReducer, INITIAL_PAGE_CONTEXT_STATE);

  const stateRef = useRef(state);
  stateRef.current = state;

  const getSnapshot = useCallback((): PageContextSnapshot => {
    return serializeState(stateRef.current);
  }, []);

  const registerNode = useCallback((nodeType: string, parentId?: string): string => {
    const nodeId = uniqueId();
    dispatch({
      type: PageContextAction.REGISTER_NODE,
      nodeId,
      nodeType,
      parentId,
    });
    return nodeId;
  }, []);

  const unregisterNode = useCallback((nodeId: string) => {
    dispatch({
      type: PageContextAction.UNREGISTER_NODE,
      nodeId,
    });
  }, []);

  const updateNodeData = useCallback((nodeId: string, data: Record<string, unknown>) => {
    dispatch({
      type: PageContextAction.UPDATE_NODE_DATA,
      nodeId,
      data,
    });
  }, []);

  const value: PageContextValue = {
    getSnapshot,
    registerNode,
    unregisterNode,
    updateNodeData,
  };

  return <_PageContextProvider value={value}>{children}</_PageContextProvider>;
}

/**
 * Hook for components to push context data into the tree.
 *
 * Call this inside any component that is wrapped by `registerPageContext`
 * (or a child of one). Pass the data you want to report — it gets merged
 * into the node's `data` field whenever it changes.
 *
 * If called outside a `PageContextProvider`, it's a no-op.
 */
export function usePageContext(
  nodeId: string | undefined,
  data: Record<string, unknown>
) {
  const ctx = _usePageContextValue();
  const prevDataRef = useRef<string>('');

  useEffect(() => {
    if (!ctx || !nodeId) {
      return;
    }

    const serialized = JSON.stringify(data);
    if (serialized !== prevDataRef.current) {
      prevDataRef.current = serialized;
      ctx.updateNodeData(nodeId, data);
    }
  });
}

export function usePageContextProvider() {
  const ctx = _usePageContextValue();
  return ctx ?? null;
}
