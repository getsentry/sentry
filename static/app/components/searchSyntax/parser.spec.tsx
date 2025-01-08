import {parse} from 'query-string';

import {loadFixtures} from 'sentry-test/loadFixtures';

import type {
  ParseResult,
  SearchConfig,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {
  BooleanOperator,
  InvalidReason,
  parseSearch,
  Token,
} from 'sentry/components/searchSyntax/parser';
import {treeTransformer} from 'sentry/components/searchSyntax/utils';

type TestCase = {
  /**
   * Additional parser configuration
   */
  additionalConfig: Parameters<typeof parseSearch>[1];
  /**
   * The search query string under parsing test
   */
  query: string;
  /**
   * The expected result for the query
   */
  result: ParseResult;
  /**
   * This is set when the query is expected to completely fail to parse.
   */
  raisesError?: boolean;
};

/**
 * Normalize results to match the json test cases
 */
const normalizeResult = (tokens: TokenResult<Token>[]) =>
  treeTransformer({
    tree: tokens,
    transform: token => {
      // XXX: This attempts to keep the test data simple, only including keys
      // that are really needed to validate functionality.

      // @ts-expect-error
      delete token.location;
      // @ts-expect-error
      delete token.text;
      // @ts-expect-error
      delete token.config;

      if (!parse) {
        // @ts-expect-error
        delete token.parsed;
      }

      // token warnings only exist in the FE atm
      // @ts-expect-error
      delete token.warning;

      if (token.type === Token.FILTER && token.invalid === null) {
        // @ts-expect-error
        delete token.invalid;
      }

      if (
        token.type === Token.VALUE_ISO_8601_DATE ||
        token.type === Token.VALUE_RELATIVE_DATE
      ) {
        if (token.parsed?.value instanceof Date) {
          // @ts-expect-error we cannot have dates in JSON
          token.parsed.value = token.parsed.value.toISOString();
        }
      }

      return token;
    },
  });

describe('searchSyntax/parser', function () {
  const testData = loadFixtures('search-syntax') as unknown as Record<string, TestCase[]>;

  const registerTestCase = (
    testCase: TestCase,
    additionalConfig: Partial<SearchConfig> = {}
  ) =>
    it(`handles ${testCase.query}`, () => {
      const result = parseSearch(testCase.query, {
        ...testCase.additionalConfig,
        ...additionalConfig,
      });
      // Handle errors
      if (testCase.raisesError) {
        expect(result).toBeNull();
        return;
      }

      if (result === null) {
        throw new Error('Parsed result as null without raiseError true');
      }

      expect(normalizeResult(result)).toEqual(testCase.result);
    });

  Object.entries(testData).map(([name, cases]) =>
    describe(`${name}`, () => {
      cases.map(c => registerTestCase(c, {parse: true}));
    })
  );

  it('returns token warnings', () => {
    const result = parseSearch('foo:bar bar:baz tags[foo]:bar tags[bar]:baz', {
      getFilterTokenWarning: key => (key === 'foo' ? 'foo warning' : null),
    });

    // check with error to satisfy type checker
    if (result === null) {
      throw new Error('Parsed result as null');
    }
    expect(result).toHaveLength(9);

    const foo = result[1] as TokenResult<Token.FILTER>;
    const bar = result[3] as TokenResult<Token.FILTER>;
    const fooTag = result[5] as TokenResult<Token.FILTER>;
    const barTag = result[7] as TokenResult<Token.FILTER>;

    expect(foo.warning).toBe('foo warning');
    expect(bar.warning).toBeNull();
    expect(fooTag.warning).toBe('foo warning');
    expect(barTag.warning).toBeNull();
  });

  it('applies disallowFreeText', () => {
    const result = parseSearch('foo:bar test', {
      disallowFreeText: true,
      invalidMessages: {
        [InvalidReason.FREE_TEXT_NOT_ALLOWED]: 'Custom message',
      },
    });

    // check with error to satisfy type checker
    if (result === null) {
      throw new Error('Parsed result as null');
    }
    expect(result).toHaveLength(5);

    const foo = result[1] as TokenResult<Token.FILTER>;
    const test = result[3] as TokenResult<Token.FREE_TEXT>;

    expect(foo.invalid).toBeNull();
    expect(test.invalid).toEqual({
      type: InvalidReason.FREE_TEXT_NOT_ALLOWED,
      reason: 'Custom message',
    });
  });

  it('applies disallowLogicalOperators (OR)', () => {
    const result = parseSearch('foo:bar OR AND', {
      disallowedLogicalOperators: new Set([BooleanOperator.OR]),
      invalidMessages: {
        [InvalidReason.LOGICAL_OR_NOT_ALLOWED]: 'Custom message',
      },
    });

    // check with error to satisfy type checker
    if (result === null) {
      throw new Error('Parsed result as null');
    }
    expect(result).toHaveLength(7);

    const foo = result[1] as TokenResult<Token.FILTER>;
    const or = result[3] as TokenResult<Token.LOGIC_BOOLEAN>;
    const and = result[5] as TokenResult<Token.LOGIC_BOOLEAN>;

    expect(foo.invalid).toBeNull();
    expect(or.invalid).toEqual({
      type: InvalidReason.LOGICAL_OR_NOT_ALLOWED,
      reason: 'Custom message',
    });
    expect(and.invalid).toBeNull();
  });

  it('applies disallowLogicalOperators (AND)', () => {
    const result = parseSearch('foo:bar OR AND', {
      disallowedLogicalOperators: new Set([BooleanOperator.AND]),
      invalidMessages: {
        [InvalidReason.LOGICAL_AND_NOT_ALLOWED]: 'Custom message',
      },
    });

    // check with error to satisfy type checker
    if (result === null) {
      throw new Error('Parsed result as null');
    }
    expect(result).toHaveLength(7);

    const foo = result[1] as TokenResult<Token.FILTER>;
    const or = result[3] as TokenResult<Token.LOGIC_BOOLEAN>;
    const and = result[5] as TokenResult<Token.LOGIC_BOOLEAN>;

    expect(foo.invalid).toBeNull();
    expect(or.invalid).toBeNull();
    expect(and.invalid).toEqual({
      type: InvalidReason.LOGICAL_AND_NOT_ALLOWED,
      reason: 'Custom message',
    });
  });

  it('applies disallowNegation', () => {
    const result = parseSearch('!foo:bar', {
      disallowNegation: true,
      invalidMessages: {
        [InvalidReason.NEGATION_NOT_ALLOWED]: 'Custom message',
      },
    });

    // check with error to satisfy type checker
    if (result === null) {
      throw new Error('Parsed result as null');
    }
    expect(result).toHaveLength(3);

    const foo = result[1] as TokenResult<Token.FILTER>;

    expect(foo.negated).toBe(true);
    expect(foo.invalid).toEqual({
      type: InvalidReason.NEGATION_NOT_ALLOWED,
      reason: 'Custom message',
    });
  });

  describe('flattenParenGroups', () => {
    it('tokenizes mismatched parens with flattenParenGroups=true', () => {
      const result = parseSearch('foo(', {
        flattenParenGroups: true,
      });

      if (result === null) {
        throw new Error('Parsed result as null');
      }

      // foo( is parsed as free text a single paren
      expect(result).toEqual([
        expect.objectContaining({type: Token.SPACES}),
        expect.objectContaining({type: Token.FREE_TEXT}),
        expect.objectContaining({type: Token.SPACES}),
        expect.objectContaining({
          type: Token.L_PAREN,
          value: '(',
        }),
        expect.objectContaining({type: Token.SPACES}),
      ]);
    });

    it('tokenizes matching parens with flattenParenGroups=true', () => {
      const result = parseSearch('(foo)', {
        flattenParenGroups: true,
      });

      if (result === null) {
        throw new Error('Parsed result as null');
      }

      // (foo) is parsed as free text and two parens
      expect(result).toEqual([
        expect.objectContaining({type: Token.SPACES}),
        expect.objectContaining({
          type: Token.L_PAREN,
          value: '(',
        }),
        expect.objectContaining({type: Token.SPACES}),
        expect.objectContaining({type: Token.FREE_TEXT}),
        expect.objectContaining({type: Token.SPACES}),
        expect.objectContaining({
          type: Token.R_PAREN,
          value: ')',
        }),
        expect.objectContaining({type: Token.SPACES}),
      ]);
    });

    it('tokenizes mismatched left paren with flattenParenGroups=false', () => {
      const result = parseSearch('foo(', {
        flattenParenGroups: false,
      });

      if (result === null) {
        throw new Error('Parsed result as null');
      }

      // foo( is parsed as free text and a paren
      expect(result).toEqual([
        expect.objectContaining({type: Token.SPACES}),
        expect.objectContaining({type: Token.FREE_TEXT}),
        expect.objectContaining({type: Token.SPACES}),
        expect.objectContaining({
          type: Token.L_PAREN,
          value: '(',
        }),
        expect.objectContaining({type: Token.SPACES}),
      ]);
    });

    it('tokenizes mismatched right paren with flattenParenGroups=false', () => {
      const result = parseSearch('foo)', {
        flattenParenGroups: false,
      });

      if (result === null) {
        throw new Error('Parsed result as null');
      }

      // foo( is parsed as free text and a paren
      expect(result).toEqual([
        expect.objectContaining({type: Token.SPACES}),
        expect.objectContaining({type: Token.FREE_TEXT}),
        expect.objectContaining({type: Token.SPACES}),
        expect.objectContaining({
          type: Token.R_PAREN,
          value: ')',
        }),
        expect.objectContaining({type: Token.SPACES}),
      ]);
    });

    it('parses matching parens as logic group with flattenParenGroups=false', () => {
      const result = parseSearch('(foo)', {
        flattenParenGroups: false,
      });

      if (result === null) {
        throw new Error('Parsed result as null');
      }

      // (foo) is parsed as a logic group
      expect(result).toEqual([
        expect.objectContaining({type: Token.SPACES}),
        expect.objectContaining({type: Token.LOGIC_GROUP}),
        expect.objectContaining({type: Token.SPACES}),
      ]);
    });

    it('tokenizes empty matched parens and flattenParenGroups=false', () => {
      const result = parseSearch('()', {
        flattenParenGroups: false,
      });

      if (result === null) {
        throw new Error('Parsed result as null');
      }

      expect(result).toEqual([
        expect.objectContaining({type: Token.SPACES}),
        expect.objectContaining({
          type: Token.LOGIC_GROUP,
          inner: [expect.objectContaining({type: Token.SPACES})],
        }),
        expect.objectContaining({type: Token.SPACES}),
      ]);
    });
  });
});
