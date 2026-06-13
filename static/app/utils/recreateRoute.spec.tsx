import type {UIMatch} from 'react-router-dom';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {matchesToRoutes, recreateRoute} from 'sentry/utils/recreateRoute';

jest.unmock('sentry/utils/recreateRoute');

function makeMatch(
  pathname: string,
  matchParams: Record<string, string>,
  handle: Record<string, unknown>
): UIMatch {
  return {id: pathname, pathname, params: matchParams, data: undefined, handle};
}

const matches: UIMatch[] = [
  makeMatch('/', {}, {path: '/', childRoutes: []}),
  makeMatch('/', {}, {childRoutes: []}),
  makeMatch('/settings/', {}, {path: '/settings/', name: 'Settings'}),
  makeMatch(
    '/settings/org-slug/',
    {orgId: 'org-slug'},
    {name: 'Organizations', path: ':orgId/', childRoutes: []}
  ),
  makeMatch('/settings/org-slug/', {orgId: 'org-slug'}, {childRoutes: []}),
  makeMatch(
    '/settings/org-slug/api-keys/',
    {orgId: 'org-slug'},
    {path: 'api-keys/', name: 'API Key'}
  ),
];
const routes = matchesToRoutes(matches);

const projectMatches: UIMatch[] = [
  makeMatch('/', {}, {path: '/', childRoutes: []}),
  makeMatch('/', {}, {childRoutes: []}),
  makeMatch(
    '/settings/',
    {},
    {path: '/settings/', name: 'Settings', indexRoute: {}, childRoutes: []}
  ),
  makeMatch(
    '/settings/org-slug/',
    {orgId: 'org-slug'},
    {name: 'Organizations', path: ':orgId/', childRoutes: []}
  ),
  makeMatch(
    '/settings/org-slug/project-slug',
    {orgId: 'org-slug', projectId: 'project-slug'},
    {name: 'Projects', path: ':projectId', childRoutes: []}
  ),
  makeMatch(
    '/settings/org-slug/project-slug/alerts/',
    {orgId: 'org-slug', projectId: 'project-slug'},
    {name: 'Alerts', path: 'alerts/'}
  ),
];
const projectRoutes = matchesToRoutes(projectMatches);

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
    expect(recreateRoute(routes[0]!, {matches, params})).toBe('/');
    expect(recreateRoute(routes[1]!, {matches, params})).toBe('/');
    expect(recreateRoute(routes[2]!, {matches, params})).toBe('/settings/');
    expect(recreateRoute(routes[3]!, {matches, params})).toBe('/settings/org-slug/');
    expect(recreateRoute(routes[4]!, {matches, params})).toBe('/settings/org-slug/');
    expect(recreateRoute(routes[5]!, {matches, params})).toBe(
      '/settings/org-slug/api-keys/'
    );

    expect(
      recreateRoute(projectRoutes[5]!, {
        matches: projectMatches,
        location,
        params,
      })
    ).toBe('/settings/org-slug/project-slug/alerts/');
  });

  it('has correct path with route object with many roots (starts with "/")', () => {
    const m: UIMatch[] = [
      makeMatch('/', {}, {path: '/', childRoutes: []}),
      makeMatch('/', {}, {childRoutes: []}),
      makeMatch('/foo/', {}, {path: '/foo/', childRoutes: []}),
      makeMatch('/foo/', {}, {childRoutes: []}),
      makeMatch('/foo/bar', {}, {path: 'bar', childRoutes: []}),
      makeMatch('/settings/', {}, {path: '/settings/', name: 'Settings'}),
      makeMatch(
        '/settings/org-slug/',
        {orgId: 'org-slug'},
        {name: 'Organizations', path: ':orgId/', childRoutes: []}
      ),
      makeMatch('/settings/org-slug/', {orgId: 'org-slug'}, {childRoutes: []}),
      makeMatch(
        '/settings/org-slug/api-keys/',
        {orgId: 'org-slug'},
        {path: 'api-keys/', name: 'API Key'}
      ),
    ];
    const r = matchesToRoutes(m);

    expect(recreateRoute(r[4]!, {matches: m, params})).toBe('/foo/bar/');
  });

  it('returns correct path to a string (at the end of the routes)', () => {
    expect(recreateRoute('test/', {matches, location, params})).toBe(
      '/settings/org-slug/api-keys/test/'
    );
  });

  it('returns correct path to a string after the 2nd to last route', () => {
    expect(recreateRoute('test/', {matches, location, params, stepBack: -2})).toBe(
      '/settings/org-slug/test/'
    );
  });

  it('switches to new org but keeps current route', () => {
    expect(
      recreateRoute(routes[5]!, {
        matches,
        location,
        params: {orgId: 'new-org'},
      })
    ).toBe('/settings/new-org/api-keys/');
  });

  it('maintains the query string', () => {
    const withSearch = {
      ...LocationFixture(),
      search: '?key1=foo&key2=bar',
    };

    expect(recreateRoute(routes[5]!, {matches, params, location: withSearch})).toBe(
      '/settings/org-slug/api-keys/?key1=foo&key2=bar'
    );
  });
});
