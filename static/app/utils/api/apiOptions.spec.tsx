import * as Sentry from '@sentry/react';
/** @jest-environment jsdom */
import {skipToken, useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {expectTypeOf} from 'expect-type';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {z} from 'zod';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {
  ApiSchemaValidationError,
  apiOptions,
  selectJsonWithHeaders,
} from 'sentry/utils/api/apiOptions';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';

type Promisable<T> = T | Promise<T>;
type QueryFunctionResult<T> = Promisable<ApiResponse<T>>;

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

    const {url} = parseQueryKey(options.queryKey);
    expect(url).toBe('/organizations/my-org/releases/v%201.0.0/');
  });

  it('produces an empty options slot when there are no options', () => {
    const options = apiOptions.as<unknown>()('/api-tokens/$tokenId/', {
      staleTime: 0,
      path: {tokenId: '123'},
    });

    expect(options.queryKey).toEqual(['/api-tokens/123/', {}, {infinite: false}]);
  });

  it('strips undefined top-level values from options in queryKey', () => {
    const options = apiOptions.as<unknown>()('/api-tokens/$tokenId/', {
      staleTime: 0,
      path: {tokenId: '123'},
      query: undefined,
      method: undefined,
    });

    expect(options.queryKey).toEqual(['/api-tokens/123/', {}, {infinite: false}]);
  });

  it('strips undefined deep values from options in queryKey', () => {
    const options = apiOptions.as<unknown>()('/api-tokens/$tokenId/', {
      staleTime: 0,
      path: {tokenId: '123'},
      query: {
        foo: undefined,
        bar: undefined,
      },
      method: undefined,
    });

    expect(options.queryKey).toEqual(['/api-tokens/123/', {}, {infinite: false}]);
  });

  it('keeps defined values when stripping undefined ones', () => {
    const options = apiOptions.as<unknown>()('/api-tokens/$tokenId/', {
      staleTime: 0,
      path: {tokenId: '123'},
      query: {cursor: 'abc'},
      method: undefined,
    });

    expect(options.queryKey).toEqual([
      '/api-tokens/123/',
      {query: {cursor: 'abc'}},
      {infinite: false},
    ]);
  });

  it('should stringify number path params', () => {
    const options = apiOptions.as<unknown>()('/api-tokens/$tokenId/', {
      staleTime: 0,
      path: {tokenId: 123},
    });

    const {url} = parseQueryKey(options.queryKey);
    expect(url).toBe('/api-tokens/123/');
  });

  it('should not do accidental replacements', () => {
    // @ts-expect-error Using a sample path, not a real one
    const options = apiOptions.as<unknown>()('/projects/$id1/$id', {
      staleTime: 0,
      path: {id: '123', id1: '456'},
    });

    expect(options.queryKey).toEqual(['/projects/456/123', {}, {infinite: false}]);
  });

  it('should allow skipToken as path', () => {
    function getOptions(tokenId: string | null) {
      return apiOptions.as<unknown>()('/api-tokens/$tokenId/', {
        staleTime: 0,
        path: tokenId ? {tokenId} : skipToken,
      });
    }

    expect(getOptions('123').queryFn).toEqual(expect.any(Function));
    expect(getOptions('123').queryKey).toEqual([
      '/api-tokens/123/',
      {},
      {infinite: false},
    ]);
    expect(getOptions(null).queryFn).toEqual(skipToken);
    expect(getOptions(null).queryKey).toEqual([
      '/api-tokens/$tokenId/',
      {},
      {infinite: false},
    ]);
  });

  it('should extract content data per default', async () => {
    const options = apiOptions.as<string[]>()('/projects/', {
      staleTime: 0,
    });

    MockApiClient.addMockResponse({
      url: '/projects/',
      body: ['Project 1', 'Project 2'],
    });

    const {result} = renderHookWithProviders(() => useQuery(options));
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data).toEqual(['Project 1', 'Project 2']);
  });

  it('should validate content data per default', async () => {
    const options = apiOptions.schema(z.array(z.string()), '/projects/', {
      staleTime: 0,
    });

    MockApiClient.addMockResponse({
      url: '/projects/',
      body: ['Project 1', 'Project 2'],
    });

    const {result} = renderHookWithProviders(() => useQuery(options));
    await waitFor(() => expect(result.current.isPending).toBe(false));

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
        'X-Hits': '14',
      },
    });

    const {result} = renderHookWithProviders(() =>
      useQuery({...options, select: _ => _})
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.data).toEqual({
      json: ['Project 1', 'Project 2'],
      headers: {Link: 'my-link', 'X-Hits': 14, 'X-Max-Hits': undefined},
    });

    expectTypeOf(result.current.data!.headers).toEqualTypeOf<{
      Link?: string;
      'X-Hits'?: number;
      'X-Max-Hits'?: number;
      'X-Sentry-Direct-Hit'?: string;
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

  describe('schema', () => {
    const ProjectSchema = z.object({
      id: z.string(),
      dateCreated: z.string().transform(value => new Date(value)),
    });

    it('should apply schema transforms to the returned data', async () => {
      const options = apiOptions.schema(z.array(ProjectSchema), '/projects/', {
        staleTime: 0,
      });

      MockApiClient.addMockResponse({
        url: '/projects/',
        body: [{id: '1', dateCreated: '2024-01-01T00:00:00Z'}],
      });

      const {result} = renderHookWithProviders(() => useQuery(options));
      await waitFor(() => expect(result.current.isPending).toBe(false));

      expect(result.current.data).toEqual([
        {id: '1', dateCreated: new Date('2024-01-01T00:00:00Z')},
      ]);
    });

    it('should fail the query when the body does not match the schema', async () => {
      const options = apiOptions.schema(z.array(ProjectSchema), '/projects/', {
        staleTime: 0,
        onInvalid: 'throw',
      });

      MockApiClient.addMockResponse({
        url: '/projects/',
        body: [{id: 123}],
      });

      const {result} = renderHookWithProviders(() => useQuery(options));
      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeInstanceOf(ApiSchemaValidationError);
      expect(result.current.error?.message).toBe(
        'Response from /projects/ did not match the expected schema'
      );
      const {result: parseResult} = result.current.error as ApiSchemaValidationError;
      expect(parseResult.success).toBe(false);
      expect(parseResult.error).toBeInstanceOf(z.ZodError);
      expect(parseResult.error.issues).toEqual([
        expect.objectContaining({path: [0, 'id'], expected: 'string'}),
        expect.objectContaining({path: [0, 'dateCreated'], expected: 'string'}),
      ]);
    });

    it('should expose the error chain and the unvalidated body on the error', async () => {
      const invalidBody = [{id: 123, dateCreated: null}];

      MockApiClient.addMockResponse({
        url: '/projects/',
        body: invalidBody,
        headers: {Link: 'my-link'},
      });

      const {result} = renderHookWithProviders(() =>
        useQuery(
          apiOptions.schema(z.array(ProjectSchema), '/projects/', {
            staleTime: 0,
            onInvalid: 'throw',
          })
        )
      );
      await waitFor(() => expect(result.current.isError).toBe(true));

      const error = result.current.error as ApiSchemaValidationError;

      expect(error.cause).toBeInstanceOf(z.ZodError);
      expect(error.cause).toBe(error.result.error);
      expect(error.cause.issues).toHaveLength(2);

      // A caller that wants to press on can read the body that failed validation
      expect(error.response.json).toEqual(invalidBody);
      expect(error.response.headers.Link).toBe('my-link');
    });

    it('should validate the body but keep the headers when selecting both', async () => {
      MockApiClient.addMockResponse({
        url: '/projects/',
        body: [{id: '1', dateCreated: '2024-01-01T00:00:00Z'}],
        headers: {Link: 'my-link'},
      });

      const {result} = renderHookWithProviders(() =>
        useQuery({
          ...apiOptions.schema(z.array(ProjectSchema), '/projects/', {staleTime: 0}),
          select: selectJsonWithHeaders,
        })
      );
      await waitFor(() => expect(result.current.isPending).toBe(false));

      expect(result.current.data?.json).toEqual([
        {id: '1', dateCreated: new Date('2024-01-01T00:00:00Z')},
      ]);
      expect(result.current.data?.headers.Link).toBe('my-link');
    });

    it('should allow skipToken as path', () => {
      function getOptions(tokenId: string | null) {
        return apiOptions.schema(z.object({id: z.string()}), '/api-tokens/$tokenId/', {
          staleTime: 0,
          path: tokenId ? {tokenId} : skipToken,
        });
      }

      expect(getOptions('123').queryFn).toEqual(expect.any(Function));
      expect(getOptions(null).queryFn).toEqual(skipToken);
      expect(getOptions(null).enabled).toBe(false);
    });

    it('should validate each page of an infinite query', async () => {
      const options = apiOptions.schemaInfinite(z.array(ProjectSchema), '/projects/', {
        staleTime: 0,
      });

      MockApiClient.addMockResponse({
        url: '/projects/',
        body: [{id: '1', dateCreated: '2024-01-01T00:00:00Z'}],
      });

      const {result} = renderHookWithProviders(() => useInfiniteQuery(options));
      await waitFor(() => expect(result.current.isPending).toBe(false));

      expect(result.current.data?.pages[0]?.json).toEqual([
        {id: '1', dateCreated: new Date('2024-01-01T00:00:00Z')},
      ]);
    });

    describe('onInvalid', () => {
      const invalidBody = [{id: 123, dateCreated: null}];

      function renderInvalidResponse(onInvalid?: 'throw' | 'passthrough') {
        MockApiClient.addMockResponse({url: '/projects/', body: invalidBody});

        return renderHookWithProviders(() =>
          useQuery(
            apiOptions.schema(z.array(ProjectSchema), '/projects/', {
              staleTime: 0,
              onInvalid,
            })
          )
        );
      }

      beforeEach(() => {
        ConfigStore.set('features', new Set());
        OrganizationStore.reset();
      });

      afterEach(() => {
        ConfigStore.set('features', new Set());
        OrganizationStore.reset();
        jest.restoreAllMocks();
      });

      it('should default to returning the unvalidated body', async () => {
        const {result} = renderInvalidResponse();
        await waitFor(() => expect(result.current.isPending).toBe(false));

        expect(result.current.isError).toBe(false);
        expect(result.current.data).toEqual(invalidBody);
      });

      it('should report to Sentry even when it returns the unvalidated body', async () => {
        const captureException = jest.spyOn(Sentry, 'captureException');

        const {result} = renderInvalidResponse();
        await waitFor(() => expect(result.current.isPending).toBe(false));

        expect(captureException).toHaveBeenCalledWith(
          expect.any(ApiSchemaValidationError)
        );
      });

      it('should report to Sentry when it throws', async () => {
        const captureException = jest.spyOn(Sentry, 'captureException');

        const {result} = renderInvalidResponse('throw');
        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(captureException).toHaveBeenCalledWith(
          expect.any(ApiSchemaValidationError)
        );
      });

      it('should throw when the system feature is enabled', async () => {
        ConfigStore.set('features', new Set(['system:api-schema-strict']));

        const {result} = renderInvalidResponse();
        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(result.current.error).toBeInstanceOf(ApiSchemaValidationError);
      });

      it('should throw when the organization feature is enabled', async () => {
        OrganizationStore.onUpdate(
          OrganizationFixture({features: ['api-schema-strict']}),
          {replace: true}
        );

        const {result} = renderInvalidResponse();
        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(result.current.error).toBeInstanceOf(ApiSchemaValidationError);
      });

      it('should let the call site opt out of a feature that is enabled', async () => {
        ConfigStore.set('features', new Set(['system:api-schema-strict']));
        OrganizationStore.onUpdate(
          OrganizationFixture({features: ['api-schema-strict']}),
          {replace: true}
        );

        const {result} = renderInvalidResponse('passthrough');
        await waitFor(() => expect(result.current.isPending).toBe(false));

        expect(result.current.isError).toBe(false);
        expect(result.current.data).toEqual(invalidBody);
      });

      it('should keep onInvalid out of the queryKey', () => {
        const strict = apiOptions.schema(ProjectSchema, '/projects/', {
          staleTime: 0,
          onInvalid: 'throw',
        });
        const lenient = apiOptions.schema(ProjectSchema, '/projects/', {
          staleTime: 0,
          onInvalid: 'passthrough',
        });

        expect(strict.queryKey).toEqual(lenient.queryKey);
      });
    });

    describe('types', () => {
      it('should derive the data type from the schema output', () => {
        const options = apiOptions.schema(ProjectSchema, '/api-tokens/$tokenId/', {
          staleTime: 0,
          path: {tokenId: 123},
        });

        expectTypeOf(options.select).returns.toEqualTypeOf<{
          dateCreated: Date;
          id: string;
        }>();
      });

      it('should still enforce staleTime and path params', () => {
        const schema = z.object({id: z.string()});

        // @ts-expect-error staleTime is required
        apiOptions.schema(schema, '/projects/', {});

        expect(() => {
          apiOptions.schema(
            schema,
            '/api-tokens/$tokenId/',
            // @ts-expect-error Missing required path parameter
            {staleTime: 0, path: {}}
          );
        }).toThrow('Missing path param: tokenId');
      });
    });
  });
});
