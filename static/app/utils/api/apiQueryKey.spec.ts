import {
  parseQueryKey,
  safeParseQueryKey,
  type ApiQueryKey,
  type InfiniteApiQueryKey,
} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

describe('apiQueryKey', () => {
  describe('parseQueryKey', () => {
    describe('v1', () => {
      it('can parse a v1 query key, without options', () => {
        const queryKey: ApiQueryKey = [getApiUrl('/api-tokens/')];
        const result = parseQueryKey(queryKey);
        expect(result).toEqual({
          version: 'v1',
          isInfinite: false,
          url: '/api-tokens/',
          options: undefined,
        });
      });

      it('can parse a simple query key, with options', () => {
        const queryKey: ApiQueryKey = [
          getApiUrl('/api-tokens/'),
          {query: {filter: 'red'}},
        ];
        const result = parseQueryKey(queryKey);
        expect(result).toEqual({
          version: 'v1',
          isInfinite: false,
          url: '/api-tokens/',
          options: {query: {filter: 'red'}},
        });
      });

      it('can parse an v1 infinite query key, without options', () => {
        const queryKey: InfiniteApiQueryKey = [
          {infinite: true, version: 'v1'},
          getApiUrl('/api-tokens/'),
        ];
        const result = parseQueryKey(queryKey);
        expect(result).toEqual({
          version: 'v1',
          isInfinite: true,
          url: '/api-tokens/',
          options: undefined,
        });
      });

      it('can parse a v2 infinite query key, with options', () => {
        const queryKey: InfiniteApiQueryKey = [
          {infinite: true, version: 'v1'},
          getApiUrl('/api-tokens/'),
          {query: {filter: 'red'}},
        ];
        const result = parseQueryKey(queryKey);
        expect(result).toEqual({
          version: 'v1',
          isInfinite: true,
          url: '/api-tokens/',
          options: {query: {filter: 'red'}},
        });
      });
    });
    describe('v2', () => {
      it('can parse a v2 query key, without options', () => {
        const queryKey: ApiQueryKey = [
          {infinite: false, version: 'v2'},
          getApiUrl('/api-tokens/'),
        ];
        const result = parseQueryKey(queryKey);
        expect(result).toEqual({
          version: 'v2',
          isInfinite: false,
          url: '/api-tokens/',
          options: undefined,
        });
      });

      it('can parse a v2 query key, with options', () => {
        const queryKey: ApiQueryKey = [
          {infinite: false, version: 'v2'},
          getApiUrl('/api-tokens/'),
          {query: {filter: 'red'}},
        ];
        const result = parseQueryKey(queryKey);
        expect(result).toEqual({
          version: 'v2',
          isInfinite: false,
          url: '/api-tokens/',
          options: {query: {filter: 'red'}},
        });
      });

      it('can parse an v2 infinite query key, without options', () => {
        const queryKey: InfiniteApiQueryKey = [
          {infinite: true, version: 'v2'},
          getApiUrl('/api-tokens/'),
        ];
        const result = parseQueryKey(queryKey);
        expect(result).toEqual({
          version: 'v2',
          isInfinite: true,
          url: '/api-tokens/',
          options: undefined,
        });
      });

      it('can parse a v2 infinite query key, with options', () => {
        const queryKey: InfiniteApiQueryKey = [
          {infinite: true, version: 'v2'},
          getApiUrl('/api-tokens/'),
          {query: {filter: 'red'}},
        ];
        const result = parseQueryKey(queryKey);
        expect(result).toEqual({
          version: 'v2',
          isInfinite: true,
          url: '/api-tokens/',
          options: {query: {filter: 'red'}},
        });
      });
    });
  });

  describe('safeParseQueryKey', () => {
    describe('happy path', () => {
      it('parses a v1 query key, without options', () => {
        expect(safeParseQueryKey(['/api-tokens/'])).toEqual({
          version: 'v1',
          isInfinite: false,
          url: '/api-tokens/',
          options: undefined,
        });
      });

      it('parses a v1 query key, with options', () => {
        expect(safeParseQueryKey(['/api-tokens/', {query: {filter: 'red'}}])).toEqual({
          version: 'v1',
          isInfinite: false,
          url: '/api-tokens/',
          options: {query: {filter: 'red'}},
        });
      });

      it('parses a v1 infinite query key, without options', () => {
        expect(
          safeParseQueryKey([{infinite: true, version: 'v1'}, '/api-tokens/'])
        ).toEqual({
          version: 'v1',
          isInfinite: true,
          url: '/api-tokens/',
          options: undefined,
        });
      });

      it('parses a v1 infinite query key, with options', () => {
        expect(
          safeParseQueryKey([
            {infinite: true, version: 'v1'},
            '/api-tokens/',
            {query: {filter: 'red'}},
          ])
        ).toEqual({
          version: 'v1',
          isInfinite: true,
          url: '/api-tokens/',
          options: {query: {filter: 'red'}},
        });
      });

      it('parses a v2 query key, without options', () => {
        expect(
          safeParseQueryKey([{infinite: false, version: 'v2'}, '/api-tokens/'])
        ).toEqual({
          version: 'v2',
          isInfinite: false,
          url: '/api-tokens/',
          options: undefined,
        });
      });

      it('parses a v2 query key, with options', () => {
        expect(
          safeParseQueryKey([
            {infinite: false, version: 'v2'},
            '/api-tokens/',
            {query: {filter: 'red'}},
          ])
        ).toEqual({
          version: 'v2',
          isInfinite: false,
          url: '/api-tokens/',
          options: {query: {filter: 'red'}},
        });
      });

      it('parses a v2 infinite query key, without options', () => {
        expect(
          safeParseQueryKey([{infinite: true, version: 'v2'}, '/api-tokens/'])
        ).toEqual({
          version: 'v2',
          isInfinite: true,
          url: '/api-tokens/',
          options: undefined,
        });
      });

      it('parses a v2 infinite query key, with options', () => {
        expect(
          safeParseQueryKey([
            {infinite: true, version: 'v2'},
            '/api-tokens/',
            {query: {filter: 'red'}},
          ])
        ).toEqual({
          version: 'v2',
          isInfinite: true,
          url: '/api-tokens/',
          options: {query: {filter: 'red'}},
        });
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

      it('returns undefined for v1 with non-object options', () => {
        expect(safeParseQueryKey(['/url/', 'not-an-object'])).toBeUndefined();
      });

      it('returns undefined for an unknown version marker', () => {
        expect(
          safeParseQueryKey([{version: 'v3', infinite: false}, '/url/'])
        ).toBeUndefined();
      });

      it('returns undefined for v2 missing the url', () => {
        expect(safeParseQueryKey([{infinite: false, version: 'v2'}])).toBeUndefined();
      });

      it('returns undefined for v2 with a non-string url', () => {
        expect(
          safeParseQueryKey([{infinite: false, version: 'v2'}, 123])
        ).toBeUndefined();
      });

      it('returns undefined for an infinite key with non-object options', () => {
        expect(
          safeParseQueryKey([{infinite: true, version: 'v1'}, '/url/', 'not-an-object'])
        ).toBeUndefined();
      });
    });

    // The schema validates *shape*, not *intent*. Any [string] or
    // [string, object] tuple — including non-API TanStack queries that happen
    // to match — will parse as a V1 key. Predicate callers must still scope by
    // queryKey filter or check the URL pattern.
    it('parses any [string, object] tuple as a v1 key', () => {
      expect(safeParseQueryKey(['filter', {scope: 'feedback'}])).toEqual({
        version: 'v1',
        isInfinite: false,
        url: 'filter',
        options: {scope: 'feedback'},
      });
    });
  });
});
