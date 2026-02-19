import {skipToken} from '@tanstack/react-query';
import {expectTypeOf} from 'expect-type';

import {getQueryKey, parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey, InfiniteApiQueryKey} from 'sentry/utils/queryClient';

describe('apiQueryKey', () => {
  describe('getQueryKey', () => {
    it('should return only url when no options are provided', () => {
      const key = getQueryKey('/api-tokens/');

      expect(key).toEqual(['/api-tokens/']);
    });

    it('should not require path parameters if none are present', () => {
      const key = getQueryKey('/auth-v2/merge-accounts/');

      expect(key).toEqual(['/auth-v2/merge-accounts/']);
    });

    it('should replace path parameters with their values', () => {
      const key = getQueryKey('/organizations/$organizationIdOrSlug/issues/', {
        path: {organizationIdOrSlug: 'sentry'},
      });

      expect(key).toEqual(['/organizations/sentry/issues/']);
    });

    it('should include query options in the key when provided', () => {
      const key = getQueryKey('/auth-v2/merge-accounts/', {
        query: {limit: 25, shortIdLookup: 0, queryReferrer: 'feedback_list_page'},
      });

      expect(key).toEqual([
        '/auth-v2/merge-accounts/',
        {query: {limit: 25, shortIdLookup: 0, queryReferrer: 'feedback_list_page'}},
      ]);
    });

    it('should include both path and query options in the key', () => {
      const key = getQueryKey('/organizations/$organizationIdOrSlug/issues/', {
        path: {organizationIdOrSlug: 'sentry'},
        query: {limit: 25, shortIdLookup: 0, queryReferrer: 'feedback_list_page'},
      });

      expect(key).toEqual([
        '/organizations/sentry/issues/',
        {
          query: {limit: 25, shortIdLookup: 0, queryReferrer: 'feedback_list_page'},
        },
      ]);
    });

    it('should not include empty options in queryKey', () => {
      const key = getQueryKey('/api-tokens/$tokenId/', {
        path: {tokenId: '123'},
      });

      expect(key).toEqual(['/api-tokens/123/']);
    });

    it('should encode path parameters correctly', () => {
      const key = getQueryKey('/organizations/$organizationIdOrSlug/releases/$version/', {
        path: {
          organizationIdOrSlug: 'my-org',
          version: 'v 1.0.0',
        },
      });

      expect(key[0]).toBe('/organizations/my-org/releases/v%201.0.0/');
    });

    it('should stringify number path params', () => {
      const key = getQueryKey('/api-tokens/$tokenId/', {
        path: {tokenId: 123},
      });

      expect(key).toEqual(['/api-tokens/123/']);
    });

    it('should allow skipToken as path and return template as first element', () => {
      expect(getQueryKey('/api-tokens/$tokenId/', {path: {tokenId: 123}})).toEqual([
        '/api-tokens/123/',
      ]);
      expect(getQueryKey('/api-tokens/$tokenId/', {path: skipToken})).toEqual([
        '/api-tokens/$tokenId/',
      ]);
    });

    it('should include endpoint options when path is skipToken', () => {
      const key = getQueryKey('/api-tokens/$tokenId/', {
        path: skipToken,
        query: {limit: 10},
      });

      expect(key).toEqual(['/api-tokens/$tokenId/', {query: {limit: 10}}]);
    });

    describe('types', () => {
      it('should return ApiQueryKey type', () => {
        const key = getQueryKey('/api-tokens/');

        expectTypeOf(key).toEqualTypeOf<ApiQueryKey>();
      });

      it('should return ApiQueryKey with options when query is provided', () => {
        const key = getQueryKey('/api-tokens/', {
          query: {limit: 25},
        });

        expectTypeOf(key).toMatchTypeOf<ApiQueryKey>();
        expect(key).toHaveLength(2);
      });

      it('should not allow invalid/excess path parameters', () => {
        getQueryKey('/api-tokens/$tokenId/', {
          // @ts-expect-error Invalid path parameter
          path: {tokenId: 'my-token', invalidParam: 'invalid'},
        });
      });

      it('should require path params for paths with parameters', () => {
        expect(() => {
          getQueryKey('/api-tokens/$tokenId/', {
            // @ts-expect-error Missing required path parameter
            path: {},
          });
        }).toThrow('Missing path param: tokenId');
      });

      it('should not allow path parameters for paths without parameters', () => {
        getQueryKey('/api-tokens/', {
          // @ts-expect-error Path is not allowed when there are no path params
          path: {bar: 'baz'},
        });
      });

      it('should allow string or number path parameters', () => {
        const key1 = getQueryKey('/api-tokens/$tokenId/', {
          path: {tokenId: 123},
        });
        expect(key1).toEqual(['/api-tokens/123/']);

        const key2 = getQueryKey('/api-tokens/$tokenId/', {
          path: {tokenId: 'abc'},
        });
        expect(key2).toEqual(['/api-tokens/abc/']);
      });
    });
  });

  describe('parseQueryKey', () => {
    it('can parse a simple query key, without options', () => {
      const queryKey: ApiQueryKey = [getApiUrl('/api-tokens/')];
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
