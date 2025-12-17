import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {appendReleaseFilters} from './releaseComparison';

describe('appendReleaseFilters', () => {
  let query: MutableSearch;

  beforeEach(() => {
    query = new MutableSearch('transaction.op:ui.load');
  });

  it('appends primary release', () => {
    const result = appendReleaseFilters(query, 'v1.0.0');

    expect(result).toBe('transaction.op:ui.load release:v1.0.0');
  });
});
