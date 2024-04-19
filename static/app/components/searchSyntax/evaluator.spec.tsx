import {flattenTokenTree} from 'sentry/components/searchSyntax/evaluator';
import {
  parseSearch,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';

const tokensToString = (tokens: TokenResult<Token>[]): string => {
  let str = '';

  for (const token of tokens) {
    switch (token.type) {
      case Token.FREE_TEXT:
        str += token.text;
        break;
      case Token.SPACES:
        str += 'space';
        break;
      case Token.VALUE_DURATION:
      case Token.VALUE_BOOLEAN:
      case Token.VALUE_NUMBER:
      case Token.VALUE_SIZE:
      case Token.VALUE_PERCENTAGE:
      case Token.VALUE_TEXT:
      case Token.VALUE_ISO_8601_DATE:
      case Token.VALUE_RELATIVE_DATE:
        str += token.value;
        break;
      case Token.LOGIC_BOOLEAN:
        str += token.text;
        break;
      case Token.KEY_SIMPLE:
        str += token.text + ':';
        break;
      case Token.VALUE_NUMBER_LIST:
      case Token.VALUE_TEXT_LIST:
        str += token.text;
        break;
      case Token.KEY_EXPLICIT_TAG:
        str += token.key;
        break;
      default: {
        break;
      }
    }
    str += tokens.indexOf(token) !== tokens.length - 1 ? ' ' : '';
  }

  return str;
};

function assertTokens(
  tokens: TokenResult<Token>[] | null
): asserts tokens is TokenResult<Token>[] {
  if (tokens === null) {
    throw new Error('Expected tokens to be an array');
  }
}

describe('Search Syntax Evaluator', () => {
  describe('flatten tree', () => {
    it('flattens simple expressions', () => {
      const tokens = parseSearch('is:unresolved duration:>1h');
      assertTokens(tokens);
      const flattened = flattenTokenTree(tokens);
      expect(flattened).toHaveLength(2);
      expect(tokensToString(flattened)).toBe('is:unresolved space duration:>1h space');
    });
    it.todo('handles filters');
    it.todo('handles free text');
    it.todo('handles key explicit tags');
    it.todo('handles aggregate args');
    it.todo('handles aggregate params');
    it.todo('handles tags');
    it.todo('handles logical booleans');
    it.todo('handles logical groups');
  });
});
