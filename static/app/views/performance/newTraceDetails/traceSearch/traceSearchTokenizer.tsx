import type {
  NoDataNode,
  ParentAutogroupNode,
  SiblingAutogroupNode,
  TraceTree,
  TraceTreeNode,
} from '../traceModels/traceTree';

import grammar from './traceSearch.pegjs';

interface SearchToken {
  key: string;
  type: 'Token';
  value: string | number;
  negated?: boolean;
  operator?: 'gt' | 'ge' | 'lt' | 'le' | 'eq';
}

type Token = SearchToken;

// typeof can return one of the following string values - we ignore BigInt, Symbol as there
// is no practical case for them + they are not supported by JSON.
// object (special handling for arrays), number, string, boolean, undefined, null
type Type = 'object' | 'number' | 'string' | 'boolean' | 'undefined' | 'null';

// @ts-expect-error we ignore some keys on purpose, the TS error makes it helpful
// for seeing exactly which ones we are ignoring for when we want to add support for them
const SPAN_KEYS: Record<keyof TraceTree.Span, Type> = {
  hash: 'string',
  span_id: 'string',
  start_timestamp: 'number',
  timestamp: 'number',
  trace_id: 'string',
  description: 'string',
  exclusive_time: 'number',

  op: 'string',
  origin: 'string',
  parent_span_id: 'string',
  same_process_as_parent: 'boolean',
  // TODO Jonas Badalic: The response for the avg duration metrics is now an object and can return
  // both the avg span_self time and the avg span duration. This will need to be handled differently.
  // This one will need to be flattened
  'span.averageResults': 'object',
  status: 'string',

  // These are both records and will need to be handled differently
  sentry_tags: 'string',
  tags: 'string',
};

export function traceSearchTokenizer(input: string): Token[] {
  return grammar.parse(input);
}

export function traceSearchLexer(_input: string): string[] {
  throw new Error('Not implemented');
}

export function evaluateTokenForTraceNode(
  node:
    | TraceTreeNode<TraceTree.NodeValue>
    | ParentAutogroupNode
    | SiblingAutogroupNode
    | NoDataNode,
  token: Token
): boolean {
  const type = SPAN_KEYS[token.key];

  // @ts-expect-error ignore the lookup as the value will be dynamic
  const value = node.value[token.key];

  let match: undefined | boolean = undefined;
  if (token.value === undefined) {
    match = value === undefined;
  }

  if (token.value === null) {
    match = value === null;
  }

  // @TODO check for the distinction between obj and array here as L78
  // does not guarantee exact same primitive type in this case
  if (typeof value !== type && token.value !== null && token.value !== undefined) {
    // The two types are not the same.
    return false;
  }

  // prettier-ignore
  switch (type) {
    case 'string': {
      match = value === token.value || value.includes(token.value);
      break;
    }
    case 'number': {
      if (!token.operator) {
        match = value === token.value;
        break;
      }

      // prettier-ignore
      switch (token.operator) {
        case 'gt': match = value > token.value; break;
        case 'ge': match = value >= token.value; break;
        case 'lt': match = value < token.value; break;
        case 'le': match = value <= token.value; break;
        case 'eq': match = value === token.value; break;
        default: break;
      }
      break;
    }
    case 'boolean': {
      match = value === token.value;
      break;
    }
    case 'object': {
      return false;
    }
    default: break;
  }

  if (match === undefined) {
    return false;
  }

  return token.negated ? !match : match;
}
