import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';

describe('getRouteStringFromRoutes', () => {
  const routes = [
    {path: '/'},
    {path: '/:orgId/'},
    {name: 'this should be skipped'},
    {path: '/organizations/:orgId/'},
    {name: 'also skipped'},
    {path: 'api-keys/', name: 'API Key'},
  ];

  it('can get a route string from routes array and skips routes that do not have a path', () => {
    expect(getRouteStringFromRoutes(routes)).toBe('/organizations/:orgId/api-keys/');
  });
});
