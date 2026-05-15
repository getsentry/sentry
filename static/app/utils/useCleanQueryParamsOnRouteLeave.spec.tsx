import type {Location} from 'history';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  getCleanLocationIfNeeded,
  useCleanQueryParamsOnRouteLeave,
} from './useCleanQueryParamsOnRouteLeave';

type QueryParams = {cursor: string; limit: number; project: string};

describe('getCleanLocationIfNeeded', () => {
  it('should return null if the pathname is unchanged', () => {
    const result = getCleanLocationIfNeeded({
      fieldsToClean: ['cursor'],
      newLocation: {
        pathname: '/home',
        query: {},
      } as Location,
      oldPathname: '/home',
    });

    expect(result).toBeNull();
  });

  it('should return null if the pathname is changing, but fieldsToClean are undefined', () => {
    const result = getCleanLocationIfNeeded({
      fieldsToClean: ['cursor'],
      newLocation: {
        pathname: '/next',
        query: {},
      } as Location,
      oldPathname: '/home',
    });

    expect(result).toBeNull();
  });

  it('should return cleaned location when the path is changing and some fieldsToClean are set', () => {
    const result = getCleanLocationIfNeeded({
      fieldsToClean: ['cursor', 'limit'],
      newLocation: {
        pathname: '/next',
        query: {
          cursor: '0:1:0',
          limit: 5,
        },
      } as Location<QueryParams>,
      oldPathname: '/home',
    });

    expect(result).toEqual({
      pathname: '/next',
      query: {},
    });
  });

  it('should leave other query params alone when the path is changing and something is filtered out', () => {
    const result = getCleanLocationIfNeeded({
      fieldsToClean: ['cursor', 'limit'],
      newLocation: {
        pathname: '/next',
        query: {
          cursor: '0:1:0',
          limit: 5,
          project: '123',
        },
      } as Location<QueryParams>,
      oldPathname: '/home',
    });

    expect(result).toEqual({
      pathname: '/next',
      query: {
        project: '123',
      },
    });
  });
});

describe('useCleanQueryParamsOnRouteLeave', () => {
  it('should not navigate when shouldClean returns false', () => {
    const {router} = renderHookWithProviders(useCleanQueryParamsOnRouteLeave, {
      initialProps: {
        fieldsToClean: ['cursor'],
        shouldClean: () => false,
      },
      initialRouterConfig: {
        location: {
          pathname: '/home/',
          query: {cursor: '0:1:0'},
        },
      },
    });

    router.navigate('/next/?cursor=0:1:0');

    expect(router.location.query.cursor).toBe('0:1:0');
  });

  it('should clean query params when navigating to a new path', async () => {
    const {router, rerender} = renderHookWithProviders(useCleanQueryParamsOnRouteLeave, {
      initialProps: {
        fieldsToClean: ['cursor'],
      },
      initialRouterConfig: {
        location: {
          pathname: '/home/',
        },
      },
    });

    router.navigate('/next/?cursor=0:1:0');

    rerender({fieldsToClean: ['cursor']});

    expect(router.location.query.cursor).toBeUndefined();
  });
});
