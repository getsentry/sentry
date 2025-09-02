import {skipToken, useQuery} from '@tanstack/react-query';
import {expectTypeOf} from 'expect-type';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ApiResult} from 'sentry/api';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
} from 'sentry/utils/queryClient';

import {apiOptions, selectWithHeaders} from './apiOptions';

type Promisable<T> = T | Promise<T>;
type QueryFunctionResult<T> = Promisable<ApiResult<T>>;

const wrapper = ({children}: {children?: React.ReactNode}) => (
  <QueryClientProvider client={new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG)}>
    {children}
  </QueryClientProvider>
);

describe('apiOptions', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });
  test('should encode path parameters correctly', () => {
    const options = apiOptions.as<unknown>()(
      '/projects/$orgSlug/$projectSlug/releases/$releaseVersion/',
      {
        staleTime: 0,
        path: {
          orgSlug: 'my-org',
          projectSlug: 'my-project',
          releaseVersion: 'v 1.0.0',
        },
      }
    );

    expect(options.queryKey[0]).toBe('/projects/my-org/my-project/releases/v%201.0.0/');
  });

  test('should not include empty options in queryKey', () => {
    const options = apiOptions.as<unknown>()('/projects/$id/', {
      staleTime: 0,
      path: {id: '123'},
    });

    expect(options.queryKey).toEqual(['/projects/123/']);
  });

  test('should stringify number path params', () => {
    const options = apiOptions.as<unknown>()('/items/$id/', {
      staleTime: 0,
      path: {id: 123},
    });

    expect(options.queryKey[0]).toBe('/items/123/');
  });

  test('should not do accidental replacements', () => {
    const options = apiOptions.as<unknown>()('/projects/$id1/$id', {
      staleTime: 0,
      path: {id: '123', id1: '456'},
    });

    expect(options.queryKey).toEqual(['/projects/456/123']);
  });

  test('should allow skipToken as path', () => {
    function getOptions(id: string | null) {
      return apiOptions.as<unknown>()('/projects/$id/', {
        staleTime: 0,
        path: id ? {id} : skipToken,
      });
    }

    expect(getOptions('123').queryFn).toEqual(expect.any(Function));
    expect(getOptions('123').queryKey).toEqual(['/projects/123/']);
    expect(getOptions(null).queryFn).toEqual(skipToken);
    expect(getOptions(null).queryKey).toEqual(['/projects/$id/']);
  });

  test('should extract content data per default', async () => {
    const options = apiOptions.as<string[]>()('/projects/', {
      staleTime: 0,
    });

    MockApiClient.addMockResponse({
      url: '/projects/',
      body: ['Project 1', 'Project 2'],
    });

    const {result} = renderHook(() => useQuery(options), {wrapper});

    await waitFor(() => result.current.isSuccess);

    expect(result.current.data).toEqual(['Project 1', 'Project 2']);
  });

  test('should extract headers', async () => {
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

    const {result} = renderHook(
      () =>
        useQuery({...options, select: selectWithHeaders(['Link', 'X-Hits'] as const)}),
      {wrapper}
    );

    await waitFor(() => result.current.isSuccess);

    expect(result.current.data).toEqual({
      content: ['Project 1', 'Project 2'],
      headers: {Link: 'my-link', 'X-Hits': 'some-hits'},
    });

    // headers should be narrowly typed
    expectTypeOf(result.current.data!.headers).toEqualTypeOf<{
      Link: string | undefined;
      'X-Hits': string | undefined;
    }>();
  });

  describe('types', () => {
    test('should always require staleTime', () => {
      // @ts-expect-error staleTime is required
      apiOptions.as<unknown>()('/projects/$orgSlug/', {path: {orgSlug: 'my-org'}});
      // @ts-expect-error staleTime is required
      apiOptions.as<unknown>()('/projects/', {});
    });

    test('should not allow invalid path parameters', () => {
      const options = apiOptions.as<never>()('/projects/$orgSlug/', {
        staleTime: 0,
        // @ts-expect-error Invalid path parameter
        path: {orgSlug: 'my-org', invalidParam: 'invalid'},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    test('should not allow excess path parameters', () => {
      const options = apiOptions.as<never>()('/projects/$orgSlug/', {
        staleTime: 0,
        // @ts-expect-error Excess path parameter
        path: {orgSlug: 'my-org', extraParam: 'extra'},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    test('should require path params for paths with parameters', () => {
      expect(() => {
        const options = apiOptions.as<never>()('/projects/$orgSlug/', {
          staleTime: 0,
          // @ts-expect-error Missing required path parameter
          path: {},
        });

        expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
      }).toThrow('Missing path param: orgSlug');
    });

    test('should not allow empty path parameters for paths without parameters', () => {
      const options = apiOptions.as<never>()('/projects/', {
        staleTime: 0,
        // @ts-expect-error Empty path parameters not allowed
        path: {},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    test('should not need path params for paths without parameters', () => {
      const options = apiOptions.as<never>()('/projects/', {
        staleTime: 0,
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    test('should allow string or number path parameters', () => {
      const options = apiOptions.as<never>()('/items/$id/', {
        staleTime: 0,
        path: {id: 123},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();

      const options2 = apiOptions.as<never>()('/items/$id/', {
        staleTime: 0,
        path: {id: 'abc'},
      });

      expectTypeOf(options2.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    test('should default to never for unknown API paths', () => {
      const options = apiOptions.as<never>()('/unknown/$param/', {
        staleTime: 0,
        path: {param: 'value'},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    test('should allow providing manual data type', () => {
      const options = apiOptions.as<number>()('/foo/$bar', {
        staleTime: 0,
        path: {bar: 'baz'},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<number>>();
    });

    test('manual data type should override even for known api urls', () => {
      const options = apiOptions.as<number>()(
        '/projects/$orgSlug/$projectSlug/releases/$releaseVersion/',
        {
          staleTime: 0,
          path: {
            orgSlug: 'my-org',
            projectSlug: 'my-project',
            releaseVersion: 'v1.0.0',
          },
        }
      );

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<number>>();
    });

    test('should disallow path if there are no path params', () => {
      const options = apiOptions.as<number>()('/foo', {
        staleTime: 0,
        // @ts-expect-error Path is not allowed when there are no path params
        path: {bar: 'baz'},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<number>>();
    });

    test('should have a default select that extracts content', () => {
      const options = apiOptions.as<number>()('/items/$id/', {
        staleTime: 0,
        path: {id: 123},
      });

      expectTypeOf(options.select).returns.toEqualTypeOf<number>();
    });
  });
});
