import type {
  LLMAction,
  LLMContextEntity,
  LLMContextNode,
} from 'sentry/utils/seer/llmContext';

/**
 * Serialized representation of a context node for inclusion in an LLM prompt.
 */
interface SerializedNode {
  actions: SerializedAction[];
  children: SerializedNode[];
  description: string;
  entity: LLMContextEntity;
  name: string;
  state: Record<string, unknown>;
}

interface SerializedAction {
  description: string;
  schema: Record<string, unknown>;
  type: string;
}

/**
 * The complete serialized UI context payload sent to the LLM.
 */
export interface SerializedUIContext {
  ui_context: SerializedNode[];
}

/**
 * An action the LLM wants to dispatch, parsed from its JSON response.
 */
export interface LLMDispatchAction {
  /** Which context to target (matches LLMContext name) */
  context: string;
  /** Payload for the action */
  payload: Record<string, unknown>;
  /** Action type (matches LLMAction type) */
  type: string;
}

/**
 * Expected shape of the LLM's JSON response containing actions.
 */
export interface LLMActionResponse {
  actions: LLMDispatchAction[];
}

function serializeAction(action: LLMAction): SerializedAction {
  return {
    description: action.description,
    schema: action.schema,
    type: action.type,
  };
}

function serializeNode(node: LLMContextNode): SerializedNode {
  return {
    actions: node.actions.map(serializeAction),
    children: node.children.map(serializeNode),
    description: node.description,
    entity: node.entity,
    name: node.name,
    state: node.data,
  };
}

/**
 * Serializes the LLM context tree into a JSON-friendly format
 * suitable for inclusion in an LLM prompt.
 */
export function serializeLLMContext(tree: LLMContextNode[]): SerializedUIContext {
  return {
    ui_context: tree.map(serializeNode),
  };
}

/**
 * Collects all available actions across the entire context tree
 * into a flat list. Useful for prompt construction where you want
 * to list all possible actions separately from the context tree.
 */
export function collectActions(
  tree: LLMContextNode[]
): Array<LLMAction & {context: string}> {
  const result: Array<LLMAction & {context: string}> = [];

  function walk(nodes: LLMContextNode[]) {
    for (const node of nodes) {
      for (const action of node.actions) {
        result.push({...action, context: node.name});
      }
      walk(node.children);
    }
  }

  walk(tree);
  return result;
}

/**
 * Parses and validates an LLM response into dispatchable actions.
 * Returns null if the response is not valid.
 */
export function parseLLMActionResponse(response: unknown): LLMActionResponse | null {
  if (
    typeof response !== 'object' ||
    response === null ||
    !('actions' in response) ||
    !Array.isArray((response as any).actions)
  ) {
    return null;
  }

  const actions: LLMDispatchAction[] = [];

  for (const item of (response as any).actions) {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.context !== 'string' ||
      typeof item.type !== 'string'
    ) {
      continue; // skip malformed actions
    }
    actions.push({
      context: item.context,
      payload:
        typeof item.payload === 'object' && item.payload !== null ? item.payload : {},
      type: item.type,
    });
  }

  return {actions};
}
