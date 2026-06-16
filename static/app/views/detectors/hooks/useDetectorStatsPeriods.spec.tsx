import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useDetectorStatsPeriods} from 'sentry/views/detectors/hooks/useDetectorStatsPeriods';

describe('useDetectorStatsPeriods', () => {
  it('does nothing when there is no statsPeriod in the URL', () => {
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(3600), {
      initialRouterConfig: {
        location: {pathname: '/detectors/1/', query: {}},
      },
    });

    expect(router.location.query).toEqual({});
  });

  it('does nothing when intervalSeconds is 0', () => {
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(0), {
      initialRouterConfig: {
        location: {pathname: '/detectors/1/', query: {statsPeriod: '1h'}},
      },
    });

    expect(router.location.query.statsPeriod).toBe('1h');
  });

  it('does nothing when statsPeriod is greater than the interval', () => {
    // statsPeriod=1d (86400s), interval=3600s (1h)
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(3600), {
      initialRouterConfig: {
        location: {pathname: '/detectors/1/', query: {statsPeriod: '1d'}},
      },
    });

    expect(router.location.query.statsPeriod).toBe('1d');
  });

  it('does nothing when statsPeriod equals the interval', () => {
    // statsPeriod=1h (3600s), interval=3600s
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(3600), {
      initialRouterConfig: {
        location: {pathname: '/detectors/1/', query: {statsPeriod: '1h'}},
      },
    });

    expect(router.location.query.statsPeriod).toBe('1h');
  });

  it('replaces statsPeriod when it is smaller than the interval', () => {
    // statsPeriod=1h (3600s), interval=86400s (1d)
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(86400), {
      initialRouterConfig: {
        location: {pathname: '/detectors/1/', query: {statsPeriod: '1h'}},
      },
    });

    expect(router.location.query.statsPeriod).toBe('1d');
  });

  it('preserves other query params when replacing statsPeriod', () => {
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(86400), {
      initialRouterConfig: {
        location: {
          pathname: '/detectors/1/',
          query: {statsPeriod: '1h', cursor: 'abc123'},
        },
      },
    });

    expect(router.location.query.statsPeriod).toBe('1d');
    expect(router.location.query.cursor).toBe('abc123');
  });

  it('does nothing when start/end range is greater than the interval', () => {
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(3600), {
      initialRouterConfig: {
        location: {
          pathname: '/detectors/1/',
          query: {start: '2026-01-01T00:00:00', end: '2026-01-02T00:00:00'},
        },
      },
    });

    expect(router.location.query.start).toBe('2026-01-01T00:00:00');
    expect(router.location.query.end).toBe('2026-01-02T00:00:00');
    expect(router.location.query.statsPeriod).toBeUndefined();
  });

  it('replaces start/end with statsPeriod when range is smaller than the interval', () => {
    const {router} = renderHookWithProviders(() => useDetectorStatsPeriods(86400), {
      initialRouterConfig: {
        location: {
          pathname: '/detectors/1/',
          query: {start: '2026-01-01T00:00:00', end: '2026-01-01T01:00:00'},
        },
      },
    });

    expect(router.location.query.statsPeriod).toBe('1d');
    expect(router.location.query.start).toBeUndefined();
    expect(router.location.query.end).toBeUndefined();
  });
});
