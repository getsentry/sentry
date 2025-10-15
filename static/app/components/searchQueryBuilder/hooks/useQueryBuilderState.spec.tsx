import type {FocusOverride} from 'sentry/components/searchQueryBuilder/types';
import {WildcardOperators} from 'sentry/components/searchSyntax/parser';

import {
  replaceFreeTextTokens,
  type ReplaceTokensWithTextOnPasteAction,
} from './useQueryBuilderState';

describe('replaceFreeTextTokens', () => {
  describe('when there are free text tokens', () => {
    type TestCase = {
      description: string;
      expected: {
        focusOverride: FocusOverride | undefined;
        query: string | undefined;
      };
      input: {
        action: ReplaceTokensWithTextOnPasteAction;
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
            type: 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE',
            text: '',
            tokens: [],
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: '',
        },
        expected: {
          query: undefined,
          focusOverride: undefined,
        },
      },
      {
        description: 'when there is no raw search replacement',
        input: {
          action: {
            type: 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE',
            text: '',
            tokens: [],
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: [],
          currentQuery: `browser.name:${WildcardOperators.CONTAINS}"firefox"`,
        },
        expected: {
          query: undefined,
          focusOverride: undefined,
        },
      },
      {
        description: 'when there are no free text tokens',
        input: {
          action: {
            type: 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE',
            text: '',
            tokens: [],
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: `browser.name:${WildcardOperators.CONTAINS}"firefox"`,
        },
        expected: {
          query: undefined,
          focusOverride: undefined,
        },
      },
      {
        description: 'when there only valid action tokens',
        input: {
          action: {
            type: 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE',
            text: 'span.op:eq',
            tokens: [],
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: '',
        },
        expected: {
          query: undefined,
          focusOverride: undefined,
        },
      },
      {
        description: 'when there only space free text tokens in the action',
        input: {
          action: {
            type: 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE',
            text: 'span.op:eq    ',
            tokens: [],
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: '',
        },
        expected: {
          query: undefined,
          focusOverride: undefined,
        },
      },
      {
        description: 'when there is one free text token',
        input: {
          action: {
            type: 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE',
            text: 'test',
            tokens: [],
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: '',
        },
        expected: {
          query: `span.description:${WildcardOperators.CONTAINS}test`,
          focusOverride: {itemKey: 'freeText:1'},
        },
      },
      {
        description: 'when there is one free text token that has a space',
        input: {
          action: {
            type: 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE',
            text: 'test test',
            tokens: [],
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: '',
        },
        expected: {
          query: `span.description:${WildcardOperators.CONTAINS}"test test"`,
          focusOverride: {itemKey: 'freeText:1'},
        },
      },
      {
        description: 'when there is already a token present',
        input: {
          action: {
            type: 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE',
            text: 'test',
            tokens: [],
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: 'span.op:eq',
        },
        expected: {
          query: `span.op:eq span.description:${WildcardOperators.CONTAINS}test`,
          focusOverride: {itemKey: 'freeText:2'},
        },
      },
      {
        description: 'when there is already a replace token present',
        input: {
          action: {
            type: 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE',
            text: 'test2',
            tokens: [],
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: `span.description:${WildcardOperators.CONTAINS}test`,
        },
        expected: {
          query: `span.description:${WildcardOperators.CONTAINS}[test,test2]`,
          focusOverride: {itemKey: 'freeText:1'},
        },
      },
      {
        description: 'when there is already a replace token present with a space',
        input: {
          action: {
            type: 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE',
            text: 'other value',
            tokens: [],
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: `span.description:${WildcardOperators.CONTAINS}test`,
        },
        expected: {
          query: `span.description:${WildcardOperators.CONTAINS}[test,"other value"]`,
          focusOverride: {itemKey: 'freeText:1'},
        },
      },
      {
        description:
          'when there is already a replace token present with a different operator',
        input: {
          action: {
            type: 'REPLACE_TOKENS_WITH_TEXT_ON_PASTE',
            text: 'other value',
            tokens: [],
            focusOverride: undefined,
          },
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          currentQuery: `span.description:test`,
        },
        expected: {
          query: `span.description:test span.description:${WildcardOperators.CONTAINS}"other value"`,
          focusOverride: {itemKey: 'freeText:2'},
        },
      },
    ];

    it.each(testCases)('$description', ({input, expected}) => {
      const result = replaceFreeTextTokens(
        input.action,
        input.getFieldDefinition,
        input.rawSearchReplacement,
        input.currentQuery
      );

      expect(result?.newQuery).toBe(expected.query);
      expect(result?.focusOverride).toStrictEqual(expected.focusOverride);
    });
  });
});
