import {
  parseQueryBuilderValue,
  queryIsValid,
} from 'sentry/components/searchQueryBuilder/utils';
import {InvalidReason, Token} from 'sentry/components/searchSyntax/parser';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';

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

  it('marks invalid aggregate filter keys as invalid tokens', () => {
    const parsed = parseQueryBuilderValue(
      'p95(span.duration):>1s',
      key => {
        if (key === 'p95') {
          return {
            kind: FieldKind.FUNCTION,
            valueType: null,
            parameterDependentValueType: () => FieldValueType.DURATION,
            parameters: [
              {
                name: 'column',
                kind: 'column',
                columnTypes: [FieldValueType.DURATION],
                required: true,
              },
            ],
          };
        }

        if (key === 'span.duration') {
          return {
            kind: FieldKind.MEASUREMENT,
            valueType: FieldValueType.DURATION,
          };
        }

        return null;
      },
      {
        filterKeys: {
          p95: {
            key: 'p95',
            name: 'p95',
            kind: FieldKind.FUNCTION,
          },
          'span.duration': {
            key: 'span.duration',
            name: 'Span Duration',
            kind: FieldKind.MEASUREMENT,
          },
        },
        invalidFilterKeys: ['p95(span.duration)'],
      }
    );

    const filterToken = parsed?.find(token => token.type === Token.FILTER);

    expect(filterToken?.invalid).toMatchObject({
      type: InvalidReason.INVALID_KEY,
      reason: 'Invalid key. "p95(span.duration)" is not a supported search key.',
    });
    expect(queryIsValid(parsed)).toBe(false);
  });
});
