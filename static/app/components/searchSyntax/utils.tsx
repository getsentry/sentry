import {Token, TokenConverter, TokenResult} from './parser';

/**
 * Utility function to visit every Token node within an AST tree and apply
 * a transform to those nodes.
 */
export function treeTransformer(
  tree: TokenResult<Token>[],
  transform: (token: TokenResult<Token>) => any
) {
  const nodeVisitor = (token: TokenResult<Token>) => {
    switch (token.type) {
      case Token.Filter:
        return transform({
          ...token,
          key: nodeVisitor(token.key),
          value: nodeVisitor(token.value),
        });
      case Token.KeyExplicitTag:
        return transform({
          ...token,
          key: nodeVisitor(token.key),
        });
      case Token.KeyAggregate:
        return transform({
          ...token,
          name: nodeVisitor(token.name),
          args: token.args ? nodeVisitor(token.args) : token.args,
          argsSpaceBefore: nodeVisitor(token.argsSpaceBefore),
          argsSpaceAfter: nodeVisitor(token.argsSpaceAfter),
        });
      case Token.LogicGroup:
        return transform({
          ...token,
          inner: token.inner.map(nodeVisitor),
        });
      case Token.KeyAggregateArgs:
        return transform({
          ...token,
          args: token.args.map(v => ({...v, value: nodeVisitor(v.value)})),
        });
      case Token.ValueNumberList:
      case Token.ValueTextList:
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
  aggregateWithArgs?: boolean;
};

/**
 * Utility to get the string name of any type of key.
 */
export const getKeyName = (
  key: ReturnType<
    TokenConverter['tokenKeySimple' | 'tokenKeyExplicitTag' | 'tokenKeyAggregate']
  >,
  options?: GetKeyNameOpts
) => {
  const {aggregateWithArgs} = options ?? {};
  switch (key.type) {
    case Token.KeySimple:
      return key.value;
    case Token.KeyExplicitTag:
      return key.key.value;
    case Token.KeyAggregate:
      return aggregateWithArgs
        ? `${key.name.value}(${key.args ? key.args.text : ''})`
        : key.name.value;
    default:
      return '';
  }
};
