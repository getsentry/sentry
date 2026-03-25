import type {PageContextNode, PageContextState} from './pageContextTypes';

export const PageContextAction = {
  REGISTER_NODE: 'REGISTER_NODE',
  UNREGISTER_NODE: 'UNREGISTER_NODE',
  UPDATE_NODE_DATA: 'UPDATE_NODE_DATA',
  RESET: 'RESET',
} as const;

export type PageContextActionType =
  | {
      nodeId: string;
      nodeType: string;
      type: typeof PageContextAction.REGISTER_NODE;
      parentId?: string;
    }
  | {
      nodeId: string;
      type: typeof PageContextAction.UNREGISTER_NODE;
    }
  | {
      data: Record<string, unknown>;
      nodeId: string;
      type: typeof PageContextAction.UPDATE_NODE_DATA;
    }
  | {
      type: typeof PageContextAction.RESET;
    };

export const INITIAL_PAGE_CONTEXT_STATE: PageContextState = {
  nodes: new Map(),
  version: 0,
};

function findNode(
  nodes: Map<string, PageContextNode>,
  nodeId: string
): PageContextNode | undefined {
  if (nodes.has(nodeId)) {
    return nodes.get(nodeId);
  }
  for (const node of nodes.values()) {
    const found = findNode(node.children, nodeId);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function deleteNode(nodes: Map<string, PageContextNode>, nodeId: string): boolean {
  if (nodes.has(nodeId)) {
    nodes.delete(nodeId);
    return true;
  }
  for (const node of nodes.values()) {
    if (deleteNode(node.children, nodeId)) {
      return true;
    }
  }
  return false;
}

export function pageContextReducer(
  state: PageContextState,
  action: PageContextActionType
): PageContextState {
  switch (action.type) {
    case PageContextAction.REGISTER_NODE: {
      const newNodes = new Map(state.nodes);
      const newNode: PageContextNode = {
        nodeType: action.nodeType,
        data: {},
        children: new Map(),
      };

      if (action.parentId) {
        const parent = findNode(newNodes, action.parentId);
        if (parent) {
          parent.children.set(action.nodeId, newNode);
        } else {
          newNodes.set(action.nodeId, newNode);
        }
      } else {
        newNodes.set(action.nodeId, newNode);
      }

      return {nodes: newNodes, version: state.version + 1};
    }

    case PageContextAction.UNREGISTER_NODE: {
      const newNodes = new Map(state.nodes);
      deleteNode(newNodes, action.nodeId);
      return {nodes: newNodes, version: state.version + 1};
    }

    case PageContextAction.UPDATE_NODE_DATA: {
      const newNodes = new Map(state.nodes);
      const node = findNode(newNodes, action.nodeId);
      if (node) {
        node.data = {...node.data, ...action.data};
        return {nodes: newNodes, version: state.version + 1};
      }
      return state;
    }

    case PageContextAction.RESET: {
      return {nodes: new Map(), version: state.version + 1};
    }

    default:
      return state;
  }
}
