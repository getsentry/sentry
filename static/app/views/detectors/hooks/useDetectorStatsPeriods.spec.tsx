import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useDetectorStatsPeriods} from './useDetectorStatsPeriods';

describe('useDetectorStatsPeriods', () => {
  it('does nothing when there is no statsPeriod in the URL', async () => {
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(3600), {
      initialRouterConfig: {
        location: {pathname: '/detectors/1/', query: {}},
      },
    });

    await act(() => new Promise(resolve => setTimeout(resolve, 100)));

    expect(router.historyAction).toBe('POP');
    expect(router.location.query).toEqual({});
  });

  it('does nothing when intervalSeconds is 0', async () => {
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(0), {
      initialRouterConfig: {
        location: {pathname: '/detectors/1/', query: {statsPeriod: '1h'}},
      },
    });

    await act(() => new Promise(resolve => setTimeout(resolve, 100)));

    expect(router.historyAction).toBe('POP');
    expect(router.location.query.statsPeriod).toBe('1h');
  });

  it('does nothing when statsPeriod is greater than the interval', async () => {
    // statsPeriod=1d (86400s), interval=3600s (1h)
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(3600), {
      initialRouterConfig: {
        location: {pathname: '/detectors/1/', query: {statsPeriod: '1d'}},
      },
    });

    await act(() => new Promise(resolve => setTimeout(resolve, 100)));

    expect(router.historyAction).toBe('POP');
    expect(router.location.query.statsPeriod).toBe('1d');
  });

  it('does nothing when statsPeriod equals the interval', async () => {
    // statsPeriod=1h (3600s), interval=3600s
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(3600), {
      initialRouterConfig: {
        location: {pathname: '/detectors/1/', query: {statsPeriod: '1h'}},
      },
    });

    await act(() => new Promise(resolve => setTimeout(resolve, 100)));

    expect(router.historyAction).toBe('POP');
    expect(router.location.query.statsPeriod).toBe('1h');
  });

  it('replaces statsPeriod when it is smaller than the interval', async () => {
    // statsPeriod=1h (3600s), interval=86400s (1d)
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(86400), {
      initialRouterConfig: {
        location: {pathname: '/detectors/1/', query: {statsPeriod: '1h'}},
      },
    });

    await waitFor(() => expect(router.location.query.statsPeriod).toBe('1d'));
  });

  it('preserves other query params when replacing statsPeriod', async () => {
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(86400), {
      initialRouterConfig: {
        location: {
          pathname: '/detectors/1/',
          query: {statsPeriod: '1h', cursor: 'abc123'},
        },
      },
    });

    await waitFor(() => expect(router.location.query.statsPeriod).toBe('1d'));
    expect(router.location.query.cursor).toBe('abc123');
  });

  it('drops start and end when replacing a too-short statsPeriod', async () => {
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(86400), {
      initialRouterConfig: {
        location: {
          pathname: '/detectors/1/',
          query: {
            statsPeriod: '1h',
            start: '2017-10-01T00:00:00',
            end: '2017-10-01T01:00:00',
          },
        },
      },
    });

    await waitFor(() => expect(router.location.query.statsPeriod).toBe('1d'));
    expect(router.location.query.start).toBeUndefined();
    expect(router.location.query.end).toBeUndefined();
  });

  it('does nothing when start/end range is greater than the interval', async () => {
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(3600), {
      initialRouterConfig: {
        location: {
          pathname: '/detectors/1/',
          query: {start: '2026-01-01T00:00:00', end: '2026-01-02T00:00:00'},
        },
      },
    });

    await act(() => new Promise(resolve => setTimeout(resolve, 100)));

    expect(router.historyAction).toBe('POP');
    expect(router.location.query.start).toBe('2026-01-01T00:00:00');
    expect(router.location.query.end).toBe('2026-01-02T00:00:00');
    expect(router.location.query.statsPeriod).toBeUndefined();
  });

  it('widens a start/end range shorter than three intervals around its center', async () => {
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(3600), {
      initialRouterConfig: {
        location: {
          pathname: '/detectors/1/',
          query: {start: '2017-10-01T00:00:00', end: '2017-10-01T01:00:00'},
        },
      },
    });

    await waitFor(() => expect(router.location.query.start).toBe('2017-09-30T23:00:00'));

    expect(router.location.query.end).toBe('2017-10-01T02:00:00');

    expect(router.location.query.statsPeriod).toBeUndefined();
  });

  it('replaces the history entry when widening the range', async () => {
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(3600), {
      initialRouterConfig: {
        location: {
          pathname: '/detectors/1/',
          query: {start: '2017-10-01T00:00:00', end: '2017-10-01T01:00:00'},
        },
      },
    });

    await waitFor(() => expect(router.historyAction).toBe('REPLACE'));
  });
});
