import type {FocusOverride} from 'sentry/components/searchQueryBuilder/types';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {WildcardOperators} from 'sentry/components/searchSyntax/parser';
import {FieldKind, type FieldDefinition} from 'sentry/utils/fields';

import {replaceFreeTextTokens} from './useQueryBuilderState';

describe('replaceFreeTextTokens', () => {
  describe('when there are free text tokens', () => {
    type TestCase = {
      description: string;
      expected: {
        focusOverride: FocusOverride | undefined;
        query: string | undefined;
      };
      input: {
        currentQuery: string;
        rawSearchReplacement: string[];
      };
    };

    const testCases: TestCase[] = [
      {
        description: 'when there are no tokens',
        input: {
          rawSearchReplacement: ['span.description'],
          currentQuery: '',
        },
        expected: {
          query: undefined,
          focusOverride: undefined,
        },
      },
      {
        description: 'when the replace raw search keys is empty',
        input: {
          rawSearchReplacement: [],
          currentQuery: '',
        },
        expected: {
          query: undefined,
          focusOverride: undefined,
        },
      },
      {
        description: 'when the replace raw search keys is an empty string',
        input: {
          rawSearchReplacement: [''],
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
          rawSearchReplacement: ['span.description'],
          currentQuery: 'span.op:eq',
        },
        expected: {
          query: undefined,
          focusOverride: undefined,
        },
      },
      {
        description: 'when there only space free text tokens in the action',
        input: {
          rawSearchReplacement: ['span.description'],
          currentQuery: 'span.op:eq    ',
        },
        expected: {
          query: undefined,
          focusOverride: undefined,
        },
      },
      {
        description: 'when there is one free text token',
        input: {
          rawSearchReplacement: ['span.description'],
          currentQuery: 'test',
        },
        expected: {
          query: `span.description:${WildcardOperators.CONTAINS}test`,
          focusOverride: {itemKey: 'freeText:1'},
        },
      },
      {
        description: 'when there is one free text token that has a space',
        input: {
          rawSearchReplacement: ['span.description'],
          currentQuery: 'test test',
        },
        expected: {
          query: `span.description:"*test*test*"`,
          focusOverride: {itemKey: 'freeText:1'},
        },
      },
      {
        description: 'when there is already a token present',
        input: {
          rawSearchReplacement: ['span.description'],
          currentQuery: 'span.op:eq test',
        },
        expected: {
          query: `span.op:eq span.description:${WildcardOperators.CONTAINS}test`,
          focusOverride: {itemKey: 'freeText:2'},
        },
      },
      {
        description: 'when there is already a replace token present',
        input: {
          rawSearchReplacement: ['span.description'],
          currentQuery: `span.description:${WildcardOperators.CONTAINS}test test2`,
        },
        expected: {
          query: `span.description:${WildcardOperators.CONTAINS}test span.description:${WildcardOperators.CONTAINS}test2`,
          focusOverride: {itemKey: 'freeText:2'},
        },
      },
      {
        description: 'when there is already a replace token present with a space',
        input: {
          rawSearchReplacement: ['span.description'],
          currentQuery: `span.description:${WildcardOperators.CONTAINS}test other value`,
        },
        expected: {
          query: `span.description:${WildcardOperators.CONTAINS}test span.description:"*other*value*"`,
          focusOverride: {itemKey: 'freeText:2'},
        },
      },
      {
        description:
          'when there is already a replace token present with a different operator',
        input: {
          rawSearchReplacement: ['span.description'],
          currentQuery: `span.description:test other value`,
        },
        expected: {
          query: `span.description:test span.description:"*other*value*"`,
          focusOverride: {itemKey: 'freeText:2'},
        },
      },
      {
        description: 'when the value contains an asterisks, it sets to is',
        input: {
          rawSearchReplacement: ['span.description'],
          currentQuery: `span.description:test te*st`,
        },
        expected: {
          query: `span.description:test span.description:te*st`,
          focusOverride: {itemKey: 'freeText:2'},
        },
      },
      {
        description: 'when the value contains a space and asterisks, it sets to is',
        input: {
          rawSearchReplacement: ['span.description'],
          currentQuery: `te*st test`,
        },
        expected: {
          query: `span.description:"te*st test"`,
          focusOverride: {itemKey: 'freeText:1'},
        },
      },
      {
        description:
          'when the value contains multiple spaces, it removes them and will replace them with a single space, and apply fuzzy matching',
        input: {
          rawSearchReplacement: ['span.description'],
          currentQuery: `test  test`,
        },
        expected: {
          query: `span.description:"*test*test*"`,
          focusOverride: {itemKey: 'freeText:1'},
        },
      },
      {
        description: 'when the value is an aggregate filter token, it ignores it',
        input: {
          rawSearchReplacement: ['span.description'],
          currentQuery: `p75(span.duration):>300ms test`,
        },
        expected: {
          query: `p75(span.duration):>300ms span.description:${WildcardOperators.CONTAINS}test`,
          focusOverride: {itemKey: 'freeText:2'},
        },
      },
    ];

    it.each(testCases)('$description', ({input, expected}) => {
      const result = replaceFreeTextTokens(
        input.currentQuery,
        (query: string) =>
          parseQueryBuilderValue(
            query,
            (key: string) => {
              if (key === 'span.duration') {
                return {
                  desc: 'The total time taken by the span',
                  kind: 'metric',
                  valueType: 'duration',
                } as FieldDefinition;
              }
              return null;
            },
            {
              disallowUnsupportedFilters: true,
              filterKeys: {
                'span.duration': {
                  key: 'span.duration',
                  name: 'span.duration',
                  kind: FieldKind.MEASUREMENT,
                },
              },
            }
          ),
        input.rawSearchReplacement
      );

      expect(result?.newQuery).toBe(expected.query);
      expect(result?.focusOverride).toStrictEqual(expected.focusOverride);
    });
  });
});
