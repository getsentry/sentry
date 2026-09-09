import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import {useQueryParamState} from 'sentry/utils/url/useQueryParamState';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';

describe('useQueryParamState', () => {
  it('should get the initial value from the query param', () => {
    const {result} = renderHookWithProviders(
      () => useQueryParamState({fieldName: 'testField'}),
      {
        additionalWrapper: UrlParamBatchProvider,
        initialRouterConfig: {
          location: {pathname: '/', query: {testField: 'initial state'}},
        },
      }
    );

    expect(result.current[0]).toBe('initial state');
  });

  it('should update the local state and the query param', () => {
    const {result, router} = renderHookWithProviders(
      () => useQueryParamState({fieldName: 'testField'}),
      {
        additionalWrapper: UrlParamBatchProvider,
        initialRouterConfig: {
          location: {pathname: '/', query: {testField: 'initial state'}},
        },
      }
    );

    act(() => {
      result.current[1]('newValue');
    });

    // The local state should be updated
    expect(result.current[0]).toBe('newValue');

    // The query param should be updated
    expect(router.location).toMatchObject({
      pathname: '/',
      query: {testField: 'newValue'},
    });

    // The local state should be still reflect the new value
    expect(result.current[0]).toBe('newValue');
  });

  it('should use the decoder function to decode the query param value if provided', () => {
    const testDeserializer = (value: string) => `${value.toUpperCase()} - decoded`;

    const {result} = renderHookWithProviders(
      () => useQueryParamState({fieldName: 'testField', deserializer: testDeserializer}),
      {
        additionalWrapper: UrlParamBatchProvider,
        initialRouterConfig: {
          location: {pathname: '/', query: {testField: 'initial state'}},
        },
      }
    );

    expect(result.current[0]).toBe('INITIAL STATE - decoded');
  });

  it('can take any kind of value and serialize it to a string compatible with query params', () => {
    type TestType = {
      count: number;
      isActive: boolean;
      value: string;
    };

    const testSerializer = (value: TestType) =>
      `${value.value} - ${value.count} - ${value.isActive}`;

    const {result, router} = renderHookWithProviders(
      () => useQueryParamState({fieldName: 'testField', serializer: testSerializer}),
      {
        additionalWrapper: UrlParamBatchProvider,
      }
    );

    act(() => {
      result.current[1]({value: 'newValue', count: 2, isActive: true});
    });

    expect(router.location).toMatchObject({
      pathname: '/',
      query: {testField: 'newValue - 2 - true'},
    });
  });

  it('can decode and update sorts', () => {
    const {result, router} = renderHookWithProviders(
      () =>
        useQueryParamState<Sort[]>({
          fieldName: 'sort',
          decoder: decodeSorts,
          serializer: value => value.map(formatSort),
        }),
      {
        additionalWrapper: UrlParamBatchProvider,
        initialRouterConfig: {
          location: {pathname: '/', query: {sort: '-testField'}},
        },
      }
    );

    expect(result.current[0]).toEqual([{field: 'testField', kind: 'desc'}]);

    act(() => {
      result.current[1]([{field: 'testField', kind: 'asc'}]);
    });

    expect(router.location).toMatchObject({
      pathname: '/',
      query: {sort: 'testField'},
    });
  });

  it('should not sync local state when URL changes if syncStateWithUrl is false', () => {
    const {result, router} = renderHookWithProviders(
      () => useQueryParamState({fieldName: 'testField'}),
      {
        additionalWrapper: UrlParamBatchProvider,
        initialRouterConfig: {
          location: {pathname: '/', query: {testField: 'initial state'}},
        },
      }
    );

    expect(result.current[0]).toBe('initial state');

    // Simulate URL change (e.g., browser back/forward navigation)
    router.navigate('/?testField=changed%20via%20URL');

    // Local state should NOT be updated because syncStateWithUrl is false
    expect(result.current[0]).toBe('initial state');
  });

  it('should sync local state when URL changes if syncStateWithUrl is true', () => {
    const {result, router} = renderHookWithProviders(
      () => useQueryParamState({fieldName: 'testField', syncStateWithUrl: true}),
      {
        additionalWrapper: UrlParamBatchProvider,
        initialRouterConfig: {
          location: {pathname: '/', query: {testField: 'initial state'}},
        },
      }
    );

    expect(result.current[0]).toBe('initial state');

    // Simulate URL change (e.g., browser back/forward navigation)
    router.navigate('/?testField=changed%20via%20URL');

    // Local state should be updated because syncStateWithUrl is true
    expect(result.current[0]).toBe('changed via URL');
  });
});
