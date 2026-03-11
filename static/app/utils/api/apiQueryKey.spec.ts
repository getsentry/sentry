import {
  parseQueryKey,
  type ApiQueryKey,
  type InfiniteApiQueryKey,
} from 'sentry/utils/api/apiQueryKey';
import getApiUrl from 'sentry/utils/api/getApiUrl';

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
});
