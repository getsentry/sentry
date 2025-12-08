import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {formatSearchStringForQueryParam} from 'sentry/utils/url/formatSearchStringForQueryParam';

describe('formatSearchStringForQueryParam', () => {
  it('should format a search string for use as a query parameter', () => {
    expect(formatSearchStringForQueryParam('test')).toBe('test');
  });

  it('should format a MutableSearch object for use as a query parameter', () => {
    expect(formatSearchStringForQueryParam(new MutableSearch('test'))).toBe('test');
  });

  it('should return undefined if the query is undefined', () => {
    expect(formatSearchStringForQueryParam(undefined)).toBeUndefined();
  });
});
