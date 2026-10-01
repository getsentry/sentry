import type {UIMatch} from 'react-router';

import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';

describe('getRouteStringFromRoutes', () => {
  const matches: UIMatch[] = [
    {
      handle: {path: '/'},
      id: '1',
      pathname: '/',
      params: {},
      loaderData: {},
    },
    {
      handle: {path: '/:orgId/'},
      id: '2',
      pathname: '/:orgId/',
      params: {},
      loaderData: {},
    },
    {
      handle: undefined,
      id: '3',
      pathname: 'this should be skipped',
      params: {},
      loaderData: {},
    },
    {
      handle: {path: '/organizations/:orgId/'},
      id: '4',
      pathname: '/organizations/:orgId/',
      params: {},
      loaderData: {},
    },
    {
      id: '6',
      handle: undefined,
      pathname: 'also skipped',
      params: {},
      loaderData: {},
    },
    {
      handle: {path: 'api-keys/', name: 'API Key'},
      id: '5',
      pathname: 'api-keys/',
      params: {},
      loaderData: {},
    },
  ];

  it('can get a route string from routes array and skips routes that do not have a path', () => {
    expect(getRouteStringFromRoutes({matches})).toBe('/organizations/:orgId/api-keys/');
  });
});
