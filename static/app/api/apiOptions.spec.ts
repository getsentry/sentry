import {expectTypeOf} from 'expect-type';

import type {ApiResult} from 'sentry/api';
import type {Release} from 'sentry/types/release';

import {apiOptions} from './apiOptions';

type QueryFunctionResult<T> = Promise<ApiResult<T>> | ApiResult<T>;

describe('apiOptions', () => {
  test('should encode path parameters correctly', () => {
    const options = apiOptions(
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

  test('should not modify already encoded parameters', () => {
    const options = apiOptions('/search/$query/', {
      staleTime: 0,
      path: {query: 'test%20query'},
    });

    expect(options.queryKey[0]).toBe('/search/test%20query/');
  });

  test('should not include empty options in queryKey', () => {
    const options = apiOptions('/projects/$id/', {
      staleTime: 0,
      path: {id: '123'},
    });

    expect(options.queryKey).toEqual(['/projects/123/']);
  });

  test('should stringify number path params', () => {
    const options = apiOptions('/items/$id/', {
      staleTime: 0,
      path: {id: 123},
    });

    expect(options.queryKey[0]).toBe('/items/123/');
  });

  test('should not do accidental replacements', () => {
    const options = apiOptions('/projects/$id1/$id', {
      staleTime: 0,
      path: {id: '123', id1: '456'},
    });

    expect(options.queryKey).toEqual(['/projects/456/123']);
  });

  describe('types', () => {
    test('should infer types of known API paths', () => {
      const options = apiOptions(
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

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<Release>>();
    });

    test('should not allow invalid path parameters', () => {
      const options = apiOptions('/projects/$orgSlug/', {
        staleTime: 0,
        // @ts-expect-error Invalid path parameter
        path: {orgSlug: 'my-org', invalidParam: 'invalid'},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    test('should not allow excess path parameters', () => {
      const options = apiOptions('/projects/$orgSlug/', {
        staleTime: 0,
        // @ts-expect-error Excess path parameter
        path: {orgSlug: 'my-org', extraParam: 'extra'},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    test('should require path params for paths with parameters', () => {
      expect(() => {
        const options = apiOptions('/projects/$orgSlug/', {
          staleTime: 0,
          // @ts-expect-error Missing required path parameter
          path: {},
        });

        expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
      }).toThrow('Missing path param: orgSlug');
    });

    test('should not allow empty path parameters for paths without parameters', () => {
      const options = apiOptions('/projects/', {
        staleTime: 0,
        // @ts-expect-error Empty path parameters not allowed
        path: {},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    test('should not need path params for paths without parameters', () => {
      const options = apiOptions('/projects/', {
        staleTime: 0,
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    test('should allow string or number path parameters', () => {
      const options = apiOptions('/items/$id/', {
        staleTime: 0,
        path: {id: 123}, // number
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();

      const options2 = apiOptions('/items/$id/', {
        staleTime: 0,
        path: {id: 'abc'}, // string
      });

      expectTypeOf(options2.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    test('should default to never for unknown API paths', () => {
      const options = apiOptions('/unknown/$param/', {
        staleTime: 0,
        path: {param: 'value'},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<never>>();
    });

    test('should allow providing manual data type', () => {
      const options = apiOptions.ReturnType<number>()('/foo/$bar', {
        staleTime: 0,
        path: {bar: 'baz'},
      });

      expectTypeOf(options.queryFn).returns.toEqualTypeOf<QueryFunctionResult<number>>();
    });
  });
});
