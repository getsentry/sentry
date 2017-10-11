import recreateRoute from 'app/utils/recreateRoute';

const routes = [
  {path: '/', childRoutes: []},
  {newnew: true, path: '/settings/', name: 'Settings'},
  {name: 'Organizations', path: 'organization/'},
  {path: ':orgId/', childRoutes: []},
  {childRoutes: []},
  {path: 'api-keys/', name: 'API Key'},
];

const projectRoutes = [
  {path: '/', childRoutes: []},
  {newnew: true, path: '/settings/', name: 'Settings', indexRoute: {}, childRoutes: []},
  {path: 'organization/', indexRoute: {}, childRoutes: []},
  {name: 'Organization', path: ':orgId/', childRoutes: []},
  {path: 'project/', indexRoute: {}, childRoutes: []},
  {name: 'Project', path: ':projectId/', childRoutes: []},
  {name: 'Alerts', path: 'alerts/'},
];

const params = {
  orgId: 'org-slug',
  projectId: 'project-slug',
};

describe('recreateRoute', function() {
  it('returns correct path to a route object', function() {
    expect(recreateRoute(routes[5], {routes, params})).toBe(
      '/settings/organization/org-slug/api-keys/'
    );

    expect(recreateRoute(projectRoutes[6], {routes: projectRoutes, params})).toBe(
      '/settings/organization/org-slug/project/project-slug/alerts/'
    );
  });

  it('returns correct path to a string (at the end of the routes)', function() {
    expect(recreateRoute('test/', {routes, params})).toBe(
      '/settings/organization/org-slug/api-keys/test/'
    );
  });

  it('returns correct path to a string after the 2nd to last route', function() {
    expect(recreateRoute('test/', {routes, params, stepBack: -2})).toBe(
      '/settings/organization/org-slug/test/'
    );
  });
});
