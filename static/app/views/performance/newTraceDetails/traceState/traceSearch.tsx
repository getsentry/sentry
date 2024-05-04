import * as Sentry from '@sentry/react';

import {
  type ProcessedTokenResult,
  toPostFix,
} from 'sentry/components/searchSyntax/evaluator';
import {
  BooleanOperator,
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {
  isAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/guards';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {traceReducerExhaustiveActionCheck} from 'sentry/views/performance/newTraceDetails/traceState';

export type TraceSearchResult = {
  index: number;
  value: TraceTreeNode<TraceTree.NodeValue>;
};

export type TraceSearchAction =
  | {query: string | undefined; type: 'set query'}
  | {type: 'go to first match'}
  | {type: 'go to last match'}
  | {type: 'go to next match'}
  | {type: 'go to previous match'}
  | {
      resultIndex: number;
      resultIteratorIndex: number;
      type: 'set search iterator index';
    }
  | {type: 'clear'}
  | {type: 'clear search iterator index'}
  | {type: 'clear query'}
  | {
      node: TraceTreeNode<TraceTree.NodeValue> | null;
      previousNode: {
        resultIndex: number | undefined;
        resultIteratorIndex: number | undefined;
      } | null;
      results: ReadonlyArray<TraceSearchResult>;
      resultsLookup: Map<TraceTreeNode<TraceTree.NodeValue>, number>;
      type: 'set results';
      resultIndex?: number;
      resultIteratorIndex?: number;
    };

export type TraceSearchState = {
  node: TraceTreeNode<TraceTree.NodeValue> | null;
  query: string | undefined;
  // Index in the list/tree
  resultIndex: number | null;
  // Index in the results array
  resultIteratorIndex: number | null;
  results: ReadonlyArray<TraceSearchResult> | null;
  resultsLookup: Map<TraceTreeNode<TraceTree.NodeValue>, number>;
  status: [ts: number, 'loading' | 'success' | 'error'] | undefined;
};

function assertBoundedIndex(index: number, length: number) {
  if (index < 0 || index > length - 1) {
    throw new Error('Search index out of bounds');
  }
}

export function traceSearchReducer(
  state: TraceSearchState,
  action: TraceSearchAction
): TraceSearchState {
  switch (action.type) {
    case 'clear query': {
      return {
        node: null,
        query: undefined,
        resultIteratorIndex: null,
        results: null,
        resultIndex: null,
        resultsLookup: new Map(),
        status: undefined,
      };
    }
    case 'go to first match': {
      if (!state.results || state.results.length === 0) {
        return state;
      }
      return {
        ...state,
        node: state.results[0].value,
        resultIteratorIndex: 0,
        resultIndex: state.results[0].index,
      };
    }
    case 'go to last match': {
      if (!state.results || state.results.length === 0) {
        return state;
      }
      return {
        ...state,
        resultIteratorIndex: state.results.length - 1,
        resultIndex: state.results[state.results.length - 1].index,
        node: state.results[state.results.length - 1].value,
      };
    }
    case 'go to next match': {
      if (state.resultIteratorIndex === null) {
        if (!state.results || state.results.length === 0) {
          return state;
        }
        return {
          ...state,
          resultIteratorIndex: 0,
          resultIndex: state.results[0].index,
          node: state.results[0].value,
        };
      }
      if (!state.results) return state;

      let next = state.resultIteratorIndex + 1;
      if (next > state.results.length - 1) {
        next = 0;
      }

      assertBoundedIndex(next, state.results.length);
      return {
        ...state,
        resultIteratorIndex: next,
        resultIndex: state.results[next].index,
        node: state.results[next].value,
      };
    }
    case 'go to previous match': {
      if (state.resultIteratorIndex === null) {
        if (!state.results || !state.results.length) {
          return state;
        }
        return {
          ...state,
          resultIteratorIndex: state.results.length - 1,
          resultIndex: state.results[state.results.length - 1].index,
          node: state.results[state.results.length - 1].value,
        };
      }
      if (!state.results) return state;

      let previous = state.resultIteratorIndex - 1;
      if (previous < 0) {
        previous = state.results.length - 1;
      }

      assertBoundedIndex(previous, state.results.length);
      return {
        ...state,
        resultIteratorIndex: previous,
        resultIndex: state.results[previous].index,
        node: state.results[previous].value,
      };
    }
    case 'set results': {
      return {
        ...state,
        status: [performance.now(), 'success'],
        results: action.results,
        resultIteratorIndex: action.resultIteratorIndex ?? null,
        node: action.node ?? null,
        resultIndex: action.resultIndex ?? null,
        resultsLookup: action.resultsLookup,
      };
    }
    case 'set query': {
      return {
        ...state,
        status: [performance.now(), 'loading'],
        query: action.query,
      };
    }

    case 'set search iterator index': {
      return {
        ...state,
        node: state.results?.[action.resultIteratorIndex]?.value ?? null,
        resultIteratorIndex: action.resultIteratorIndex,
        resultIndex: action.resultIndex,
      };
    }

    case 'clear search iterator index':
      return {
        ...state,
        resultIteratorIndex: null,
        resultIndex: null,
        node: null,
      };

    case 'clear': {
      return {...state, node: null, resultIteratorIndex: null, resultIndex: null};
    }

    default: {
      traceReducerExhaustiveActionCheck(action);
      return state;
    }
  }
}

/**
 * Evaluates the node based on freetext. This is a simple search that checks if the query
 * is present in a very small subset of the node's properties.
 */
function evaluateNodeFreeText(
  query: string,
  node: TraceTreeNode<TraceTree.NodeValue>
): boolean {
  if (isSpanNode(node)) {
    if (node.value.op?.includes(query)) {
      return true;
    }
    if (node.value.description?.includes(query)) {
      return true;
    }
    if (node.value.span_id && node.value.span_id === query) {
      return true;
    }
  }

  if (isTransactionNode(node)) {
    if (node.value['transaction.op']?.includes(query)) {
      return true;
    }
    if (node.value.transaction?.includes(query)) {
      return true;
    }
    if (node.value.event_id && node.value.event_id === query) {
      return true;
    }
  }

  if (isAutogroupedNode(node)) {
    if (node.value.op?.includes(query)) {
      return true;
    }
    if (node.value.description?.includes(query)) {
      return true;
    }
  }

  if (isTraceErrorNode(node)) {
    if (node.value.level === query) {
      return true;
    }
    if (node.value.title?.includes(query)) {
      return true;
    }
  }

  return false;
}

// Freetext search in the trace tree
export function searchInTraceTreeText(
  tree: TraceTree,
  query: string,
  previousNode: TraceTreeNode<TraceTree.NodeValue> | null,
  cb: (
    results: [
      ReadonlyArray<TraceSearchResult>,
      Map<TraceTreeNode<TraceTree.NodeValue>, number>,
      {resultIndex: number | undefined; resultIteratorIndex: number | undefined} | null,
    ]
  ) => void
): {id: number | null} {
  const handle: {id: number | null} = {id: 0};
  let previousNodeSearchResult: {
    resultIndex: number | undefined;
    resultIteratorIndex: number | undefined;
  } | null = null;
  const results: Array<TraceSearchResult> = [];
  const resultLookup = new Map();

  let i = 0;
  let matchCount = 0;
  const count = tree.list.length;

  function search() {
    const ts = performance.now();
    while (i < count && performance.now() - ts < 12) {
      const node = tree.list[i];

      if (evaluateNodeFreeText(query, node)) {
        results.push({index: i, value: node});
        resultLookup.set(node, matchCount);

        if (previousNode === node) {
          previousNodeSearchResult = {
            resultIndex: i,
            resultIteratorIndex: matchCount,
          };
        }

        matchCount++;
      }
      i++;
    }

    if (i < count) {
      handle.id = requestAnimationFrame(search);
    }

    if (i === count) {
      cb([results, resultLookup, previousNodeSearchResult]);
      handle.id = null;
    }
  }

  handle.id = requestAnimationFrame(search);
  return handle;
}

// @TODO Alias self time, total time.
const DURATION_ALIASES = new Set(['duration']);
// Pulls the value from the node based on the key in the token
function resolveValueFromKey(
  node: TraceTreeNode<TraceTree.NodeValue>,
  token: ProcessedTokenResult
): any | null {
  const value = node.value;

  if (!value) {
    return null;
  }

  if (token.type === Token.FILTER) {
    let key: string | null = null;
    switch (token.key.type) {
      case Token.KEY_SIMPLE: {
        if (DURATION_ALIASES.has(token.key.value) && node.space) {
          return node.space[1];
        }
        key = token.key.value;
        break;
      }
      case Token.KEY_AGGREGATE:
      case Token.KEY_EXPLICIT_TAG:
      default: {
        Sentry.captureMessage(`Unsupported key type for filter, got ${token.key.type}`);
      }
    }

    if (key !== null) {
      // Check for direct key access.
      if (value[key] !== undefined) {
        return value[key];
      }
    }

    return key ? value[key] ?? null : null;
  }

  return null;
}

function evaluateValueNumber<T extends Token.VALUE_DURATION | Token.VALUE_NUMBER>(
  token: TokenResult<T>,
  operator: TermOperator,
  value: any
): boolean {
  // @TODO Figure out if it's possible that we receive NaN/Infinity values
  // and how we should handle them.
  if (!token.parsed || typeof value !== 'number') {
    return false;
  }

  const query = token.parsed.value;

  switch (operator) {
    case TermOperator.GREATER_THAN:
      return value > query;
    case TermOperator.GREATER_THAN_EQUAL:
      return value >= query;
    case TermOperator.LESS_THAN:
      return value < query;
    case TermOperator.LESS_THAN_EQUAL:
      return value <= query;
    case TermOperator.EQUAL:
    case TermOperator.DEFAULT: {
      return value === query;
    }
    default: {
      Sentry.captureMessage('Unsupported operator for number filter, got ' + operator);
      return false;
    }
  }
}

function evaluateValueDate<T extends Token.VALUE_ISO_8601_DATE>(
  token: TokenResult<T>,
  operator: TermOperator,
  value: any
): boolean {
  if (!token.parsed || (typeof value !== 'number' && typeof value !== 'string')) {
    return false;
  }

  if (typeof value === 'string') {
    value = new Date(value).getTime();
    if (isNaN(value)) return false;
  }

  const query = token.parsed.value.getTime();

  switch (operator) {
    case TermOperator.GREATER_THAN:
      return value > query;
    case TermOperator.GREATER_THAN_EQUAL:
      return value >= query;
    case TermOperator.LESS_THAN:
      return value < query;
    case TermOperator.LESS_THAN_EQUAL:
      return value <= query;
    case TermOperator.EQUAL:
    case TermOperator.DEFAULT: {
      return value === query;
    }
    default: {
      Sentry.captureMessage('Unsupported operator for number filter, got ' + operator);
      return false;
    }
  }
}

function booleanResult(
  left: Map<TraceTreeNode<TraceTree.NodeValue>, number>,
  right: Map<TraceTreeNode<TraceTree.NodeValue>, number>,
  operator: BooleanOperator
): Map<TraceTreeNode<TraceTree.NodeValue>, number> {
  if (operator === BooleanOperator.AND) {
    const result = new Map();
    for (const [key, value] of left) {
      right.has(key) && result.set(key, value);
    }
    return result;
  }

  if (operator === BooleanOperator.OR) {
    const result = new Map(left);
    for (const [key, value] of right) {
      result.set(key, value);
    }
    return result;
  }

  throw new Error(`Unsupported boolean operator, received ${operator}`);
}

function evaluateTokenForValue(token: ProcessedTokenResult, value: any): boolean {
  if (token.type === Token.FILTER) {
    if (token.value.type === Token.VALUE_NUMBER) {
      const result = evaluateValueNumber(token.value, token.operator, value);
      return token.negated ? !result : result;
    }
    if (token.value.type === Token.VALUE_DURATION) {
      const result = evaluateValueNumber(token.value, token.operator, value);
      return token.negated ? !result : result;
    }
    if (token.value.type === Token.VALUE_TEXT) {
      return typeof value === 'string' && value.includes(token.value.value);
    }
    if (token.value.type === Token.VALUE_ISO_8601_DATE) {
      return (
        typeof value === 'number' && evaluateValueDate(token.value, token.operator, value)
      );
    }
  }

  return false;
}

/**
 * Evaluates the infix token representation against the token list. The logic is the same as
 * if we were evaluating arithmetics expressions with the caveat that we have to handle and edge
 * case the first time we evaluate two operands. Because our list contains tokens and not values,
 * we need to evaluate the first two tokens, push the result back to the stack. From there on we can
 * evaluate the rest of the tokens.
 * [token, token, bool logic] -> [] -> [result, token, bool]
 *   ^evaluate^ and push to stack        ^ left  ^ right ^ operator
 * All next evaluations will be done with the result and the next token.
 */
export function searchInTraceTreeTokens(
  tree: TraceTree,
  tokens: TokenResult<Token>[],
  previousNode: TraceTreeNode<TraceTree.NodeValue> | null,
  cb: (
    results: [
      ReadonlyArray<TraceSearchResult>,
      Map<TraceTreeNode<TraceTree.NodeValue>, number>,
      {resultIndex: number | undefined; resultIteratorIndex: number | undefined} | null,
    ]
  ) => void
): {id: number | null} {
  let previousNodeSearchResult: {
    resultIndex: number | undefined;
    resultIteratorIndex: number | undefined;
  } | null = null;
  const handle: {id: number | null} = {id: 0};
  const resultLookup = new Map();
  const postfix = toPostFix(tokens);

  if (postfix.length <= 1 && postfix[0].type === Token.FREE_TEXT) {
    return searchInTraceTreeText(tree, postfix[0].value, previousNode, cb);
  }

  let i = 0;
  let matchCount = 0;
  const count = tree.list.length;
  const resultsForSingleToken: TraceSearchResult[] = [];

  function searchSingleToken() {
    const ts = performance.now();
    while (i < count && performance.now() - ts < 12) {
      const node = tree.list[i];
      if (evaluateTokenForValue(postfix[0], resolveValueFromKey(node, postfix[0]))) {
        resultsForSingleToken.push({index: i, value: node});
        resultLookup.set(node, matchCount);

        if (previousNode === node) {
          previousNodeSearchResult = {
            resultIndex: i,
            resultIteratorIndex: matchCount,
          };
        }
        matchCount++;
      }
      i++;
    }

    if (i < count) {
      handle.id = requestAnimationFrame(searchSingleToken);
    } else {
      cb([resultsForSingleToken, resultLookup, previousNodeSearchResult]);
    }
  }

  if (postfix.length <= 1 && postfix[0].type === Token.FILTER) {
    handle.id = requestAnimationFrame(searchSingleToken);
    return handle;
  }

  let result_map: Map<TraceTreeNode<TraceTree.NodeValue>, number> = new Map();

  let ti = 0;
  let li = 0;
  let ri = 0;

  let bool: TokenResult<Token.LOGIC_BOOLEAN> | null = null;
  let leftToken:
    | ProcessedTokenResult
    | Map<TraceTreeNode<TraceTree.NodeValue>, number>
    | null = null;
  let rightToken: ProcessedTokenResult | null = null;

  const left: Map<TraceTreeNode<TraceTree.NodeValue>, number> = new Map();
  const right: Map<TraceTreeNode<TraceTree.NodeValue>, number> = new Map();

  const stack: (
    | ProcessedTokenResult
    | Map<TraceTreeNode<TraceTree.NodeValue>, number>
  )[] = [];

  function search(): void {
    const ts = performance.now();
    if (!bool) {
      while (ti < postfix.length) {
        const token = postfix[ti];
        if (token.type === Token.LOGIC_BOOLEAN) {
          bool = token;
          if (stack.length < 2) {
            Sentry.captureMessage('Unbalanced tree - missing left or right token');
            typeof handle.id === 'number' && window.cancelAnimationFrame(handle.id);
            cb([[], resultLookup, null]);
            return;
          }
          // @ts-expect-error the type guard is handled and expected
          rightToken = stack.pop()!;
          leftToken = stack.pop()!;
          break;
        } else {
          stack.push(token);
        }
        ti++;
      }
    }

    if (!bool) {
      Sentry.captureMessage(
        'Invalid state in searchInTraceTreeTokens, missing boolean token'
      );
      typeof handle.id === 'number' && window.cancelAnimationFrame(handle.id);
      cb([[], resultLookup, null]);
      return;
    }
    if (!leftToken || !rightToken) {
      Sentry.captureMessage(
        'Invalid state in searchInTraceTreeTokens, missing left or right token'
      );
      typeof handle.id === 'number' && window.cancelAnimationFrame(handle.id);
      cb([[], resultLookup, null]);
      return;
    }

    if (li < count && !(leftToken instanceof Map)) {
      while (li < count && performance.now() - ts < 12) {
        const node = tree.list[li];
        if (evaluateTokenForValue(leftToken, resolveValueFromKey(node, leftToken))) {
          left.set(node, li);
        }
        li++;
      }
      handle.id = requestAnimationFrame(search);
    } else if (ri < count && !(rightToken instanceof Map)) {
      while (ri < count && performance.now() - ts < 12) {
        const node = tree.list[ri];
        if (evaluateTokenForValue(rightToken, resolveValueFromKey(node, rightToken))) {
          right.set(node, ri);
        }
        ri++;
      }
      handle.id = requestAnimationFrame(search);
    } else {
      if (
        (li === count || leftToken instanceof Map) &&
        (ri === count || rightToken instanceof Map)
      ) {
        result_map = booleanResult(
          leftToken instanceof Map ? leftToken : left,
          rightToken instanceof Map ? rightToken : right,
          bool.value
        );

        // Reset the state for the next iteration
        bool = null;
        leftToken = null;
        rightToken = null;
        left.clear();
        right.clear();
        li = 0;
        ri = 0;

        // Push result to stack;
        stack.push(result_map);
        ti++;
      }

      if (ti === postfix.length) {
        const result: TraceSearchResult[] = [];
        let resultIdx = -1;

        // @TODO We render up to 10k nodes and plan to load more, so this might be future bottleneck.
        for (const [node, index] of result_map) {
          result.push({index, value: node});
          resultLookup.set(node, ++resultIdx);
          if (previousNode === node) {
            previousNodeSearchResult = {
              resultIndex: index,
              resultIteratorIndex: resultIdx,
            };
          }
        }

        cb([result, resultLookup, previousNodeSearchResult]);
      } else {
        handle.id = requestAnimationFrame(search);
      }
    }
  }

  handle.id = requestAnimationFrame(search);
  return handle;
}
