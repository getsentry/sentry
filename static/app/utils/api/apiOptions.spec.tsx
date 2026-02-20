import {skipToken, useQuery} from '@tanstack/react-query';
import {expectTypeOf} from 'expect-type';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ApiResult} from 'sentry/api';
import {apiOptions, selectWithHeaders} from 'sentry/utils/api/apiOptions';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
} from 'sentry/utils/queryClient';

type Promisable<T> = T | Promise<T>;
type QueryFunctionResult<T> = Promisable<ApiResult<T>>;

const wrapper = ({children}: {children?: React.ReactNode}) => (
  <QueryClientProvider client={new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG)}>
    {children}
  </QueryClientProvider>
);

describe('apiOptions', () => {
  it('should encode path parameters correctly', () => {
    const options = apiOptions.as<unknown>()(
      '/organizations/$organizationIdOrSlug/releases/$version/',
      {
        staleTime: 0,
        path: {
          organizationIdOrSlug: 'my-org',
          version: 'v 1.0.0',
        },
      }
    );

    expect(options.queryKey[0]).toBe('/organizations/my-org/releases/v%201.0.0/');
  });

  it('should not include empty options in queryKey', () => {
    const options = apiOptions.as<unknown>()('/api-tokens/$tokenId/', {
      staleTime: 0,
      path: {tokenId: '123'},
    });

    expect(options.queryKey).toEqual(['/api-tokens/123/']);
  });

  it('should stringify number path params', () => {
    const options = apiOptions.as<unknown>()('/api-tokens/$tokenId/', {
      staleTime: 0,
      path: {tokenId: 123},
    });

    expect(options.queryKey[0]).toBe('/api-tokens/123/');
  });

  it('should not do accidental replacements', () => {
    // @ts-expect-error Using a sample path, not a real one
    const options = apiOptions.as<unknown>()('/projects/$id1/$id', {
      staleTime: 0,
      path: {id: '123', id1: '456'},
    });

    expect(options.queryKey).toEqual(['/projects/456/123']);
  });

  it('should allow skipToken as path', () => {
    function getOptions(tokenId: string | null) {
      return apiOptions.as<unknown>()('/api-tokens/$tokenId/', {
        staleTime: 0,
        path: tokenId ? {tokenId} : skipToken,
      });
    }

    expect(getOptions('123').queryFn).toEqual(expect.any(Function));
    expect(getOptions('123').queryKey).toEqual(['/api-tokens/123/']);
    expect(getOptions(null).queryFn).toEqual(skipToken);
    expect(getOptions(null).queryKey).toEqual(['/api-tokens/$tokenId/']);
  });

  it('should extract content data per default', async () => {
    const options = apiOptions.as<string[]>()('/projects/', {
      staleTime: 0,
    });

    MockApiClient.addMockResponse({
      url: '/projects/',
      body: ['Project 1', 'Project 2'],
    });

    // @ts-expect-error initialProps is not typed correctly
    const {result} = renderHook(useQuery, {wrapper, initialProps: options});

    await waitFor(() => result.current.isSuccess);

    expect(result.current.data).toEqual(['Project 1', 'Project 2']);
  });

  it('should extract headers', async () => {
    const options = apiOptions.as<string[]>()('/projects/', {
      staleTime: 0,
    });

    MockApiClient.addMockResponse({
      url: '/projects/',
      body: ['Project 1', 'Project 2'],
      headers: {
        Link: 'my-link',
        'X-Hits': 'some-hits',
      },
    });

    const {result} = renderHook(useQuery, {
      wrapper,
      // @ts-expect-error select is not typed correctly
      initialProps: {...options, select: selectWithHeaders(['Link', 'X-Hits'] as const)},
    });

    await waitFor(() => result.current.isSuccess);

    expect(result.current.data).toEqual({
      content: ['Project 1', 'Project 2'],
      headers: {Link: 'my-link', 'X-Hits': 'some-hits'},
    });

    // @ts-expect-error headers should be narrowly typed
    expectTypeOf(result.current.data!.headers).toEqualTypeOf<{
      Link: string | undefined;
      'X-Hits': string | undefined;
    }>();
  });

  describe('types', () => {
    it('should always require staleTime', () => {
      // @ts-expect-error staleTime is required
      apiOptions.as<unknown>()('/projects/$orgSlug/', {path: {orgSlug: 'my-org'}});
      // @ts-expect-error staleTime is required
      apiOptions.as<unknown>()('/projects/', {});
    });

    it('should not allow invalid/excess path parameters', () => {
      const options = apiOptions.as<never>()('/api-tokens/$tokenId/', {
        staleTime: 0,
        // @ts-expect-error Missing required path parameter
        path: {tokenId: 'my-org', invalidParam: 'invalid'},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    it('should require path params for paths with parameters', () => {
      expect(() => {
        const options = apiOptions.as<never>()('/api-tokens/$tokenId/', {
          staleTime: 0,
          // @ts-expect-error Missing required path parameter
          path: {},
        });

        expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
      }).toThrow('Missing path param: tokenId');
    });

    it('should not allow empty path parameters for paths without parameters', () => {
      const options = apiOptions.as<never>()('/api-tokens/', {
        staleTime: 0,
        // @ts-expect-error Empty path parameters not allowed
        path: {},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    it('should not need path params for paths without parameters', () => {
      const options = apiOptions.as<never>()('/api-tokens/', {
        staleTime: 0,
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    it('should allow string or number path parameters', () => {
      const options = apiOptions.as<never>()('/api-tokens/$tokenId/', {
        staleTime: 0,
        path: {tokenId: 123},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();

      const options2 = apiOptions.as<never>()('/api-tokens/$tokenId/', {
        staleTime: 0,
        path: {tokenId: 'abc'},
      });

      expectTypeOf(options2.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    it('should default to never for unknown API paths', () => {
      // @ts-expect-error Unknown API path
      const options = apiOptions.as<never>()('/unknown/$param/', {
        staleTime: 0,
        path: {param: 'value'},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    it('should allow providing manual data type', () => {
      const options = apiOptions.as<number>()('/api-tokens/$tokenId/', {
        staleTime: 0,
        path: {tokenId: 'abc'},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<number>>();
    });

    it('should disallow unknown path if there are no path params', () => {
      const options = apiOptions.as<number>()('/api-tokens/', {
        staleTime: 0,
        // @ts-expect-error Path is not allowed when there are no path params
        path: {bar: 'baz'},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<number>>();
    });

    it('should have a default select that extracts content', () => {
      const options = apiOptions.as<number>()('/api-tokens/$tokenId/', {
        staleTime: 0,
        path: {tokenId: 123},
      });

      expectTypeOf(options.select).returns.toEqualTypeOf<number>();
    });
  });
});
