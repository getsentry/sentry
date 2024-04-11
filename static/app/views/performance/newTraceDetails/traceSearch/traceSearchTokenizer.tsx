import {
  FilterType,
  type ParseResult,
  parseSearch,
  Token,
} from 'sentry/components/searchSyntax/parser';

import type {
  NoDataNode,
  ParentAutogroupNode,
  SiblingAutogroupNode,
  TraceTree,
  TraceTreeNode,
} from '../traceModels/traceTree';

export function traceSearchTokenizer(input: string): ParseResult | null {
  return parseSearch(input);
}

export function traceSearchLexer(_input: string): string[] {
  throw new Error('Not implemented');
}

function assertNeverType(_value: never): never {
  throw new Error('Unexpected value');
}
export function evaluateTokenForTraceNode(
  node:
    | TraceTreeNode<TraceTree.NodeValue>
    | ParentAutogroupNode
    | SiblingAutogroupNode
    | NoDataNode,
  token: ParseResult[0]
): boolean {
  // const type = SPAN_KEYS[token.key];

  // @ts-expect-error ignore the lookup as the value will be dynamic
  const value = node.value[token.key];

  let match: undefined | boolean = undefined;

  // if (token.value === undefined) {
  //   match = value === undefined;
  // }

  // if (token.value === null) {
  //   match = value === null;
  // }

  // // @TODO check for the distinction between obj and array here as L78
  // // does not guarantee exact same primitive type in this case
  // if (typeof value !== type && token.value !== null && token.value !== undefined) {
  //   // The two types are not the same.
  //   return false;
  // }

  // prettier-ignore
  switch (token.type) {
    case Token.FREE_TEXT: {
      match = value === token.value || value.includes(token.value);
      break;
    }
    case Token.FILTER: {
      switch(token.filter) {
        case FilterType.SIZE: {
          break;
        }
        case FilterType.NUMERIC: {
          break;
        }
        case FilterType.NUMERIC_IN: {
          break;
        }
        case FilterType.TEXT: {
          break;
        }
        case FilterType.TEXT_IN: {
          break;
        }
        case FilterType.DATE: {
          break;
        }
        case FilterType.AGGREGATE_DATE: {
          break;
        }
        case FilterType.AGGREGATE_DURATION: {
        }
        case FilterType.DURATION: {
          break;
        }
        case FilterType.BOOLEAN: {
          break;
        }
        case FilterType.HAS: {
          break;
        }
        case FilterType.IS: {
          break;
        }
        default: {
          assertNeverType(token.filter)
          break;
        }
      }
      break;
    }
    // case 'number': {
    //   if (!token.operator) {
    //     match = value === token.value;
    //     break;
    //   }

    //   // prettier-ignore
    //   switch (token.operator) {
    //     case 'gt': match = value > token.value; break;
    //     case 'ge': match = value >= token.value; break;
    //     case 'lt': match = value < token.value; break;
    //     case 'le': match = value <= token.value; break;
    //     case 'eq': match = value === token.value; break;
    //     default: break;
    //   }
    //   break;
    // }
    // case 'boolean': {
    //   match = value === token.value;
    //   break;
    // }
    // case 'object': {
    //   return false;
    // }
    default: break;
  }

  if (match === undefined) {
    return false;
  }

  return token ? !match : match;
}

export function evaluateTokensForTraceNode(
  node:
    | TraceTreeNode<TraceTree.NodeValue>
    | ParentAutogroupNode
    | SiblingAutogroupNode
    | NoDataNode,
  tokens: ParseResult
): boolean {
  for (const token of tokens) {
    if (!evaluateTokenForTraceNode(node, token)) {
      return false;
    }
  }

  return true;
}
