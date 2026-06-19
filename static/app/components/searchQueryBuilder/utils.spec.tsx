import {
  parseQueryBuilderValue,
  queryIsValid,
} from 'sentry/components/searchQueryBuilder/utils';
import {InvalidReason, Token} from 'sentry/components/searchSyntax/parser';
import {FieldKind} from 'sentry/utils/fields';

describe('parseQueryBuilderValue', () => {
  it('marks invalidFilterKeys as invalid tokens', () => {
    const parsed = parseQueryBuilderValue('browser.name:firefox', () => null, {
      filterKeys: {
        'browser.name': {
          key: 'browser.name',
          name: 'Browser Name',
          kind: FieldKind.FIELD,
        },
      },
      invalidFilterKeys: ['browser.name'],
    });

    const filterToken = parsed?.find(token => token.type === Token.FILTER);

    expect(filterToken?.invalid).toMatchObject({
      type: InvalidReason.INVALID_KEY,
      reason: 'Invalid key. "browser.name" is not a supported search key.',
    });
    expect(queryIsValid(parsed)).toBe(false);
  });
});
