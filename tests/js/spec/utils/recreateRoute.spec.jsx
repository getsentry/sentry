import recreateRoute from 'app/utils/recreateRoute';

jest.unmock('app/utils/recreateRoute');

const routes = [
  {path: '/', childRoutes: []},
  {childRoutes: []},
  {path: '/settings/', name: 'Settings'},
  {name: 'Organizations', path: ':orgId/', childRoutes: []},
  {childRoutes: []},
  {path: 'api-keys/', name: 'API Key'},
];

const projectRoutes = [
  {path: '/', childRoutes: []},
  {childRoutes: []},
  {path: '/settings/', name: 'Settings', indexRoute: {}, childRoutes: []},
  {name: 'Organizations', path: ':orgId/', childRoutes: []},
  {name: 'Projects', path: ':projectId/', childRoutes: []},
  {name: 'Alerts', path: 'alerts/'},
];

const params = {
  orgId: 'org-slug',
  projectId: 'project-slug',
};

const location = {
  search: '',
};

describe('recreateRoute', function () {
  it('returns correct path to a route object', function () {
    expect(recreateRoute(routes[0], {routes, params})).toBe('/');
    expect(recreateRoute(routes[1], {routes, params})).toBe('/');
    expect(recreateRoute(routes[2], {routes, params})).toBe('/settings/');
    expect(recreateRoute(routes[3], {routes, params})).toBe('/settings/org-slug/');
    expect(recreateRoute(routes[4], {routes, params})).toBe('/settings/org-slug/');
    expect(recreateRoute(routes[5], {routes, params})).toBe(
      '/settings/org-slug/api-keys/'
    );

    expect(
      recreateRoute(projectRoutes[5], {routes: projectRoutes, location, params})
    ).toBe('/settings/org-slug/project-slug/alerts/');
  });

  it('has correct path with route object with many roots (starts with "/")', function () {
    const r = [
      {path: '/', childRoutes: []},
      {childRoutes: []},
      {path: '/foo/', childRoutes: []},
      {childRoutes: []},
      {path: 'bar', childRoutes: []},
      {path: '/settings/', name: 'Settings'},
      {name: 'Organizations', path: ':orgId/', childRoutes: []},
      {childRoutes: []},
      {path: 'api-keys/', name: 'API Key'},
    ];

    expect(recreateRoute(r[4], {routes: r, params})).toBe('/foo/bar');
  });

  it('returns correct path to a string (at the end of the routes)', function () {
    expect(recreateRoute('test/', {routes, location, params})).toBe(
      '/settings/org-slug/api-keys/test/'
    );
  });

  it('returns correct path to a string after the 2nd to last route', function () {
    expect(recreateRoute('test/', {routes, location, params, stepBack: -2})).toBe(
      '/settings/org-slug/test/'
    );
  });

  it('switches to new org but keeps current route', function () {
    expect(recreateRoute(routes[5], {routes, location, params: {orgId: 'new-org'}})).toBe(
      '/settings/new-org/api-keys/'
    );
  });

  it('maintains the query strting', function () {
    const withSearch = {
      search: '?key1=foo&key2=bar',
    };

    expect(recreateRoute(routes[5], {routes, params, location: withSearch})).toBe(
      '/settings/org-slug/api-keys/?key1=foo&key2=bar'
    );
  });
});
