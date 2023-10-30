import {LocationRange} from 'pegjs';

import {allOperators, Token, TokenResult} from './parser';

/**
 * Used internally within treeResultLocator to stop recursion once we've
 * located a matched result.
 */
class TokenResultFound extends Error {
  result: any;

  constructor(result: any) {
    super();
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
  returnResult: (result: any) => TokenResultFound;
  /**
   * Return this to skip visiting any inner tokens
   */
  skipToken: typeof skipTokenMarker;
  /**
   * The token being visited
   */
  token: TokenResult<Token>;
}) => null | TokenResultFound | typeof skipTokenMarker;

type TreeResultLocatorOpts = {
  /**
   * The value to return when returnValue was never called and all nodes of the
   * search tree were visited.
   */
  noResultValue: any;
  /**
   * The tree to visit
   */
  tree: TokenResult<Token>[];
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
  const returnResult = (result: any) => new TokenResultFound(result);

  const nodeVisitor = (token: TokenResult<Token> | null) => {
    if (token === null) {
      return;
    }

    const result = visitorTest({token, returnResult, skipToken: skipTokenMarker});

    // Bubble the result back up.
    //
    // XXX: Using a throw here is a bit easier than threading the return value
    // back up through the recursive call tree.
    if (result instanceof TokenResultFound) {
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
      case Token.KEY_AGGREGATE:
        nodeVisitor(token.name);
        token.args && nodeVisitor(token.args);
        nodeVisitor(token.argsSpaceBefore);
        nodeVisitor(token.argsSpaceAfter);
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
    if (error instanceof TokenResultFound) {
      return error.result;
    }

    throw error;
  }

  return noResultValue;
}

type TreeTransformerOpts = {
  /**
   * The function used to transform each node
   */
  transform: (token: TokenResult<Token>) => any;
  /**
   * The tree to transform
   */
  tree: TokenResult<Token>[];
};

/**
 * Utility function to visit every Token node within an AST tree and apply
 * a transform to those nodes.
 */
export function treeTransformer({tree, transform}: TreeTransformerOpts) {
  const nodeVisitor = (token: TokenResult<Token> | null) => {
    if (token === null) {
      return null;
    }

    switch (token.type) {
      case Token.FILTER:
        return transform({
          ...token,
          key: nodeVisitor(token.key),
          value: nodeVisitor(token.value),
        });
      case Token.KEY_EXPLICIT_TAG:
        return transform({
          ...token,
          key: nodeVisitor(token.key),
        });
      case Token.KEY_AGGREGATE:
        return transform({
          ...token,
          name: nodeVisitor(token.name),
          args: token.args ? nodeVisitor(token.args) : token.args,
          argsSpaceBefore: nodeVisitor(token.argsSpaceBefore),
          argsSpaceAfter: nodeVisitor(token.argsSpaceAfter),
        });
      case Token.LOGIC_GROUP:
        return transform({
          ...token,
          inner: token.inner.map(nodeVisitor),
        });
      case Token.KEY_AGGREGATE_ARGS:
        return transform({
          ...token,
          args: token.args.map(v => ({...v, value: nodeVisitor(v.value)})),
        });
      case Token.VALUE_NUMBER_LIST:
      case Token.VALUE_TEXT_LIST:
        return transform({
          ...token,
          // TODO(ts): Not sure why `v` cannot be inferred here
          items: token.items.map((v: any) => ({...v, value: nodeVisitor(v.value)})),
        });

      default:
        return transform(token);
    }
  };

  return tree.map(nodeVisitor);
}

type GetKeyNameOpts = {
  /**
   * Include arguments in aggregate key names
   */
  aggregateWithArgs?: boolean;
};

/**
 * Utility to get the string name of any type of key.
 */
export const getKeyName = (
  key: TokenResult<Token.KEY_SIMPLE | Token.KEY_EXPLICIT_TAG | Token.KEY_AGGREGATE>,
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

export function isOperator(value: string) {
  return allOperators.some(op => op === value);
}
