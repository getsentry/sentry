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

  // These test cases test the unique invalid aggregate warnings that are present on the frontend but not on the backend. Thus, separate from the fixtures.
  describe('invalid aggregate queries', () => {
    describe('return values', () => {
      it('aggregate does not return percentage', () => {
        const result = parseSearch('count():>23%');

        expect(result).not.toBeNull();
        if (result) {
          expect(normalizeResult(result)).toEqual([
            {type: 'spaces', value: ''},
            {
              type: 'filter',
              filter: 'aggregatePercentage',
              key: {
                type: 'keyAggregate',
                args: null,
                argsSpaceAfter: {
                  type: 'spaces',
                  value: '',
                },
                argsSpaceBefore: {
                  type: 'spaces',
                  value: '',
                },
                name: {
                  quoted: false,
                  type: 'keySimple',
                  value: 'count',
                },
              },
              value: {type: 'valuePercentage', value: 23},
              negated: false,
              operator: '>',
              invalid: {reason: "'count' returns a number; '23%' is not valid here."},
            },
            {type: 'spaces', value: ''},
          ]);
        }
      });
      it('aggregate does not return date', () => {
        const result = parseSearch('count():2022-03-21');

        expect(result).not.toBeNull();
        if (result) {
          expect(normalizeResult(result)).toEqual([
            {type: 'spaces', value: ''},
            {
              type: 'filter',
              filter: 'aggregateDate',
              key: {
                type: 'keyAggregate',
                args: null,
                argsSpaceAfter: {
                  type: 'spaces',
                  value: '',
                },
                argsSpaceBefore: {
                  type: 'spaces',
                  value: '',
                },
                name: {
                  quoted: false,
                  type: 'keySimple',
                  value: 'count',
                },
              },
              value: {
                type: 'valueIso8601Date',
                value: '2022-03-21T00:00:00.000Z',
              },
              negated: false,
              operator: '',
              invalid: {
                reason: "'count' returns a number; '2022-03-21' is not valid here.",
              },
            },
            {type: 'spaces', value: ''},
          ]);
        }
      });
      it('aggregate does not return relative date', () => {
        const result = parseSearch('count():+1d');

        expect(result).not.toBeNull();
        if (result) {
          expect(normalizeResult(result)).toEqual([
            {type: 'spaces', value: ''},
            {
              type: 'filter',
              filter: 'aggregateRelativeDate',
              key: {
                type: 'keyAggregate',
                args: null,
                argsSpaceAfter: {
                  type: 'spaces',
                  value: '',
                },
                argsSpaceBefore: {
                  type: 'spaces',
                  value: '',
                },
                name: {
                  quoted: false,
                  type: 'keySimple',
                  value: 'count',
                },
              },
              value: {
                sign: '+',
                type: 'valueRelativeDate',
                unit: 'd',
                value: 1,
              },
              negated: false,
              operator: '',
              invalid: {
                reason: "'count' returns a number; '+1d' is not valid here.",
              },
            },
            {type: 'spaces', value: ''},
          ]);
        }
      });
    });
    describe('arguments', () => {
      it('aggregate does not take argument', () => {
        const result = parseSearch('count(202):>200');

        expect(result).not.toBeNull();
        if (result) {
          expect(normalizeResult(result)).toEqual([
            {type: 'spaces', value: ''},
            {
              type: 'filter',
              filter: 'aggregateNumeric',
              key: {
                type: 'keyAggregate',
                args: {
                  args: [
                    {
                      separator: '',
                      value: {
                        quoted: false,
                        type: 'keyAggregateParam',
                        value: '202',
                      },
                    },
                  ],
                  type: 'keyAggregateArgs',
                },
                argsSpaceAfter: {
                  type: 'spaces',
                  value: '',
                },
                argsSpaceBefore: {
                  type: 'spaces',
                  value: '',
                },
                name: {
                  quoted: false,
                  type: 'keySimple',
                  value: 'count',
                },
              },
              value: {
                rawValue: 200,
                type: 'valueNumber',
                unit: null,
                value: '200',
              },
              negated: false,
              operator: '>',
              invalid: {
                reason: "'count' does not take any arguments.",
              },
            },
            {type: 'spaces', value: ''},
          ]);
        }
      });

      it('aggregate does not take specific argument', () => {
        const result = parseSearch('p95(user.id):>200');

        expect(result).not.toBeNull();
        if (result) {
          expect(normalizeResult(result)).toEqual([
            {type: 'spaces', value: ''},
            {
              type: 'filter',
              filter: 'aggregateNumeric',
              key: {
                type: 'keyAggregate',
                args: {
                  args: [
                    {
                      separator: '',
                      value: {
                        quoted: false,
                        type: 'keyAggregateParam',
                        value: 'user.id',
                      },
                    },
                  ],
                  type: 'keyAggregateArgs',
                },
                argsSpaceAfter: {
                  type: 'spaces',
                  value: '',
                },
                argsSpaceBefore: {
                  type: 'spaces',
                  value: '',
                },
                name: {
                  quoted: false,
                  type: 'keySimple',
                  value: 'p95',
                },
              },
              value: {
                rawValue: 200,
                type: 'valueNumber',
                unit: null,
                value: '200',
              },
              negated: false,
              operator: '>',
              invalid: {
                reason: "'p95' is not expecting 'user.id' as an argument.",
              },
            },
            {type: 'spaces', value: ''},
          ]);
        }
      });

      it('mismatch type with argument', () => {
        const result = parseSearch('avg(measurements.stall_count):>20%');

        expect(result).not.toBeNull();
        if (result) {
          expect(normalizeResult(result)).toEqual([
            {type: 'spaces', value: ''},
            {
              type: 'filter',
              filter: 'aggregatePercentage',
              invalid: {
                reason:
                  "'avg' is not expecting 'measurements.stall_count' as an argument.",
              },
              key: {
                type: 'keyAggregate',
                args: {
                  args: [
                    {
                      separator: '',
                      value: {
                        quoted: false,
                        type: 'keyAggregateParam',
                        value: 'measurements.stall_count',
                      },
                    },
                  ],
                  type: 'keyAggregateArgs',
                },
                argsSpaceAfter: {
                  type: 'spaces',
                  value: '',
                },
                argsSpaceBefore: {
                  type: 'spaces',
                  value: '',
                },
                name: {
                  quoted: false,
                  type: 'keySimple',
                  value: 'avg',
                },
              },
              value: {
                type: 'valuePercentage',
                value: 20,
              },

              negated: false,
              operator: '>',
            },
            {type: 'spaces', value: ''},
          ]);
        }
      });
    });
  });
});
