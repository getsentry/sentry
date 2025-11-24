import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {appendReleaseFilters} from './releaseComparison';

describe('appendReleaseFilters', () => {
  let query: MutableSearch;

  beforeEach(() => {
    query = new MutableSearch('transaction.op:ui.load');
  });

  it('adds both releases when both are provided and different', () => {
    const result = appendReleaseFilters(query, 'v1.0.0', 'v2.0.0');

    expect(result).toBe('transaction.op:ui.load ( release:v1.0.0 OR release:v2.0.0 )');
  });

  it('adds only primary release when only primary is provided', () => {
    const result = appendReleaseFilters(query, 'v1.0.0', undefined);

    expect(result).toBe('transaction.op:ui.load release:v1.0.0');
  });

  it('adds only primary release when both releases are the same', () => {
    const result = appendReleaseFilters(query, 'v1.0.0', 'v1.0.0');

    expect(result).toBe('transaction.op:ui.load release:v1.0.0');
  });

  it('returns original query when no primary release provided', () => {
    const result = appendReleaseFilters(query, undefined, 'v2.0.0');

    expect(result).toBe('transaction.op:ui.load');
  });

  it('returns original query when both releases are undefined', () => {
    const result = appendReleaseFilters(query, undefined, undefined);

    expect(result).toBe('transaction.op:ui.load');
  });

  it('returns original query when primary release is empty string', () => {
    const result = appendReleaseFilters(query, '', 'v2.0.0');

    expect(result).toBe('transaction.op:ui.load');
  });

  it('handles secondary release when primary is provided', () => {
    const result = appendReleaseFilters(query, 'v1.0.0', '');

    expect(result).toBe('transaction.op:ui.load release:v1.0.0');
  });
});
