import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import localStorageWrapper from 'sentry/utils/localStorage';
import {useSyncedQueryParamState} from 'sentry/utils/url/useSyncedQueryParamState';

// Mock Nuqs
jest.mock('nuqs', () => {
  const actualNuqs = jest.requireActual('nuqs');
  let mockQueryStates: Record<string, string | null> = {};

  return {
    ...actualNuqs,
    parseAsString: actualNuqs.parseAsString,
    useQueryState: jest.fn((paramName: string) => {
      const value = mockQueryStates[paramName] || null;
      const setValue = jest.fn((newValue: string) => {
        mockQueryStates[paramName] = newValue;
      });
      return [value, setValue];
    }),
    __setMockQueryState: (paramName: string, value: string | null) => {
      mockQueryStates[paramName] = value;
    },
    __clearMockQueryStates: () => {
      mockQueryStates = {};
    },
  };
});

const {useQueryState, __setMockQueryState, __clearMockQueryStates} = require('nuqs');

describe('useSyncedQueryParamState', () => {
  beforeEach(() => {
    localStorageWrapper.clear();
    __clearMockQueryStates();
    jest.clearAllMocks();
  });

  it('returns default value when neither URL nor localStorage has value', () => {
    const {result} = renderHook(() =>
      useSyncedQueryParamState('testParam', 'testNamespace', 'default')
    );

    expect(result.current[0]).toBe('default');
  });

  it('returns localStorage value when URL is empty', () => {
    localStorageWrapper.setItem('testNamespace:testParam', JSON.stringify('fromStorage'));

    const {result} = renderHook(() =>
      useSyncedQueryParamState('testParam', 'testNamespace', 'default')
    );

    expect(result.current[0]).toBe('fromStorage');
  });

  it('returns URL value when URL has value (URL takes precedence)', () => {
    localStorageWrapper.setItem('testNamespace:testParam', JSON.stringify('fromStorage'));
    __setMockQueryState('testParam', 'fromURL');

    const {result} = renderHook(() =>
      useSyncedQueryParamState('testParam', 'testNamespace', 'default')
    );

    expect(result.current[0]).toBe('fromURL');
  });

  it('syncs localStorage when URL changes', async () => {
    __setMockQueryState('testParam', 'newURLValue');

    renderHook(() => useSyncedQueryParamState('testParam', 'testNamespace', 'default'));

    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('testNamespace:testParam');
      expect(storedValue).toBe(JSON.stringify('newURLValue'));
    });
  });

  it('setValue updates both URL and localStorage', async () => {
    const {result} = renderHook(() =>
      useSyncedQueryParamState('testParam', 'testNamespace', 'default')
    );

    const mockSetUrlValue = useQueryState.mock.results[0].value[1];

    act(() => {
      result.current[1]('newValue');
    });

    expect(mockSetUrlValue).toHaveBeenCalledWith('newValue');

    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('testNamespace:testParam');
      expect(storedValue).toBe(JSON.stringify('newValue'));
    });
  });

  it('works with enum-like string types', async () => {
    type SortOption = 'date' | 'name' | 'size';

    localStorageWrapper.setItem('myNamespace:sort', JSON.stringify('name'));

    const {result} = renderHook(() =>
      useSyncedQueryParamState<SortOption>('sort', 'myNamespace', 'date')
    );

    expect(result.current[0]).toBe('name');

    const mockSetUrlValue = useQueryState.mock.results[0].value[1];

    act(() => {
      result.current[1]('size');
    });

    expect(mockSetUrlValue).toHaveBeenCalledWith('size');

    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('myNamespace:sort');
      expect(storedValue).toBe(JSON.stringify('size'));
    });
  });

  it('does not sync localStorage if URL value matches localStorage', () => {
    localStorageWrapper.setItem('testNamespace:testParam', JSON.stringify('sameValue'));
    __setMockQueryState('testParam', 'sameValue');

    const {result} = renderHook(() =>
      useSyncedQueryParamState('testParam', 'testNamespace', 'default')
    );

    expect(result.current[0]).toBe('sameValue');

    const storedValue = localStorageWrapper.getItem('testNamespace:testParam');
    expect(storedValue).toBe(JSON.stringify('sameValue'));
  });
});
