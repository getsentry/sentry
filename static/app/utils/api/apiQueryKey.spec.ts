import {
  parseQueryKey,
  type ApiQueryKey,
  type InfiniteApiQueryKey,
} from 'sentry/utils/api/apiQueryKey';
import getApiUrl from 'sentry/utils/api/getApiUrl';

describe('apiQueryKey', () => {
  describe('parseQueryKey', () => {
    it('can parse a simple query key, without options', () => {
      const queryKey: ApiQueryKey = ['apiOptions', getApiUrl('/api-tokens/')];
      const result = parseQueryKey(queryKey);
      expect(result).toEqual({
        isInfinite: false,
        url: '/api-tokens/',
        options: undefined,
      });
    });

    it('can parse a simple query key, with options', () => {
      const queryKey: ApiQueryKey = [getApiUrl('/api-tokens/'), {query: {filter: 'red'}}];
      const result = parseQueryKey(queryKey);
      expect(result).toEqual({
        isInfinite: false,
        url: '/api-tokens/',
        options: {query: {filter: 'red'}},
      });
    });

    it('can parse an infinite query key, without options', () => {
      const queryKey: InfiniteApiQueryKey = ['infinite', getApiUrl('/api-tokens/')];
      const result = parseQueryKey(queryKey);
      expect(result).toEqual({
        isInfinite: true,
        url: '/api-tokens/',
        options: undefined,
      });
    });

    it('can parse a infinite query key, with options', () => {
      const queryKey: InfiniteApiQueryKey = [
        'apiOptions',
        'infinite',
        getApiUrl('/api-tokens/'),
        {query: {filter: 'red'}},
      ];
      const result = parseQueryKey(queryKey);
      expect(result).toEqual({
        isInfinite: true,
        url: '/api-tokens/',
        options: {query: {filter: 'red'}},
      });
    });
  });
});
