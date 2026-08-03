import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useLogsPinning} from 'sentry/views/explore/logs/pinning/useLogsPinning';

describe('useLogsPinning', () => {
  it('starts with an empty pinnedRows when the location has no logsPinned query', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning());

    expect(result.current?.getPinnedRowIds()).toEqual([]);
  });

  it('starts with a single id in pinnedRows when the location has a single logsPinned value', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    expect(result.current?.getPinnedRowIds()).toEqual(['log-1']);
  });

  it('starts with multiple ids in pinnedRows when the location has multiple logsPinned values', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1,log-2'}},
      },
    });

    expect(result.current?.getPinnedRowIds()).toEqual(['log-1', 'log-2']);
  });

  it('filters out empty values from the logsPinned query when initializing pinnedRows', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: ['log-1', '']}},
      },
    });

    expect(result.current?.getPinnedRowIds()).toEqual(['log-1']);
  });

  it('adds the id to pinnedRows when togglePinnedRow is called for an unpinned id', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning());

    act(() => {
      result.current?.togglePinnedRow('log-1');
    });

    expect(result.current?.getPinnedRowIds()).toEqual(['log-1']);
  });

  it('removes the id from pinnedRows when togglePinnedRow is called for a pinned id', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    act(() => {
      result.current?.togglePinnedRow('log-1');
    });

    expect(result.current?.getPinnedRowIds()).toEqual([]);
  });

  it('empties pinnedRows when clearPinnedRows is called', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1,log-2'}},
      },
    });

    act(() => {
      result.current?.clearPinnedRows();
    });

    expect(result.current?.getPinnedRowIds()).toEqual([]);
  });

  it('removes the id from pinnedRows when removePinnedRows is called for a pinned id', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning(), {
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    act(() => {
      result.current?.removePinnedRows(['log-1']);
    });

    expect(result.current?.getPinnedRowIds()).toEqual([]);
  });

  it('removes all targeted ids when removePinnedRows is called with multiple ids', () => {
    const {result} = renderHookWithProviders(() => useLogsPinning());

    act(() => result.current?.togglePinnedRow('log-1'));
    act(() => result.current?.togglePinnedRow('log-2'));
    act(() => result.current?.togglePinnedRow('log-3'));

    act(() => {
      result.current?.removePinnedRows(['log-1', 'log-2']);
    });

    expect(result.current?.getPinnedRowIds()).toEqual(['log-3']);
  });
});
