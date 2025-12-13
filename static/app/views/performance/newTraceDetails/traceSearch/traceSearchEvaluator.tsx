import * as Sentry from '@sentry/react';

import {
  toPostFix,
  type ProcessedTokenResult,
} from 'sentry/components/searchSyntax/evaluator';
import {
  BooleanOperator,
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {defined} from 'sentry/utils';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

export type TraceSearchResult = {
  index: number;
  value: BaseNode;
};

const {info, fmt} = Sentry.logger;

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
  tokens: Array<TokenResult<Token>>,
  previousNode: BaseNode | null,
  cb: (
    results: [
      readonly TraceSearchResult[],
      Map<BaseNode, number>,
      {resultIndex: number | undefined; resultIteratorIndex: number | undefined} | null,
    ]
  ) => void
): {id: number | null} {
  let previousNodeSearchResult: {
    resultIndex: number | undefined;
    resultIteratorIndex: number | undefined;
  } | null = null;
  if (!tokens || tokens.length === 0) {
    cb([[], new Map(), null]);
    return {id: null};
  }

  const handle: {id: number | null} = {id: 0};
  const resultLookup = new Map();
  const postfix = toPostFix(tokens);

  if (postfix.length === 0) {
    cb([[], resultLookup, null]);
    return handle;
  }

  if (postfix.length === 1 && postfix[0]!.type === Token.FREE_TEXT) {
    return searchInTraceTreeText(tree, postfix[0]!.value, previousNode, cb);
  }

  let i = 0;
  let matchCount = 0;
  const resultsForSingleToken: TraceSearchResult[] = [];

  function searchSingleToken() {
    // TODO Abdullah Khan: This implementation can be optimized;
    // it should be possible to achieve the desired outcome in a single traversal.
    // Currently, we first enforce that any matching node is visible, then we compute the results.
    // Just have to figure out how to track the indices of the nodes as enforceVisibility adds new nodes
    // to the visible list.s
    enforceVisibilityForAllMatches(tree, node =>
      evaluateTokenForValue(postfix[0]!, resolveValueFromKey(node, postfix[0]!))
    );

    const count = tree.list.length;
    const ts = performance.now();
    while (i < count && performance.now() - ts < 12) {
      const node = tree.list[i]!;
      if (evaluateTokenForValue(postfix[0]!, resolveValueFromKey(node, postfix[0]!))) {
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

  if (postfix.length <= 1 && postfix[0]!.type === Token.FILTER) {
    handle.id = requestAnimationFrame(searchSingleToken);
    return handle;
  }

  let result_map: Map<BaseNode, number> = new Map();

  let ti = 0;
  let li = 0;
  let ri = 0;

  let bool: TokenResult<Token.LOGIC_BOOLEAN> | null = null;
  let leftToken: ProcessedTokenResult | Map<BaseNode, number> | null = null;
  let rightToken: ProcessedTokenResult | null = null;

  const left: Map<BaseNode, number> = new Map();
  const right: Map<BaseNode, number> = new Map();

  const stack: Array<ProcessedTokenResult | Map<BaseNode, number>> = [];

  function search(): void {
    const ts = performance.now();
    if (!bool) {
      while (ti < postfix.length) {
        const token = postfix[ti]!;
        if (token.type === Token.LOGIC_BOOLEAN) {
          bool = token;
          if (stack.length < 2) {
            Sentry.captureMessage('Unbalanced tree - missing left or right token');
            info(fmt`Unbalanced tree - missing left or right token`);
            if (typeof handle.id === 'number') {
              window.cancelAnimationFrame(handle.id);
            }
            cb([[], resultLookup, null]);
            return;
          }
          // @ts-expect-error TS(2322): Type 'Map<TraceTreeNode<NodeValue>, number> | Proc... Remove this comment to see the full error message
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
      info(fmt`Invalid state in searchInTraceTreeTokens, missing boolean token`);
      if (typeof handle.id === 'number') {
        window.cancelAnimationFrame(handle.id);
      }
      cb([[], resultLookup, null]);
      return;
    }
    if (!leftToken || !rightToken) {
      Sentry.captureMessage(
        'Invalid state in searchInTraceTreeTokens, missing left or right token'
      );
      info(fmt`Invalid state in searchInTraceTreeTokens, missing left or right token`);
      if (typeof handle.id === 'number') {
        window.cancelAnimationFrame(handle.id);
      }
      cb([[], resultLookup, null]);
      return;
    }

    if (li < tree.list.length && !(leftToken instanceof Map)) {
      const token = leftToken;
      enforceVisibilityForAllMatches(tree, node =>
        evaluateTokenForValue(token, resolveValueFromKey(node, token))
      );

      while (li < tree.list.length && performance.now() - ts < 12) {
        const node = tree.list[li]!;
        if (evaluateTokenForValue(token, resolveValueFromKey(node, token))) {
          left.set(node, li);
        }
        li++;
      }
      handle.id = requestAnimationFrame(search);
    } else if (ri < tree.list.length && !(rightToken instanceof Map)) {
      const token = rightToken;
      enforceVisibilityForAllMatches(tree, node =>
        evaluateTokenForValue(token, resolveValueFromKey(node, token))
      );

      while (ri < tree.list.length && performance.now() - ts < 12) {
        const node = tree.list[ri]!;
        if (evaluateTokenForValue(token, resolveValueFromKey(node, token))) {
          right.set(node, ri);
        }
        ri++;
      }
      handle.id = requestAnimationFrame(search);
    } else {
      if (
        (li === tree.list.length || leftToken instanceof Map) &&
        (ri === tree.list.length || rightToken instanceof Map)
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

// Freetext search in the trace tree
export function searchInTraceTreeText(
  tree: TraceTree,
  query: string,
  previousNode: BaseNode | null,
  cb: (
    results: [
      readonly TraceSearchResult[],
      Map<BaseNode, number>,
      {resultIndex: number | undefined; resultIteratorIndex: number | undefined} | null,
    ]
  ) => void
): {id: number | null} {
  const handle: {id: number | null} = {id: 0};
  let previousNodeSearchResult: {
    resultIndex: number | undefined;
    resultIteratorIndex: number | undefined;
  } | null = null;
  const results: TraceSearchResult[] = [];
  const resultLookup = new Map();

  let i = 0;
  let matchCount = 0;

  function search() {
    enforceVisibilityForAllMatches(tree, node => node.matchWithFreeText(query));

    const count = tree.list.length;
    const ts = performance.now();
    while (i < count && performance.now() - ts < 12) {
      const node = tree.list[i]!;

      if (node.matchWithFreeText(query)) {
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
      switch (typeof value) {
        case 'string':
          return token.negated
            ? !value.includes(token.value.value)
            : value.includes(token.value.value);
        case 'boolean':
          return token.negated ? !value : !!value;
        default:
          return false;
      }
    }
    if (token.value.type === Token.VALUE_ISO_8601_DATE) {
      return (
        typeof value === 'number' && evaluateValueDate(token.value, token.operator, value)
      );
    }
  }

  return false;
}

function booleanResult(
  left: Map<BaseNode, number>,
  right: Map<BaseNode, number>,
  operator: BooleanOperator
): Map<BaseNode, number> {
  if (operator === BooleanOperator.AND) {
    const result = new Map();
    for (const [key, value] of left) {
      if (right.has(key)) {
        result.set(key, value);
      }
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
    if (isNaN(value)) {
      return false;
    }
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
      info(fmt`Unsupported operator for number filter, got ${operator}`);
      return false;
    }
  }
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
      info(fmt`Unsupported operator for number filter, got ${operator}`);
      return false;
    }
  }
}

// Pulls the value from the node based on the key in the token
function resolveValueFromKey(node: BaseNode, token: ProcessedTokenResult): any | null {
  const value = node.value;

  if (!value) {
    return null;
  }

  if (token.type === Token.FILTER) {
    let key: string | null = null;
    switch (token.key.type) {
      case Token.KEY_SIMPLE: {
        const customValue = node.resolveValueFromSearchKey(token.key.value);
        if (defined(customValue)) {
          return customValue;
        }

        key = token.key.value;
        break;
      }
      case Token.KEY_AGGREGATE:
      case Token.KEY_EXPLICIT_TAG:
      default: {
        Sentry.captureMessage(`Unsupported key type for filter, got ${token.key.type}`);
        info(fmt`Unsupported key type for filter, got ${token.key.type}`);
      }
    }

    if (key !== null) {
      // If the value can be accessed directly, do so,
      // else check if the key is an entity key, sanitize it and try direct access again.
      // @TODO support deep nested keys with dot notation
      if (
        key === 'has' &&
        token.type === Token.FILTER &&
        token.value.type === Token.VALUE_TEXT
      ) {
        switch (token.value.text) {
          case 'error':
          case 'errors': {
            return node.hasErrors;
          }
          case 'issue':
          case 'issues':
            return node.hasIssues;
          case 'profile':
          case 'profiles':
            return node.hasProfiles;
          default: {
            break;
          }
        }
      }

      // Aliases for fields that do not exist on raw data
      if (key === 'project' || key === 'project.name') {
        // project.name and project fields do not exist on raw data and are
        // aliases for project_slug key that does exist.
        key = 'project_slug';
      }

      // Check for direct key access.
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      if (value[key] !== undefined) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        return value[key];
      }
    }

    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return key ? (value[key] ?? null) : null;
  }

  return null;
}

function enforceVisibilityForAllMatches(
  tree: TraceTree,
  predicate: (node: BaseNode) => boolean
): void {
  tree.root.forEachChild(node => {
    if (predicate(node)) {
      TraceTree.EnforceVisibility(tree, node);
    }
  });
  tree.build();
}
