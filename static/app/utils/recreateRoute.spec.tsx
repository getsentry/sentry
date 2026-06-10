import type {UIMatch} from 'react-router-dom';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {recreateRoute} from 'sentry/utils/recreateRoute';

jest.unmock('sentry/utils/recreateRoute');

const routes = [
  {path: '/', childRoutes: []},
  {childRoutes: []},
  {path: '/settings/', name: 'Settings'},
  {path: ':orgId/', name: 'Organizations', childRoutes: []},
  {childRoutes: []},
  {path: 'api-keys/', name: 'API Key'},
];

const projectRoutes = [
  {path: '/', childRoutes: []},
  {childRoutes: []},
  {path: '/settings/', name: 'Settings', indexRoute: {}, childRoutes: []},
  {path: ':orgId/', name: 'Organizations', childRoutes: []},
  {path: ':projectId', name: 'Projects', childRoutes: []},
  {path: 'alerts/', name: 'Alerts'},
];

const params = {
  orgId: 'org-slug',
  projectId: 'project-slug',
};

const location = {
  ...LocationFixture(),
  search: '',
};

describe('recreateRoute', () => {
  it('returns correct path to a route object', () => {
    expect(recreateRoute(routes[0]!, {routes, params})).toBe('/');
    expect(recreateRoute(routes[1]!, {routes, params})).toBe('/');
    expect(recreateRoute(routes[2]!, {routes, params})).toBe('/settings/');
    expect(recreateRoute(routes[3]!, {routes, params})).toBe('/settings/org-slug/');
    expect(recreateRoute(routes[4]!, {routes, params})).toBe('/settings/org-slug/');
    expect(recreateRoute(routes[5]!, {routes, params})).toBe(
      '/settings/org-slug/api-keys/'
    );

    expect(
      recreateRoute(projectRoutes[5]!, {routes: projectRoutes, location, params})
    ).toBe('/settings/org-slug/project-slug/alerts/');
  });

  it('has correct path with route object with many roots (starts with "/")', () => {
    const multiRootRoutes = [
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

    expect(recreateRoute(multiRootRoutes[4]!, {routes: multiRootRoutes, params})).toBe(
      '/foo/bar/'
    );
  });

  it('returns correct path to a string (at the end of the routes)', () => {
    expect(recreateRoute('test/', {routes, location, params})).toBe(
      '/settings/org-slug/api-keys/test/'
    );
  });

  it('returns correct path to a string after the 2nd to last route', () => {
    expect(recreateRoute('test/', {routes, location, params, stepBack: -2})).toBe(
      '/settings/org-slug/test/'
    );
  });

  it('switches to new org but keeps current route', () => {
    expect(
      recreateRoute(routes[5]!, {routes, location, params: {orgId: 'new-org'}})
    ).toBe('/settings/new-org/api-keys/');
  });

  it('maintains the query string', () => {
    const withSearch = {
      ...LocationFixture(),
      search: '?key1=foo&key2=bar',
    };

    expect(recreateRoute(routes[5]!, {routes, params, location: withSearch})).toBe(
      '/settings/org-slug/api-keys/?key1=foo&key2=bar'
    );
  });
});

function makeMatch(
  id: string,
  pathname: string,
  matchParams: Record<string, string>,
  handle: Record<string, string> | undefined
): UIMatch {
  return {id, pathname, params: matchParams, data: undefined, handle: handle ?? {}};
}

const orgMatchParams = {orgId: 'org-slug'};

const matches: UIMatch[] = [
  makeMatch('0', '/', orgMatchParams, {path: '/'}),
  makeMatch('0-0', '/', orgMatchParams, undefined),
  makeMatch('0-0-0', '/settings', orgMatchParams, {
    path: '/settings/',
    name: 'Settings',
  }),
  makeMatch('0-0-0-0', '/settings/org-slug', orgMatchParams, {
    path: ':orgId/',
    name: 'Organizations',
  }),
  makeMatch('0-0-0-0-0', '/settings/org-slug', orgMatchParams, undefined),
  makeMatch('0-0-0-0-0-0', '/settings/org-slug/api-keys', orgMatchParams, {
    path: 'api-keys/',
    name: 'API Key',
  }),
];

const projectMatchParams = {orgId: 'org-slug', projectId: 'project-slug'};

const projectMatches: UIMatch[] = [
  makeMatch('0', '/', projectMatchParams, {path: '/'}),
  makeMatch('0-0', '/', projectMatchParams, undefined),
  makeMatch('0-0-0', '/settings', projectMatchParams, {
    path: '/settings/',
    name: 'Settings',
  }),
  makeMatch('0-0-0-0', '/settings/org-slug', projectMatchParams, {
    path: ':orgId/',
    name: 'Organizations',
  }),
  makeMatch('0-0-0-0-0', '/settings/org-slug/project-slug', projectMatchParams, {
    path: ':projectId',
    name: 'Projects',
  }),
  makeMatch('0-0-0-0-0-0', '/settings/org-slug/project-slug/alerts', projectMatchParams, {
    path: 'alerts/',
    name: 'Alerts',
  }),
];

describe('recreateRoute with matches', () => {
  it('returns correct path to a match object', () => {
    expect(recreateRoute(matches[0]!, {matches, params})).toBe('/');
    expect(recreateRoute(matches[1]!, {matches, params})).toBe('/');
    expect(recreateRoute(matches[2]!, {matches, params})).toBe('/settings/');
    expect(recreateRoute(matches[3]!, {matches, params})).toBe('/settings/org-slug/');
    expect(recreateRoute(matches[4]!, {matches, params})).toBe('/settings/org-slug/');
    expect(recreateRoute(matches[5]!, {matches, params})).toBe(
      '/settings/org-slug/api-keys/'
    );

    expect(
      recreateRoute(projectMatches[5]!, {matches: projectMatches, location, params})
    ).toBe('/settings/org-slug/project-slug/alerts/');
  });

  it('has correct path with match object with many roots (starts with "/")', () => {
    const m: UIMatch[] = [
      makeMatch('0', '/', {}, {path: '/'}),
      makeMatch('0-0', '/', {}, undefined),
      makeMatch('0-0-0', '/foo', {}, {path: '/foo/'}),
      makeMatch('0-0-0-0', '/foo', {}, undefined),
      makeMatch('0-0-0-0-0', '/foo/bar', {}, {path: 'bar'}),
      makeMatch('0-0-0-0-0-0', '/settings', {}, {path: '/settings/', name: 'Settings'}),
      makeMatch(
        '0-0-0-0-0-0-0',
        '/settings/org-slug',
        {},
        {
          path: ':orgId/',
          name: 'Organizations',
        }
      ),
      makeMatch('0-0-0-0-0-0-0-0', '/settings/org-slug', {}, undefined),
      makeMatch(
        '0-0-0-0-0-0-0-0-0',
        '/settings/org-slug/api-keys',
        {},
        {
          path: 'api-keys/',
          name: 'API Key',
        }
      ),
    ];

    expect(recreateRoute(m[4]!, {matches: m, params})).toBe('/foo/bar/');
  });

  it('returns correct path to a string (at the end of the matches)', () => {
    expect(recreateRoute('test/', {matches, location, params})).toBe(
      '/settings/org-slug/api-keys/test/'
    );
  });

  it('returns correct path to a string after the 2nd to last match', () => {
    expect(recreateRoute('test/', {matches, location, params, stepBack: -2})).toBe(
      '/settings/org-slug/test/'
    );
  });

  it('switches to new org but keeps current route', () => {
    expect(
      recreateRoute(matches[5]!, {matches, location, params: {orgId: 'new-org'}})
    ).toBe('/settings/new-org/api-keys/');
  });

  it('maintains the query string', () => {
    const withSearch = {
      ...LocationFixture(),
      search: '?key1=foo&key2=bar',
    };

    expect(recreateRoute(matches[5]!, {matches, params, location: withSearch})).toBe(
      '/settings/org-slug/api-keys/?key1=foo&key2=bar'
    );
  });

  it('handles matches with undefined handle gracefully', () => {
    const m: UIMatch[] = [
      makeMatch('0', '/', {}, {path: '/settings/'}),
      {id: '1', pathname: '/settings', params: {}, data: undefined, handle: undefined},
      makeMatch('2', '/settings/foo', {}, {path: 'foo/'}),
    ];

    expect(recreateRoute(m[2]!, {matches: m, params: {}})).toBe('/settings/foo/');
  });

  it('maintains the hash', () => {
    const withHash = {
      ...LocationFixture(),
      search: '',
      hash: '#section-1',
    };

    expect(recreateRoute(matches[5]!, {matches, params, location: withHash})).toBe(
      '/settings/org-slug/api-keys/#section-1'
    );
  });

  it('resolves a PlainRoute to against a matches array', () => {
    const plainRoutes = [
      {path: '/'},
      {},
      {path: '/settings/', name: 'Settings'},
      {path: ':orgId/', name: 'Organizations'},
      {},
      {path: 'api-keys/', name: 'API Key'},
    ];

    expect(recreateRoute(plainRoutes[2]!, {matches, params})).toBe('/settings/');
    expect(recreateRoute(plainRoutes[3]!, {matches, params})).toBe('/settings/org-slug/');
    expect(recreateRoute(plainRoutes[5]!, {matches, params})).toBe(
      '/settings/org-slug/api-keys/'
    );
  });

  it('resolves a UIMatch to against a routes array', () => {
    expect(recreateRoute(matches[2]!, {routes, params})).toBe('/settings/');
    expect(recreateRoute(matches[3]!, {routes, params})).toBe('/settings/org-slug/');
    expect(recreateRoute(matches[5]!, {routes, params})).toBe(
      '/settings/org-slug/api-keys/'
    );
  });
});
