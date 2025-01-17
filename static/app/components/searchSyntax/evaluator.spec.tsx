import {
  insertImplicitAND,
  type ProcessedTokenResult,
  toFlattened,
  toPostFix,
} from 'sentry/components/searchSyntax/evaluator';
import {
  parseSearch,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';

const tokensToString = (tokens: ProcessedTokenResult[]): string => {
  let str = '';

  for (const token of tokens) {
    let concatstr: any;
    switch (token.type) {
      case Token.FREE_TEXT:
        concatstr = token.text;
        break;
      case Token.SPACES:
        concatstr = 'space';
        break;
      case Token.VALUE_DURATION:
      case Token.VALUE_BOOLEAN:
      case Token.VALUE_NUMBER:
      case Token.VALUE_SIZE:
      case Token.VALUE_PERCENTAGE:
      case Token.VALUE_TEXT:
      case Token.VALUE_ISO_8601_DATE:
      case Token.VALUE_RELATIVE_DATE:
        concatstr = token.value;
        break;
      case Token.LOGIC_GROUP:
      case Token.LOGIC_BOOLEAN:
        concatstr = token.text;
        break;
      case Token.KEY_SIMPLE:
        concatstr = token.text + ':';
        break;
      case Token.VALUE_NUMBER_LIST:
      case Token.VALUE_TEXT_LIST:
        concatstr = token.text;
        break;
      case Token.KEY_EXPLICIT_TAG:
        concatstr = token.key;
        break;
      case 'L_PAREN': {
        concatstr = '(';
        break;
      }
      case 'R_PAREN': {
        concatstr = ')';
        break;
      }
      default: {
        concatstr = token.text;
        break;
      }
    }

    // The parsing logic text() captures leading/trailing spaces in some cases.
    // We'll just trim them so the tests are easier to read.
    str += concatstr.trim();
    str += concatstr && tokens.indexOf(token) !== tokens.length - 1 ? ' ' : '';
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
      const flattened = toFlattened(tokens);
      expect(flattened).toHaveLength(2);
      expect(tokensToString(flattened)).toBe('is:unresolved duration:>1h');
    });
    it('handles filters', () => {
      const tokens = parseSearch('has:unresolved duration:[1,2,3]');
      assertTokens(tokens);
      const flattened = toFlattened(tokens);
      expect(flattened).toHaveLength(2);
      expect(tokensToString(flattened)).toBe('has:unresolved duration:[1,2,3]');
    });
    it('handles free text', () => {
      const tokens = parseSearch('hello world');
      assertTokens(tokens);
      const flattened = toFlattened(tokens);
      expect(flattened).toHaveLength(1);
      expect(tokensToString(flattened)).toBe('hello world');
    });
    it('handles logical booleans', () => {
      const tokens = parseSearch('hello AND world');
      assertTokens(tokens);
      const flattened = toFlattened(tokens);
      expect(flattened).toHaveLength(3);
      expect(tokensToString(flattened)).toBe('hello AND world');
    });
    it('handles logical groups', () => {
      const tokens = parseSearch('is:unresolved AND (is:dead OR is:alive)');
      assertTokens(tokens);
      const flattened = toFlattened(tokens);
      expect(flattened).toHaveLength(7);
      expect(tokensToString(flattened)).toBe('is:unresolved AND ( is:dead OR is:alive )');
    });
  });

  describe('injects implicit AND', () => {
    describe('boolean operators', () => {
      it('implicit AND', () => {
        const tokens = toFlattened(parseSearch('is:unresolved duration:>1h')!);
        const withImplicitAND = insertImplicitAND(tokens);
        expect(tokensToString(withImplicitAND)).toBe('is:unresolved AND duration:>1h');
      });

      it('explicit AND', () => {
        const tokens = toFlattened(parseSearch('is:unresolved AND duration:>1h')!);
        const withImplicitAND = insertImplicitAND(tokens);
        expect(tokensToString(withImplicitAND)).toBe('is:unresolved AND duration:>1h');
      });

      it('multiple implicit AND', () => {
        const tokens = toFlattened(
          parseSearch('is:unresolved duration:>1h duration:<1m')!
        );
        const withImplicitAND = insertImplicitAND(tokens);
        expect(tokensToString(withImplicitAND)).toBe(
          'is:unresolved AND duration:>1h AND duration:<1m'
        );
      });

      it('explicit OR', () => {
        const tokens = toFlattened(parseSearch('is:unresolved OR duration:>1h')!);
        const withImplicitAND = insertImplicitAND(tokens);
        expect(tokensToString(withImplicitAND)).toBe('is:unresolved OR duration:>1h');
      });

      it('multiple explicit OR', () => {
        const tokens = toFlattened(
          parseSearch('is:unresolved OR duration:>1h OR duration:<1h')!
        );
        const withImplicitAND = insertImplicitAND(tokens);
        expect(tokensToString(withImplicitAND)).toBe(
          'is:unresolved OR duration:>1h OR duration:<1h'
        );
      });

      it('with logical groups', () => {
        const tokens = toFlattened(parseSearch('is:unresolved (duration:>1h)')!);
        const withImplicitAND = insertImplicitAND(tokens);
        expect(tokensToString(withImplicitAND)).toBe(
          'is:unresolved AND ( duration:>1h )'
        );
      });
    });

    describe('logical groups', () => {
      it('explicit OR', () => {
        const tokens = toFlattened(parseSearch('is:unresolved OR ( duration:>1h )')!);
        const withImplicitAND = insertImplicitAND(tokens);
        expect(tokensToString(withImplicitAND)).toBe('is:unresolved OR ( duration:>1h )');
      });
      it('explicit AND', () => {
        const tokens = toFlattened(parseSearch('is:unresolved AND ( duration:>1h )')!);
        expect(tokensToString(tokens)).toBe('is:unresolved AND ( duration:>1h )');
      });
    });

    describe('complex expressions', () => {
      it('handles complex expressions', () => {
        const tokens = toFlattened(
          parseSearch('is:unresolved AND ( duration:>1h OR duration:<1h )')!
        );
        expect(tokensToString(tokens)).toBe(
          'is:unresolved AND ( duration:>1h OR duration:<1h )'
        );
      });

      it('handles complex expressions with implicit AND', () => {
        const tokens = toFlattened(
          parseSearch('is:unresolved ( duration:>1h OR ( duration:<1h duration:1m ) )')!
        );
        const withImplicitAND = insertImplicitAND(tokens);
        expect(tokensToString(withImplicitAND)).toBe(
          'is:unresolved AND ( duration:>1h OR ( duration:<1h AND duration:1m ) )'
        );
      });
    });
  });

  describe('postfix', () => {
    it('simple operator', () => {
      const tokens = toPostFix(parseSearch('is:unresolved is:resolved')!);
      expect(tokensToString(tokens)).toBe('is:unresolved is:resolved AND');
    });

    describe('logical groups', () => {
      it('parens', () => {
        const tokens = toPostFix(parseSearch('is:unresolved (is:resolved OR is:dead)')!);
        expect(tokensToString(tokens)).toBe('is:unresolved is:resolved is:dead OR AND');
      });

      it('or', () => {
        const tokens = toPostFix(
          parseSearch('is:unresolved OR (is:resolved AND is:dead)')!
        );
        expect(tokensToString(tokens)).toBe('is:unresolved is:resolved is:dead AND OR');
      });
      it('and', () => {
        const tokens = toPostFix(
          parseSearch('is:unresolved AND (is:resolved AND is:dead)')!
        );
        expect(tokensToString(tokens)).toBe('is:unresolved is:resolved is:dead AND AND');
      });
      it('parentheses respect precedence', () => {
        const tokens = toPostFix(parseSearch('is:unresolved OR (is:dead AND is:alive)')!);
        expect(tokensToString(tokens)).toBe('is:unresolved is:dead is:alive AND OR');
      });
    });
  });
});
