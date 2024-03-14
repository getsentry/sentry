import type {Token, TokenList} from 'sentry/views/ddm/formulaParser/types';

import grammar from './formula.pegjs';

type TokenTree = Array<Token | TokenTree>;

export function parseFormula(formula: string): TokenList {
  const tree = grammar.parse(formula) as TokenTree;
  return treeToList(tree);
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
