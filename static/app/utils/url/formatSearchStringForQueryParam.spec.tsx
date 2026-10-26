import {MutableSearch as ParsedMutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {formatSearchStringForQueryParam} from 'sentry/utils/url/formatSearchStringForQueryParam';

describe('formatSearchStringForQueryParam', () => {
  it('should format a search string for use as a query parameter', () => {
    expect(formatSearchStringForQueryParam('test')).toBe('test');
  });

  it('should format a MutableSearch object for use as a query parameter', () => {
    expect(formatSearchStringForQueryParam(new MutableSearch('test'))).toBe('test');
  });

  it('should format a parser-based MutableSearch object for use as a query parameter', () => {
    expect(formatSearchStringForQueryParam(new ParsedMutableSearch('test'))).toBe('test');
  });

  it('should serialize a bracketed list from either implementation unchanged', () => {
    const query =
      'span.op:pageload sentry.segment.name:["/issues/", "/issues/:groupId/"]';

    expect(formatSearchStringForQueryParam(new ParsedMutableSearch(query))).toBe(query);
    expect(formatSearchStringForQueryParam(new MutableSearch(query))).toBe(query);
  });

  it('should return undefined if the query is undefined', () => {
    expect(formatSearchStringForQueryParam(undefined)).toBeUndefined();
  });
});
