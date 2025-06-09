import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';

import {addWildcardToToken, removeWildcardFromToken} from './useQueryBuilderState';

describe('addWildcardToToken', function () {
  const testCases = [
    // --- contains ---
    {
      input: {
        token: {text: 'firefox', quoted: false},
        isContains: true,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: '*firefox*',
    },
    {
      input: {
        token: {text: '"firefox"', quoted: true},
        isContains: true,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: '"*firefox*"',
    },
    {
      input: {
        token: {text: '*firefox', quoted: false},
        isContains: true,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: '*firefox*',
    },
    {
      input: {
        token: {text: 'firefox*', quoted: false},
        isContains: true,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: '*firefox*',
    },
    {
      input: {
        token: {text: '"e m"', quoted: true},
        isContains: true,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: '"*e m*"',
    },
    // --- starts with ---
    {
      input: {
        token: {text: 'firefox', quoted: false},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: 'firefox*',
    },
    {
      input: {
        token: {text: '"firefox"', quoted: true},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: '"firefox*"',
    },
    {
      input: {
        token: {text: '*firefox', quoted: false},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: '*firefox*',
    },
    {
      input: {
        token: {text: 'firefox*', quoted: false},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: 'firefox*',
    },
    {
      input: {
        token: {text: '"e m"', quoted: true},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: '"e m*"',
    },
    // --- ends with ---
    {
      input: {
        token: {text: 'firefox', quoted: false},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*firefox',
    },
    {
      input: {
        token: {text: '"firefox"', quoted: true},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '"*firefox"',
    },
    {
      input: {
        token: {text: '*firefox', quoted: false},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*firefox',
    },
    {
      input: {
        token: {text: 'firefox*', quoted: false},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*firefox*',
    },
    {
      input: {
        token: {text: '"e m"', quoted: true},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '"*e m"',
    },
  ];

  it.each(testCases)('should add wildcard to token', function ({input, expected}) {
    const result = addWildcardToToken(
      input.token as TokenResult<Token.VALUE_TEXT>,
      input.isContains,
      input.isStartsWith,
      input.isEndsWith
    );
    expect(result).toBe(expected);
  });
});

describe('removeWildcardFromToken', function () {
  const testCases = [
    // --- contains ---
    {
      input: {
        token: {text: '*firefox*', quoted: false},
        isContains: false,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: 'firefox',
    },
    {
      input: {
        token: {text: '"*firefox*"', quoted: true},
        isContains: false,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: '"firefox"',
    },
    {
      input: {
        token: {text: '*firefox', quoted: false},
        isContains: false,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: 'firefox',
    },
    {
      input: {
        token: {text: 'firefox*', quoted: false},
        isContains: false,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: 'firefox',
    },
    {
      input: {
        token: {text: '"*e m*"', quoted: true},
        isContains: false,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: '"e m"',
    },
    // --- starts with ---
    {
      input: {
        token: {text: '*firefox*', quoted: false},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: 'firefox*',
    },
    {
      input: {
        token: {text: '"*firefox*"', quoted: true},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: '"firefox*"',
    },
    {
      input: {
        token: {text: '*firefox', quoted: false},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: 'firefox',
    },
    {
      input: {
        token: {text: 'firefox*', quoted: false},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: 'firefox*',
    },
    {
      input: {
        token: {text: '"*e m*"', quoted: true},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: '"e m*"',
    },
    // --- ends with ---
    {
      input: {
        token: {text: '*firefox*', quoted: false},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*firefox',
    },
    {
      input: {
        token: {text: '"*firefox*"', quoted: true},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '"*firefox"',
    },
    {
      input: {
        token: {text: '*firefox*', quoted: false},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*firefox',
    },
    {
      input: {
        token: {text: '*firefox*', quoted: false},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*firefox',
    },
    {
      input: {
        token: {text: '"*e m*"', quoted: true},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '"*e m"',
    },
  ];

  it.each(testCases)('should remove wildcard from token', function ({input, expected}) {
    const result = removeWildcardFromToken(
      input.token as TokenResult<Token.VALUE_TEXT>,
      input.isContains,
      input.isStartsWith,
      input.isEndsWith
    );
    expect(result).toBe(expected);
  });
});
