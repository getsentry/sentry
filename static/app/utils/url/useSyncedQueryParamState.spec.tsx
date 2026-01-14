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
      useSyncedQueryParamState('testParam', 'testKey', 'default')
    );

    expect(result.current[0]).toBe('default');
  });

  it('returns localStorage value when URL is empty', () => {
    localStorageWrapper.setItem('testKey', JSON.stringify('fromStorage'));

    const {result} = renderHook(() =>
      useSyncedQueryParamState('testParam', 'testKey', 'default')
    );

    expect(result.current[0]).toBe('fromStorage');
  });

  it('returns URL value when URL has value (URL takes precedence)', () => {
    localStorageWrapper.setItem('testKey', JSON.stringify('fromStorage'));
    __setMockQueryState('testParam', 'fromURL');

    const {result} = renderHook(() =>
      useSyncedQueryParamState('testParam', 'testKey', 'default')
    );

    expect(result.current[0]).toBe('fromURL');
  });

  it('syncs localStorage when URL changes', async () => {
    __setMockQueryState('testParam', 'newURLValue');

    renderHook(() => useSyncedQueryParamState('testParam', 'testKey', 'default'));

    // localStorage should be updated
    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('testKey');
      expect(storedValue).toBe(JSON.stringify('newURLValue'));
    });
  });

  it('setValue updates both URL and localStorage', async () => {
    const {result} = renderHook(() =>
      useSyncedQueryParamState('testParam', 'testKey', 'default')
    );

    const mockSetUrlValue = useQueryState.mock.results[0].value[1];

    act(() => {
      result.current[1]('newValue');
    });

    // Check that setUrlValue was called
    expect(mockSetUrlValue).toHaveBeenCalledWith('newValue');

    // Check that localStorage was updated (may be async)
    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('testKey');
      expect(storedValue).toBe(JSON.stringify('newValue'));
    });
  });

  it('works with enum-like string types', async () => {
    type SortOption = 'date' | 'name' | 'size';

    localStorageWrapper.setItem('sortKey', JSON.stringify('name'));

    const {result} = renderHook(() =>
      useSyncedQueryParamState<SortOption>('sort', 'sortKey', 'date')
    );

    expect(result.current[0]).toBe('name');

    const mockSetUrlValue = useQueryState.mock.results[0].value[1];

    act(() => {
      result.current[1]('size');
    });

    expect(mockSetUrlValue).toHaveBeenCalledWith('size');

    // Check that localStorage was updated (may be async)
    await waitFor(() => {
      const storedValue = localStorageWrapper.getItem('sortKey');
      expect(storedValue).toBe(JSON.stringify('size'));
    });
  });

  it('does not sync localStorage if URL value matches localStorage', () => {
    localStorageWrapper.setItem('testKey', JSON.stringify('sameValue'));
    __setMockQueryState('testParam', 'sameValue');

    const {result} = renderHook(() =>
      useSyncedQueryParamState('testParam', 'testKey', 'default')
    );

    // Should return the matching value without triggering sync
    expect(result.current[0]).toBe('sameValue');

    // Value in localStorage should remain unchanged
    const storedValue = localStorageWrapper.getItem('testKey');
    expect(storedValue).toBe(JSON.stringify('sameValue'));
  });
});
