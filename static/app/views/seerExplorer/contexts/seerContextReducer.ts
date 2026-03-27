import type {SeerContextNode, SeerContextState} from './seerContextTypes';

export const SeerContextAction = {
  REGISTER_NODE: 'REGISTER_NODE',
  UNREGISTER_NODE: 'UNREGISTER_NODE',
  RESET: 'RESET',
} as const;

export type SeerContextActionType =
  | {
      nodeId: string;
      nodeType: string;
      type: typeof SeerContextAction.REGISTER_NODE;
      parentId?: string;
    }
  | {
      nodeId: string;
      type: typeof SeerContextAction.UNREGISTER_NODE;
    }
  | {
      type: typeof SeerContextAction.RESET;
    };

export const INITIAL_SEER_CONTEXT_STATE: SeerContextState = {
  nodes: new Map(),
  version: 0,
};

/**
 * Collect the IDs of a node and all its descendants from the flat map.
 * Exported so callers (e.g. the provider's unregisterNode) can mirror the
 * same removal set against out-of-band storage like nodeDataRef.
 */
export function collectDescendantIds(
  nodes: Map<string, SeerContextNode>,
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

export function seerContextReducer(
  state: SeerContextState,
  action: SeerContextActionType
): SeerContextState {
  switch (action.type) {
    case SeerContextAction.REGISTER_NODE: {
      const newNodes = new Map(state.nodes);
      newNodes.set(action.nodeId, {
        nodeType: action.nodeType,
        data: {},
        parentId: action.parentId,
      });
      return {nodes: newNodes, version: state.version + 1};
    }

    case SeerContextAction.UNREGISTER_NODE: {
      if (!state.nodes.has(action.nodeId)) {
        return state;
      }
      const newNodes = new Map(state.nodes);
      // Remove the node and all its descendants
      const toRemove = collectDescendantIds(newNodes, action.nodeId);
      for (const id of toRemove) {
        newNodes.delete(id);
      }
      return {nodes: newNodes, version: state.version + 1};
    }

    case SeerContextAction.RESET: {
      return {nodes: new Map(), version: state.version + 1};
    }

    default:
      return state;
  }
}
