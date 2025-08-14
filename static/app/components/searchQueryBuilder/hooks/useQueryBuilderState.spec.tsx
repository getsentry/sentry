import type {FocusOverride} from 'sentry/components/searchQueryBuilder/types';

import {replaceFreeTextTokens, type UpdateQueryAction} from './useQueryBuilderState';

describe('replaceFreeTextTokens', () => {
  describe('when there are no tokens', () => {
    it('should return the original query', () => {
      const result = replaceFreeTextTokens(
        {type: 'UPDATE_QUERY', query: ''},
        () => null,
        [],
        'browser.name:"firefox"'
      );
      expect(result.newQuery).toBe('browser.name:"firefox"');
    });
  });

  describe('when there are no free text tokens', () => {
    it('should return the original query', () => {
      const result = replaceFreeTextTokens(
        {type: 'UPDATE_QUERY', query: 'browser.name:"firefox"'},
        () => null,
        [],
        'browser.name:"firefox"'
      );

      expect(result.newQuery).toBe('browser.name:"firefox"');
    });
  });

  describe('when there are free text tokens', () => {
    type TestCase = {
      description: string;
      expected: {
        focusOverride: FocusOverride | null;
        newQuery: string;
      };
      input: {
        action: UpdateQueryAction;
        getFieldDefinition: () => null;
        queryToCommit: string;
        rawSearchReplacement: string[];
      };
    };

    const testCases: TestCase[] = [
      {
        description: 'when there are no tokens',
        input: {
          action: {type: 'UPDATE_QUERY', query: ''},
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          queryToCommit: '',
        },
        expected: {newQuery: '', focusOverride: null},
      },
      {
        description: 'when there is no raw search replacement',
        input: {
          action: {type: 'UPDATE_QUERY', query: 'browser.name:"firefox"'},
          getFieldDefinition: () => null,
          rawSearchReplacement: [],
          queryToCommit: 'browser.name:"firefox"',
        },
        expected: {newQuery: 'browser.name:"firefox"', focusOverride: null},
      },
      {
        description: 'when there are no free text tokens',
        input: {
          action: {type: 'UPDATE_QUERY', query: 'browser.name:"firefox"'},
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          queryToCommit: 'browser.name:"firefox"',
        },
        expected: {newQuery: 'browser.name:"firefox"', focusOverride: null},
      },
      {
        description: 'when there is one free text token',
        input: {
          action: {type: 'UPDATE_QUERY', query: 'test'},
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          queryToCommit: '',
        },
        expected: {
          newQuery: 'span.description:[*test*]',
          focusOverride: {itemKey: 'end'},
        },
      },
      {
        description: 'when there is one free text token that has a space',
        input: {
          action: {type: 'UPDATE_QUERY', query: 'test test'},
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          queryToCommit: '',
        },
        expected: {
          newQuery: 'span.description:["*test test*"]',
          focusOverride: {itemKey: 'end'},
        },
      },
      {
        description: 'when there is already a token present',
        input: {
          action: {type: 'UPDATE_QUERY', query: 'span.op:eq test'},
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          queryToCommit: '',
        },
        expected: {
          newQuery: 'span.op:eq span.description:[*test*]',
          focusOverride: {itemKey: 'end'},
        },
      },
      {
        description: 'when there is already a replace token present',
        input: {
          action: {type: 'UPDATE_QUERY', query: 'span.description:[*test*] test2'},
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          queryToCommit: '',
        },
        expected: {
          newQuery: 'span.description:[*test*,*test2*]',
          focusOverride: {itemKey: 'end'},
        },
      },
      {
        description: 'when there is already a replace token present with a space',
        input: {
          action: {type: 'UPDATE_QUERY', query: 'span.description:[*test*] other value'},
          getFieldDefinition: () => null,
          rawSearchReplacement: ['span.description'],
          queryToCommit: '',
        },
        expected: {
          newQuery: 'span.description:[*test*,"*other value*"]',
          focusOverride: {itemKey: 'end'},
        },
      },
    ];

    it.each(testCases)('$description', ({input, expected}) => {
      const result = replaceFreeTextTokens(
        input.action,
        input.getFieldDefinition,
        input.rawSearchReplacement,
        input.queryToCommit
      );

      expect(result.newQuery).toBe(expected.newQuery);
      expect(result.focusOverride).toEqual(expected.focusOverride);
    });
  });
});
