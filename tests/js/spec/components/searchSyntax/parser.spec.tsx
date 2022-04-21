import {loadFixtures} from 'sentry-test/loadFixtures';

import {
  ParseResult,
  parseSearch,
  Token,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {treeTransformer} from 'sentry/components/searchSyntax/utils';

type TestCase = {
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

      if (token.type === Token.Filter && token.invalid === null) {
        // @ts-expect-error
        delete token.invalid;
      }

      if (token.type === Token.ValueIso8601Date) {
        // Date values are represented as ISO strings in the test case json
        return {...token, value: token.value.toISOString()};
      }

      return token;
    },
  });

describe('searchSyntax/parser', function () {
  const testData = loadFixtures('search-syntax') as unknown as Record<string, TestCase[]>;

  const registerTestCase = (testCase: TestCase) =>
    it(`handles ${testCase.query}`, () => {
      const result = parseSearch(testCase.query);

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
      cases.map(registerTestCase);
    })
  );
});
