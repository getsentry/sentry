import findFirstRouteWithoutRouteParam from 'sentry/views/settings/components/settingsBreadcrumb/findFirstRouteWithoutRouteParam';

import {RouteWithName} from './types';

describe('findFirstRouteWithoutRouteParam', function () {
  const routes: RouteWithName[] = [
    {path: '/'},
    {},
    {path: '/foo/'},
    {},
    {path: ':bar'},
    {path: '/settings/', name: 'Settings'},
    {name: 'Organizations', path: ':orgId/'},
    {},
    {path: 'api-keys/', name: 'API Key'},
    {path: ':apiKey/', name: 'API Key Details'},
  ];

  it('finds the first route', function () {
    expect(findFirstRouteWithoutRouteParam(routes)?.path).toBe('/');
  });

  it('finds the first route after the given route', function () {
    expect(findFirstRouteWithoutRouteParam(routes, routes[2])?.path).toBe('/foo/');
    expect(findFirstRouteWithoutRouteParam(routes, routes[6])?.path).toBe('api-keys/');
    expect(findFirstRouteWithoutRouteParam(routes, routes[8])?.path).toBe('api-keys/');
  });

  it('does not include routes that have any url parameters', function () {
    const r = [
      {path: '/settings/', name: 'Settings'},
      {name: 'Organizations', path: ':orgId/'},
      {path: 'api-keys/:apiKey/', name: 'API Key Details'},
    ];

    expect(findFirstRouteWithoutRouteParam(r, r[1])?.path).toBe(':orgId/');
  });
});
