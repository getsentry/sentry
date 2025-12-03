import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';

describe('useTableCursor', () => {
  it('should return undefined cursor when query param is not present', () => {
    const {result} = renderHookWithProviders(() => useTableCursor(), {
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {},
        },
      },
    });

    expect(result.current.cursor).toBeUndefined();
  });

  it('should return cursor value from query params', () => {
    const {result} = renderHookWithProviders(() => useTableCursor(), {
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {tableCursor: 'abc123'},
        },
      },
    });

    expect(result.current.cursor).toBe('abc123');
  });

  it('should update cursor value when setCursor is called', async () => {
    const {result, router} = renderHookWithProviders(() => useTableCursor(), {
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {},
        },
      },
    });

    expect(result.current.cursor).toBeUndefined();

    act(() => {
      result.current.setCursor('newCursor', '/', {}, -1);
    });

    await waitFor(() => {
      expect(result.current.cursor).toBe('newCursor');
    });

    expect(router.location.query.tableCursor).toBe('newCursor');
  });

  it('should replace old cursor with new cursor value', async () => {
    const {result, router} = renderHookWithProviders(() => useTableCursor(), {
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {tableCursor: 'oldCursor'},
        },
      },
    });

    expect(result.current.cursor).toBe('oldCursor');

    act(() => {
      result.current.setCursor('newCursor', '/', {}, -1);
    });

    await waitFor(() => {
      expect(result.current.cursor).toBe('newCursor');
    });

    expect(router.location.query.tableCursor).toBe('newCursor');
  });

  it('should clear cursor when unsetCursor is called', async () => {
    const {result, router} = renderHookWithProviders(() => useTableCursor(), {
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {tableCursor: 'someCursor'},
        },
      },
    });

    expect(result.current.cursor).toBe('someCursor');

    act(() => {
      result.current.unsetCursor();
    });

    await waitFor(() => {
      expect(result.current.cursor).toBeUndefined();
    });

    expect(router.location.query.tableCursor).toBeUndefined();
  });

  it('should handle undefined cursor in setCursor (e.g., navigating to first page)', async () => {
    const {result, router} = renderHookWithProviders(() => useTableCursor(), {
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {tableCursor: 'someCursor'},
        },
      },
    });

    expect(result.current.cursor).toBe('someCursor');

    act(() => {
      result.current.setCursor(undefined, '/', {}, -1);
    });

    await waitFor(() => {
      expect(result.current.cursor).toBeUndefined();
    });

    expect(router.location.query.tableCursor).toBeUndefined();
  });
});
