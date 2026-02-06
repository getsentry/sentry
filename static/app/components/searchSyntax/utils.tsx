import type {LocationRange} from 'peggy';

import {
  Token,
  wildcardOperators,
  type TokenResult,
  type WildcardOperator,
} from './parser';

/**
 * Used internally within treeResultLocator to stop recursion once we've
 * located a matched result.
 */
class TokenResultFoundError extends Error {
  result: any;

  constructor(result: any) {
    super();
    this.name = 'TokenResultFoundError';
    this.result = result;
  }
}

/**
 * Used as the marker to skip token traversal in treeResultLocator
 */
const skipTokenMarker = Symbol('Returned to skip visiting a token');

type VisitorFn = (opts: {
  /**
   * Call this to return the provided value as the result of treeResultLocator
   */
  returnResult: (result: any) => TokenResultFoundError;
  /**
   * Return this to skip visiting any inner tokens
   */
  skipToken: typeof skipTokenMarker;
  /**
   * The token being visited
   */
  token: TokenResult<Token>;
}) => null | TokenResultFoundError | typeof skipTokenMarker;

type TreeResultLocatorOpts = {
  /**
   * The value to return when returnValue was never called and all nodes of the
   * search tree were visited.
   */
  noResultValue: any;
  /**
   * The tree to visit
   */
  tree: Array<TokenResult<Token>>;
  /**
   * A function used to check if we've found the result in the node we're
   * visiting. May also indicate that we want to skip any further traversal of
   * inner nodes.
   */
  visitorTest: VisitorFn;
};

/**
 * Utility function to visit every Token node within an AST tree (in DFS order)
 * and apply a test method that may choose to return some value from that node.
 *
 * You must call the `returnValue` method for a result to be returned.
 *
 * When returnValue is never called and all nodes of the search tree have been
 * visited the noResultValue will be returned.
 */
export function treeResultLocator<T>({
  tree,
  visitorTest,
  noResultValue,
}: TreeResultLocatorOpts): T {
  const returnResult = (result: any) => new TokenResultFoundError(result);

  const nodeVisitor = (token: TokenResult<Token> | null) => {
    if (token === null) {
      return;
    }

    const result = visitorTest({token, returnResult, skipToken: skipTokenMarker});

    // Bubble the result back up.
    //
    // XXX: Using a throw here is a bit easier than threading the return value
    // back up through the recursive call tree.
    if (result instanceof TokenResultFoundError) {
      throw result;
    }

    // Don't traverse into any nested tokens
    if (result === skipTokenMarker) {
      return;
    }

    switch (token.type) {
      case Token.FILTER:
        nodeVisitor(token.key);
        nodeVisitor(token.value);
        break;
      case Token.KEY_EXPLICIT_TAG:
        nodeVisitor(token.key);
        break;
      case Token.KEY_EXPLICIT_FLAG:
        nodeVisitor(token.key);
        break;
      case Token.KEY_AGGREGATE:
        nodeVisitor(token.name);
        if (token.args) {
          nodeVisitor(token.args);
        }
        nodeVisitor(token.argsSpaceBefore);
        nodeVisitor(token.argsSpaceAfter);
        break;
      case Token.KEY_EXPLICIT_NUMBER_TAG:
        nodeVisitor(token.key);
        break;
      case Token.KEY_EXPLICIT_STRING_TAG:
        nodeVisitor(token.key);
        break;
      case Token.KEY_EXPLICIT_BOOLEAN_TAG:
        nodeVisitor(token.key);
        break;
      case Token.KEY_EXPLICIT_NUMBER_FLAG:
        nodeVisitor(token.key);
        break;
      case Token.KEY_EXPLICIT_STRING_FLAG:
        nodeVisitor(token.key);
        break;
      case Token.LOGIC_GROUP:
        token.inner.forEach(nodeVisitor);
        break;
      case Token.KEY_AGGREGATE_ARGS:
        token.args.forEach(v => nodeVisitor(v.value));
        break;
      case Token.VALUE_NUMBER_LIST:
      case Token.VALUE_TEXT_LIST:
        token.items.forEach((v: any) => nodeVisitor(v.value));
        break;
      default:
    }
  };

  try {
    tree.forEach(nodeVisitor);
  } catch (error) {
    if (error instanceof TokenResultFoundError) {
      return error.result;
    }

    throw error;
  }

  return noResultValue;
}

type GetKeyNameOpts = {
  /**
   * Include arguments in aggregate key names
   */
  aggregateWithArgs?: boolean;
};

/**
 * Utility to get the internal string name of any type of key.
 * Used to do lookups and is the underlying value that should
 * be passed through to the API.
 */
export const getKeyName = (
  key: TokenResult<
    | Token.KEY_SIMPLE
    | Token.KEY_EXPLICIT_TAG
    | Token.KEY_AGGREGATE
    | Token.KEY_EXPLICIT_BOOLEAN_TAG
    | Token.KEY_EXPLICIT_NUMBER_TAG
    | Token.KEY_EXPLICIT_STRING_TAG
    | Token.KEY_EXPLICIT_FLAG
    | Token.KEY_EXPLICIT_NUMBER_FLAG
    | Token.KEY_EXPLICIT_STRING_FLAG
  >,
  options: GetKeyNameOpts = {}
) => {
  const {aggregateWithArgs} = options;
  switch (key.type) {
    case Token.KEY_SIMPLE:
      return key.value;
    case Token.KEY_EXPLICIT_TAG:
      return key.key.value;
    case Token.KEY_AGGREGATE:
      return aggregateWithArgs
        ? `${key.name.value}(${key.args ? key.args.text : ''})`
        : key.name.value;
    case Token.KEY_EXPLICIT_BOOLEAN_TAG:
      return key.text;
    case Token.KEY_EXPLICIT_NUMBER_TAG:
      return key.text;
    case Token.KEY_EXPLICIT_STRING_TAG:
      return key.text;
    case Token.KEY_EXPLICIT_FLAG:
      return key.text;
    case Token.KEY_EXPLICIT_NUMBER_FLAG:
      return key.text;
    case Token.KEY_EXPLICIT_STRING_FLAG:
      return key.text;
    default:
      return '';
  }
};

/**
 * Utility to get the public facing label of any type of key.
 * Used to format a key in a user friendly way. This value
 * should only be used for display, and not passed to the API.
 * For the value to use in the API, see `getKeyName`.
 */
export const getKeyLabel = (
  key: TokenResult<
    | Token.KEY_SIMPLE
    | Token.KEY_EXPLICIT_TAG
    | Token.KEY_AGGREGATE
    | Token.KEY_EXPLICIT_BOOLEAN_TAG
    | Token.KEY_EXPLICIT_NUMBER_TAG
    | Token.KEY_EXPLICIT_STRING_TAG
    | Token.KEY_EXPLICIT_FLAG
    | Token.KEY_EXPLICIT_NUMBER_FLAG
    | Token.KEY_EXPLICIT_STRING_FLAG
  >
) => {
  switch (key.type) {
    case Token.KEY_SIMPLE:
      return key.value;
    case Token.KEY_EXPLICIT_TAG:
      return key.text;
    case Token.KEY_AGGREGATE:
      return key.name.value;
    case Token.KEY_EXPLICIT_BOOLEAN_TAG:
      return key.key.value;
    case Token.KEY_EXPLICIT_NUMBER_TAG:
      return key.key.value;
    case Token.KEY_EXPLICIT_STRING_TAG:
      return key.key.value;
    case Token.KEY_EXPLICIT_FLAG:
      return key.text;
    case Token.KEY_EXPLICIT_NUMBER_FLAG:
      return key.text;
    case Token.KEY_EXPLICIT_STRING_FLAG:
      return key.text;
    default:
      return '';
  }
};

export function isWithinToken(
  node: {location: LocationRange} | null | undefined,
  position: number
) {
  if (!node) {
    return false;
  }

  return position >= node.location.start.offset && position <= node.location.end.offset;
}

function stringifyTokenFilter(token: TokenResult<Token.FILTER>) {
  let stringifiedToken = '';

  if (token.negated) {
    stringifiedToken += '!';
  }

  stringifiedToken += stringifyToken(token.key);
  stringifiedToken += ':';

  stringifiedToken += token.operator;
  stringifiedToken += stringifyToken(token.value);

  return stringifiedToken;
}

export function isWildcardOperator(value: unknown): value is WildcardOperator {
  return wildcardOperators.includes(value as never);
}

export function stringifyToken(token: TokenResult<Token>): string {
  switch (token.type) {
    case Token.FREE_TEXT:
    case Token.SPACES:
      return token.value;
    case Token.FILTER:
      return stringifyTokenFilter(token);
    case Token.LOGIC_GROUP:
      return `(${token.inner.map(innerToken => stringifyToken(innerToken)).join(' ')})`;
    case Token.LOGIC_BOOLEAN:
      return token.value;
    case Token.VALUE_TEXT_LIST: {
      const textListItems = token.items
        .map(item => {
          if (item.value?.value) {
            return item.value.quoted ? `"${item.value.value}"` : item.value.value;
          }
          return '';
        })
        .filter(text => text.length > 0);
      return `[${textListItems.join(',')}]`;
    }
    case Token.VALUE_NUMBER_LIST: {
      const numberListItems = token.items
        .map(item => (item.value ? item.value.value + (item.value.unit ?? '') : ''))
        .filter(str => str.length > 0);
      return `[${numberListItems.join(',')}]`;
    }
    case Token.KEY_SIMPLE:
      return token.value;
    case Token.KEY_AGGREGATE:
      return token.text;
    case Token.KEY_AGGREGATE_ARGS:
      return token.text;
    case Token.KEY_AGGREGATE_PARAMS:
      return token.text;
    case Token.KEY_EXPLICIT_TAG:
      return `${token.prefix}[${token.key.value}]`;
    case Token.KEY_EXPLICIT_BOOLEAN_TAG:
      return `${token.prefix}[${token.key.value},boolean]`;
    case Token.KEY_EXPLICIT_NUMBER_TAG:
      return `${token.prefix}[${token.key.value},number]`;
    case Token.KEY_EXPLICIT_STRING_TAG:
      return `${token.prefix}[${token.key.value},string]`;
    case Token.KEY_EXPLICIT_FLAG:
      return `flags[${token.key.value}]`;
    case Token.KEY_EXPLICIT_NUMBER_FLAG:
      return `flags[${token.key.value},number]`;
    case Token.KEY_EXPLICIT_STRING_FLAG:
      return `flags[${token.key.value},string]`;
    case Token.VALUE_TEXT:
      return token.quoted ? `"${token.value}"` : token.value;
    case Token.VALUE_RELATIVE_DATE:
      return `${token.sign}${token.value}${token.unit}`;
    case Token.VALUE_BOOLEAN:
    case Token.VALUE_DURATION:
    case Token.VALUE_ISO_8601_DATE:
    case Token.VALUE_PERCENTAGE:
    case Token.VALUE_SIZE:
    case Token.VALUE_NUMBER:
      return token.text;
    default:
      return '';
  }
}
