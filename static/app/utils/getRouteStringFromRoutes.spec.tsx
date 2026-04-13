import type {UIMatch} from 'react-router-dom';

import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';

describe('getRouteStringFromRoutes', () => {
  const matches: Array<UIMatch<unknown, unknown>> = [
    {
      handle: {path: '/'},
      id: '1',
      pathname: '/',
      params: {},
      data: {},
    },
    {
      handle: {path: '/:orgId/'},
      id: '2',
      pathname: '/:orgId/',
      params: {},
      data: {},
    },
    {
      handle: undefined,
      id: '3',
      pathname: 'this should be skipped',
      params: {},
      data: {},
    },
    {
      handle: {path: '/organizations/:orgId/'},
      id: '4',
      pathname: '/organizations/:orgId/',
      params: {},
      data: {},
    },
    {
      id: '6',
      handle: undefined,
      pathname: 'also skipped',
      params: {},
      data: {},
    },
    {
      handle: {path: 'api-keys/', name: 'API Key'},
      id: '5',
      pathname: 'api-keys/',
      params: {},
      data: {},
    },
  ];

  it('can get a route string from routes array and skips routes that do not have a path', () => {
    expect(getRouteStringFromRoutes({matches})).toBe('/organizations/:orgId/api-keys/');
  });
});
