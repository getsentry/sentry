import {ensureQuotedTextFilters} from 'sentry/views/metrics/metricSearchBar';

describe('ensureQuotedTextFilters', () => {
  it('returns a query with all text filters quoted', () => {
    expect(ensureQuotedTextFilters('transaction:/{organization_slug}/')).toEqual(
      'transaction:"/{organization_slug}/"'
    );

    // transaction.duration defaults to a number filter
    expect(ensureQuotedTextFilters('transaction.duration:100')).toEqual(
      'transaction.duration:100'
    );
  });

  it('applies config overrides', () => {
    expect(
      ensureQuotedTextFilters('transaction:100', {
        numericKeys: new Set(['transaction']),
      })
    ).toEqual('transaction:100');

    expect(
      ensureQuotedTextFilters('transaction.duration:100', {
        numericKeys: new Set([]),
      })
    ).toEqual('transaction.duration:"100"');
  });
});
