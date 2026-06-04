import {
  normalizeQueryKey,
  parseQueryKey,
  safeParseQueryKey,
  type CanonicalApiQueryKey,
  type InfiniteApiQueryKey,
} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

describe('apiQueryKey', () => {
  describe('parseQueryKey', () => {
    it('parses a canonical non-infinite key', () => {
      const queryKey: CanonicalApiQueryKey = [
        getApiUrl('/api-tokens/'),
        {query: {filter: 'red'}},
        {infinite: false},
      ];
      expect(parseQueryKey(queryKey)).toEqual({
        isInfinite: false,
        url: '/api-tokens/',
        options: {query: {filter: 'red'}},
      });
    });

    it('parses a´n infinite key', () => {
      const queryKey: InfiniteApiQueryKey = [
        getApiUrl('/api-tokens/'),
        {query: {filter: 'red'}},
        {infinite: true},
      ];
      expect(parseQueryKey(queryKey)).toEqual({
        isInfinite: true,
        url: '/api-tokens/',
        options: {query: {filter: 'red'}},
      });
    });
  });

  describe('safeParseQueryKey', () => {
    it('parses canonical non-infinite', () => {
      expect(
        safeParseQueryKey(['/api-tokens/', {query: {filter: 'red'}}, {infinite: false}])
      ).toEqual({
        isInfinite: false,
        url: '/api-tokens/',
        options: {query: {filter: 'red'}},
      });
    });

    it('parses canonical infinite', () => {
      expect(
        safeParseQueryKey(['/api-tokens/', {query: {filter: 'red'}}, {infinite: true}])
      ).toEqual({
        isInfinite: true,
        url: '/api-tokens/',
        options: {query: {filter: 'red'}},
      });
    });

    describe('rejection', () => {
      it('returns undefined for an empty array', () => {
        expect(safeParseQueryKey([])).toBeUndefined();
      });

      it('returns undefined when the first element is a number', () => {
        expect(safeParseQueryKey([123])).toBeUndefined();
      });

      it('returns undefined when the first element is null', () => {
        expect(safeParseQueryKey([null])).toBeUndefined();
      });

      it('returns undefined when the first element is not a string', () => {
        expect(safeParseQueryKey([123, {}, {infinite: false}])).toBeUndefined();
      });

      it('returns undefined when the second element is not an object', () => {
        expect(safeParseQueryKey(['/url/', 'not-an-object'])).toBeUndefined();
      });

      it('returns undefined when the third element is not a marker', () => {
        expect(safeParseQueryKey(['/url/', {query: {}}, 'not-a-marker'])).toBeUndefined();
      });

      it('returns undefined when the marker is missing the infinite field', () => {
        expect(safeParseQueryKey(['/url/', {query: {}}, {}])).toBeUndefined();
      });
    });

    it('returns undefined for a [string, object] tuple missing the marker', () => {
      expect(safeParseQueryKey(['filter', {scope: 'feedback'}])).toBeUndefined();
    });
  });

  describe('normalizeQueryKey', () => {
    const url = getApiUrl('/api-tokens/');

    it('returns canonical keys unchanged', () => {
      const key: CanonicalApiQueryKey = [url, {query: {}}, {infinite: false}];
      expect(normalizeQueryKey(key)).toEqual(key);
    });

    it('expands [url] to [url, {}, {infinite: false}]', () => {
      expect(normalizeQueryKey([url])).toEqual([url, {}, {infinite: false}]);
    });

    it('expands [url, opts] to [url, opts, {infinite: false}]', () => {
      expect(normalizeQueryKey([url, {query: {filter: 'red'}}])).toEqual([
        url,
        {query: {filter: 'red'}},
        {infinite: false},
      ]);
    });
  });
});
