import type {Token, TokenResult} from 'sentry/components/searchSyntax/parser';

import {
  addWildcardToToken,
  removeWildcardFromToken,
  replaceFreeTextTokens,
  type ReplaceTokensWithTextAction,
  type UpdateFreeTextAction,
} from './useQueryBuilderState';

describe('addWildcardToToken', () => {
  const testCases = [
    // --- contains ---
    {
      input: {
        token: {value: 'firefox'},
        isContains: true,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: '*firefox*',
    },
    {
      input: {
        token: {value: '*firefox'},
        isContains: true,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: '*firefox*',
    },
    {
      input: {
        token: {value: 'firefox*'},
        isContains: true,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: '*firefox*',
    },
    {
      input: {
        token: {value: 'e m'},
        isContains: true,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: '*e m*',
    },
    // --- starts with ---
    {
      input: {
        token: {value: 'firefox'},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: 'firefox*',
    },
    {
      input: {
        token: {value: '*firefox'},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: '*firefox*',
    },
    {
      input: {
        token: {value: 'firefox*'},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: 'firefox*',
    },
    {
      input: {
        token: {value: 'e m'},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: 'e m*',
    },
    // --- ends with ---
    {
      input: {
        token: {value: 'firefox'},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*firefox',
    },
    {
      input: {
        token: {value: '*firefox'},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*firefox',
    },
    {
      input: {
        token: {value: 'firefox*'},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*firefox*',
    },
    {
      input: {
        token: {value: 'e m'},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*e m',
    },
  ];

  it.each(testCases)('should add wildcard to token', ({input, expected}) => {
    const result = addWildcardToToken(
      input.token as TokenResult<Token.VALUE_TEXT>,
      input.isContains,
      input.isStartsWith,
      input.isEndsWith
    );
    expect(result).toBe(expected);
  });
});

describe('removeWildcardFromToken', () => {
  const testCases = [
    // --- contains ---
    {
      input: {
        token: {value: '*firefox*'},
        isContains: false,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: 'firefox',
    },
    {
      input: {
        token: {value: '*firefox'},
        isContains: false,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: 'firefox',
    },
    {
      input: {
        token: {value: 'firefox*'},
        isContains: false,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: 'firefox',
    },
    {
      input: {
        token: {value: '*e m*'},
        isContains: false,
        isStartsWith: false,
        isEndsWith: false,
      },
      expected: 'e m',
    },
    // --- starts with ---
    {
      input: {
        token: {value: '*firefox*'},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: 'firefox*',
    },
    {
      input: {
        token: {value: '*firefox'},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: 'firefox',
    },
    {
      input: {
        token: {value: 'firefox*'},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: 'firefox*',
    },
    {
      input: {
        token: {value: '*e m*'},
        isContains: false,
        isStartsWith: true,
        isEndsWith: false,
      },
      expected: 'e m*',
    },
    // --- ends with ---
    {
      input: {
        token: {value: '*firefox*'},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*firefox',
    },
    {
      input: {
        token: {value: '*firefox*'},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*firefox',
    },
    {
      input: {
        token: {value: '*firefox*'},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*firefox',
    },
    {
      input: {
        token: {value: '*e m*'},
        isContains: false,
        isStartsWith: false,
        isEndsWith: true,
      },
      expected: '*e m',
    },
  ];

  it.each(testCases)('should remove wildcard from token', ({input, expected}) => {
    const result = removeWildcardFromToken(
      input.token as TokenResult<Token.VALUE_TEXT>,
      input.isContains,
      input.isStartsWith,
      input.isEndsWith
    );
    expect(result).toBe(expected);
  });
});

describe('replaceFreeTextTokens', () => {
  describe('when there are free text tokens', () => {
    type TestCase = {
      description: string;
      expected: string | undefined;
      input: {
        action: UpdateFreeTextAction | ReplaceTokensWithTextAction;
        currentQuery: string;
        getFieldDefinition: () => null;
        rawSearchReplacement: string[];
      };
    };

    const testCases: TestCase[] = [
      {
        description: 'when there are no tokens',
        input: {
          action: {
            type: 'UPDATE_FREE_TEXT',
            text: '',
            tokens: [],
            shouldCommitQuery: false,
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: '',
        },
        expected: undefined,
      },
      {
        description: 'when there is no raw search replacement',
        input: {
          action: {
            type: 'UPDATE_FREE_TEXT',
            text: '',
            tokens: [],
            shouldCommitQuery: false,
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: [],
          currentQuery: 'browser.name:"firefox"',
        },
        expected: undefined,
      },
      {
        description: 'when there are no free text tokens',
        input: {
          action: {
            type: 'UPDATE_FREE_TEXT',
            text: '',
            tokens: [],
            shouldCommitQuery: false,
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: 'browser.name:"firefox"',
        },
        expected: undefined,
      },
      {
        description: 'when there only valid action tokens',
        input: {
          action: {
            type: 'UPDATE_FREE_TEXT',
            text: 'span.op:eq',
            tokens: [],
            shouldCommitQuery: false,
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: '',
        },
        expected: undefined,
      },
      {
        description: 'when there only space free text tokens in the action',
        input: {
          action: {
            type: 'UPDATE_FREE_TEXT',
            text: 'span.op:eq    ',
            tokens: [],
            shouldCommitQuery: false,
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: '',
        },
        expected: undefined,
      },
      {
        description: 'when there is one free text token',
        input: {
          action: {
            type: 'REPLACE_TOKENS_WITH_TEXT',
            text: 'test',
            tokens: [],
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: '',
        },
        expected: 'span.description:*test*',
      },
      {
        description: 'when there is one free text token that has a space',
        input: {
          action: {
            type: 'UPDATE_FREE_TEXT',
            text: 'test test',
            tokens: [],
            shouldCommitQuery: false,
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: '',
        },
        expected: 'span.description:"*test test*"',
      },
      {
        description: 'when there is already a token present',
        input: {
          action: {
            type: 'UPDATE_FREE_TEXT',
            text: 'test',
            tokens: [],
            shouldCommitQuery: false,
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: 'span.op:eq',
        },
        expected: 'span.op:eq span.description:*test*',
      },
      {
        description: 'when there is already a replace token present',
        input: {
          action: {
            type: 'UPDATE_FREE_TEXT',
            text: 'test2',
            tokens: [],
            shouldCommitQuery: false,
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: 'span.description:*test*',
        },
        expected: 'span.description:[*test*,*test2*]',
      },
      {
        description: 'when there is already a replace token present with a space',
        input: {
          action: {
            type: 'UPDATE_FREE_TEXT',
            text: 'other value',
            tokens: [],
            shouldCommitQuery: false,
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: 'span.description:*test*',
        },
        expected: 'span.description:[*test*,"*other value*"]',
      },
    ];

    it.each(testCases)('$description', ({input, expected}) => {
      const result = replaceFreeTextTokens(
        input.action,
        input.getFieldDefinition,
        input.rawSearchReplacement,
        input.currentQuery
      );

      expect(result).toBe(expected);
    });
  });
});
