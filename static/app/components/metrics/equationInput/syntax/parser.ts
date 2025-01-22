import type {
  Token,
  TokenList,
} from 'sentry/components/metrics/equationInput/syntax/types';

import grammar from './equation.pegjs';

type TokenTree = (Token | TokenTree)[];

export function parseFormula(formula: string): TokenList {
  const tree = grammar.parse(formula) as TokenTree;
  return (
    treeToList(tree)
      // Remove empty (optional) tokens
      .filter(Boolean)
  );
}

export function joinTokens(tokens: TokenList): string {
  return tokens.map(token => token.content).join('');
}

function treeToList(tree: TokenTree): TokenList {
  return tree.reduce<TokenList>((acc, token) => {
    if (Array.isArray(token)) {
      return acc.concat(treeToList(token));
    }
    return acc.concat(token);
  }, []);
}
