import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {getLogBodySearchTerms} from 'sentry/views/explore/logs/utils';

describe('explore/logs/utils', function () {
  describe('getLogBodySearchTerms', function () {
    it('splits terms correctly', function () {
      [
        {
          query: 'freetext',
          expected: ['freetext'],
        },
        {
          query: '*freetext_wrapped_wildcards*',
          expected: ['freetext_wrapped_wildcards'],
        },
        {
          query: 'foo*bar*baz',
          expected: ['foo', 'bar', 'baz'],
        },
        {
          query: '*foo*bar*baz*',
          expected: ['foo', 'bar', 'baz'],
        },
        {
          query: 'double**wildcard',
          expected: ['double', 'wildcard'],
        },
        {
          query: `freetext ${OurLogKnownFieldKey.BODY}:logbodyterm`,
          expected: ['freetext', 'logbodyterm'],
        },
        {
          query: `freetext ${OurLogKnownFieldKey.BODY}:*wildbodyterm*`,
          expected: ['freetext', 'wildbodyterm'],
        },
        {
          query: `freetext ${OurLogKnownFieldKey.BODY}:[logbodyterm,logbodyterm2]`,
          expected: ['freetext', 'logbodyterm', 'logbodyterm2'],
        },
        {
          query: `freetext ${OurLogKnownFieldKey.BODY}:[logbodyterm,logbodyterm2] !freetext2`,
          expected: ['freetext', '!freetext2', 'logbodyterm', 'logbodyterm2'],
        },
        {
          query: '*',
          expected: [],
        },
        {
          query: '',
          expected: [],
        },
      ].forEach(({query, expected}) => {
        const search = new MutableSearch(query);
        expect(getLogBodySearchTerms(search)).toEqual(expected);
      });
    });
  });
});
