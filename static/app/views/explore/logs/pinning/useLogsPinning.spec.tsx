import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  LogsPinningProvider,
  useLogsPinning,
} from 'sentry/views/explore/logs/pinning/useLogsPinning';

let replaceStateSpy: jest.SpyInstance;

beforeEach(() => {
  replaceStateSpy = jest.spyOn(window.history, 'replaceState');
});

afterEach(() => {
  replaceStateSpy.mockRestore();
});

jest.mock('sentry/views/explore/logs/pinning/useOurLogsPinning', () => ({
  useOurLogsPinningEnabled: () => true,
}));

describe('useLogsPinning', () => {
  it('returns undefined when no LogsPinningProvider wraps the consumer', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning());

    expect(result.current).toBeUndefined();
  });

  it('starts with an empty pinnedRows when the location has no logsPinned query', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      additionalWrapper: LogsPinningProvider,
    });

    expect(result.current?.pinnedRows).toEqual(new Set());
  });

  it('starts with a single id in pinnedRows when the location has a single logsPinned value', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      additionalWrapper: LogsPinningProvider,
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    expect(result.current?.pinnedRows).toEqual(new Set(['log-1']));
  });

  it('starts with multiple ids in pinnedRows when the location has multiple logsPinned values', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      additionalWrapper: LogsPinningProvider,
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: ['log-1', 'log-2']}},
      },
    });

    expect(result.current?.pinnedRows).toEqual(new Set(['log-1', 'log-2']));
  });

  it('filters out empty values from the logsPinned query when initializing pinnedRows', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      additionalWrapper: LogsPinningProvider,
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: ['log-1', '']}},
      },
    });

    expect(result.current?.pinnedRows).toEqual(new Set(['log-1']));
  });

  it('adds the id to pinnedRows when togglePinnedRow is called for an unpinned id', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      additionalWrapper: LogsPinningProvider,
    });

    act(() => {
      result.current?.togglePinnedRow('log-1');
    });

    expect(result.current?.pinnedRows).toEqual(new Set(['log-1']));
  });

  it('removes the id from pinnedRows when togglePinnedRow is called for a pinned id', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      additionalWrapper: LogsPinningProvider,
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    act(() => {
      result.current?.togglePinnedRow('log-1');
    });

    expect(result.current?.pinnedRows).toEqual(new Set());
  });

  it('empties pinnedRows when clearPinnedRows is called', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      additionalWrapper: LogsPinningProvider,
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: ['log-1', 'log-2']}},
      },
    });

    act(() => {
      result.current?.clearPinnedRows();
    });

    expect(result.current?.pinnedRows).toEqual(new Set());
  });

  it('writes the pinned id to the URL query string when togglePinnedRow is called', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      additionalWrapper: LogsPinningProvider,
    });

    replaceStateSpy.mockClear();

    act(() => {
      result.current?.togglePinnedRow('log-1');
    });

    const lastCall = replaceStateSpy.mock.calls.at(-1);
    expect(lastCall?.[2]).toContain('logsPinned=log-1');
  });

  it('removes the logsPinned key from the URL when clearPinnedRows is called', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      additionalWrapper: LogsPinningProvider,
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    replaceStateSpy.mockClear();

    act(() => {
      result.current?.clearPinnedRows();
    });

    const lastCall = replaceStateSpy.mock.calls.at(-1);
    expect(lastCall?.[2]).not.toContain('logsPinned');
  });
});
