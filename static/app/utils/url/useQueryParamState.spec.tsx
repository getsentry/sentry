import {LocationFixture} from 'sentry-fixture/locationFixture';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import {useQueryParamState} from 'sentry/utils/url/useQueryParamState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');

const mockedUseLocation = jest.mocked(useLocation);
const mockedUseNavigate = jest.mocked(useNavigate);

describe('useQueryParamState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should get the initial value from the query param', () => {
    mockedUseLocation.mockReturnValue(
      LocationFixture({query: {testField: 'initial state'}})
    );

    const {result} = renderHook(() => useQueryParamState({fieldName: 'testField'}), {
      wrapper: UrlParamBatchProvider,
    });

    expect(result.current[0]).toBe('initial state');
  });

  it('should update the local state and the query param', () => {
    const mockedNavigate = jest.fn();
    mockedUseNavigate.mockReturnValue(mockedNavigate);

    const {result} = renderHook(() => useQueryParamState({fieldName: 'testField'}), {
      wrapper: UrlParamBatchProvider,
    });

    act(() => {
      result.current[1]('newValue');
    });

    // The local state should be updated
    expect(result.current[0]).toBe('newValue');

    // The query param should not be updated yet
    expect(mockedNavigate).not.toHaveBeenCalledWith(
      {
        pathname: '/',
        query: {testField: 'initial state'},
      },
      {replace: true, preventScrollReset: true}
    );

    // Run the timers to trigger queued updates
    jest.runAllTimers();

    // The query param should be updated
    expect(mockedNavigate).toHaveBeenCalledWith(
      {
        pathname: '/',
        query: {testField: 'newValue'},
      },
      {replace: true, preventScrollReset: true}
    );

    // The local state should be still reflect the new value
    expect(result.current[0]).toBe('newValue');
  });

  it('should use the decoder function to decode the query param value if provided', () => {
    mockedUseLocation.mockReturnValue(
      LocationFixture({query: {testField: 'initial state'}})
    );

    const testDeserializer = (value: string) => `${value.toUpperCase()} - decoded`;

    const {result} = renderHook(
      () => useQueryParamState({fieldName: 'testField', deserializer: testDeserializer}),
      {
        wrapper: UrlParamBatchProvider,
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

    const mockedNavigate = jest.fn();
    mockedUseNavigate.mockReturnValue(mockedNavigate);

    const testSerializer = (value: TestType) =>
      `${value.value} - ${value.count} - ${value.isActive}`;

    const {result} = renderHook(
      () => useQueryParamState({fieldName: 'testField', serializer: testSerializer}),
      {
        wrapper: UrlParamBatchProvider,
      }
    );

    act(() => {
      result.current[1]({value: 'newValue', count: 2, isActive: true});
    });

    expect(mockedNavigate).toHaveBeenCalledWith(
      {
        pathname: '/',
        query: {testField: 'newValue - 2 - true'},
      },
      {replace: true, preventScrollReset: true}
    );
  });

  it('can decode and update sorts', () => {
    mockedUseLocation.mockReturnValue(LocationFixture({query: {sort: '-testField'}}));

    const mockedNavigate = jest.fn();
    mockedUseNavigate.mockReturnValue(mockedNavigate);

    const {result} = renderHook(
      () =>
        useQueryParamState<Sort[]>({
          fieldName: 'sort',
          decoder: decodeSorts,
          serializer: value => value.map(formatSort),
        }),
      {
        wrapper: UrlParamBatchProvider,
      }
    );

    expect(result.current[0]).toEqual([{field: 'testField', kind: 'desc'}]);

    act(() => {
      result.current[1]([{field: 'testField', kind: 'asc'}]);
    });

    expect(mockedNavigate).toHaveBeenCalledWith(
      {
        pathname: '/',
        query: {sort: ['testField']},
      },
      {replace: true, preventScrollReset: true}
    );
  });

  it('should not sync local state when URL changes if syncStateWithUrl is false', () => {
    mockedUseLocation.mockReturnValue(
      LocationFixture({query: {testField: 'initial state'}})
    );

    const {result, rerender} = renderHook(
      () => useQueryParamState({fieldName: 'testField', syncStateWithUrl: false}),
      {
        wrapper: UrlParamBatchProvider,
      }
    );

    expect(result.current[0]).toBe('initial state');

    // Simulate URL change (e.g., browser back/forward navigation)
    mockedUseLocation.mockReturnValue(
      LocationFixture({query: {testField: 'changed via URL'}})
    );

    rerender();

    // Local state should NOT be updated because syncStateWithUrl is false
    expect(result.current[0]).toBe('initial state');
  });

  it('should sync local state when URL changes if syncStateWithUrl is true', () => {
    mockedUseLocation.mockReturnValue(
      LocationFixture({query: {testField: 'initial state'}})
    );

    const {result, rerender} = renderHook(
      () => useQueryParamState({fieldName: 'testField', syncStateWithUrl: true}),
      {
        wrapper: UrlParamBatchProvider,
      }
    );

    expect(result.current[0]).toBe('initial state');

    // Simulate URL change (e.g., browser back/forward navigation)
    mockedUseLocation.mockReturnValue(
      LocationFixture({query: {testField: 'changed via URL'}})
    );

    rerender();

    // Local state should be updated because syncStateWithUrl is true
    expect(result.current[0]).toBe('changed via URL');
  });
});
