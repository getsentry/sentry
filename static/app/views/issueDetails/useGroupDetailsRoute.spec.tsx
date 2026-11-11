import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {IssueDetailsDrawer} from './issueDetailsQueryParams';
import {Tab} from './types';
import {
  getIssueDetailsDrawer,
  useIssueDetailsLinks,
  useIssueDetailsParams,
} from './useGroupDetailsRoute';

describe('useIssueDetailsParams', () => {
  it('reads the page tab, event, drawer and tag key from the query', () => {
    const {result} = renderHookWithProviders(useIssueDetailsParams, {
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/1/',
          query: {
            tab: 'replays',
            eventId: 'abc123',
            drawer: 'distributions',
            tagKey: 'browser',
          },
        },
        route: '/organizations/:orgId/issues/:groupId/',
      },
    });

    expect(result.current).toEqual({
      currentTab: Tab.REPLAYS,
      drawer: IssueDetailsDrawer.DISTRIBUTIONS,
      eventId: 'abc123',
      tagKey: 'browser',
    });
  });

  it('falls back to the event and tag key in the path', () => {
    const {result} = renderHookWithProviders(useIssueDetailsParams, {
      initialRouterConfig: {
        location: {
          pathname:
            '/organizations/org-slug/issues/1/events/abc123/distributions/browser/',
        },
        route:
          '/organizations/:orgId/issues/:groupId/events/:eventId/distributions/:tagKey/',
      },
    });

    expect(result.current).toEqual({
      currentTab: Tab.DETAILS,
      drawer: IssueDetailsDrawer.DISTRIBUTIONS,
      eventId: 'abc123',
      tagKey: 'browser',
    });
  });

  it('ignores issue details params outside issue details', () => {
    const {result} = renderHookWithProviders(useIssueDetailsParams, {
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/feedback/',
          query: {tab: 'replays', drawer: 'activity', eventId: 'abc123'},
        },
        route: '/organizations/:orgId/issues/feedback/',
      },
    });

    expect(result.current).toEqual({
      currentTab: Tab.DETAILS,
      drawer: null,
      eventId: undefined,
      tagKey: undefined,
    });
  });
});

describe('useIssueDetailsLinks', () => {
  const pathname = '/organizations/org-slug/issues/1/';
  const initialRouterConfig = {
    location: {
      pathname,
      query: {
        tab: 'events',
        eventId: 'abc123',
        drawer: 'distributions',
        tagKey: 'browser',
        type: 'featureFlags',
        cursor: '0:100:0',
        environment: 'prod',
      },
    },
    route: '/organizations/:orgId/issues/:groupId/',
  };

  function renderLinks() {
    return renderHookWithProviders(() => useIssueDetailsLinks({groupId: '1'}), {
      initialRouterConfig,
    }).result;
  }

  it('selects an event and keeps the page tab and drawer', () => {
    expect(renderLinks().current.event('latest', {query: {referrer: 'test'}})).toEqual({
      pathname,
      query: {...initialRouterConfig.location.query, eventId: 'latest', referrer: 'test'},
    });
  });

  it("switches page tab, dropping the old tab's params", () => {
    expect(renderLinks().current.tab(Tab.REPLAYS).query).toEqual({
      tab: 'replays',
      eventId: 'abc123',
      drawer: 'distributions',
      tagKey: 'browser',
      type: 'featureFlags',
      environment: 'prod',
    });
  });

  it('opens a drawer with its params', () => {
    expect(
      renderLinks().current.drawer(IssueDetailsDrawer.ACTIVITY, {filter: 'comments'})
        .query
    ).toEqual({
      tab: 'events',
      eventId: 'abc123',
      drawer: 'activity',
      filter: 'comments',
      cursor: '0:100:0',
      environment: 'prod',
    });
  });

  it("keeps the open drawer's params and sets the given ones on top", () => {
    expect(
      renderLinks().current.drawer(IssueDetailsDrawer.DISTRIBUTIONS, {tagKey: null}).query
    ).toEqual({
      tab: 'events',
      eventId: 'abc123',
      drawer: 'distributions',
      type: 'featureFlags',
      cursor: '0:100:0',
      environment: 'prod',
    });
  });

  it('closes the drawer and drops its params', () => {
    expect(renderLinks().current.closeDrawer().query).toEqual({
      tab: 'events',
      eventId: 'abc123',
      cursor: '0:100:0',
      environment: 'prod',
    });
  });
});

describe('getIssueDetailsDrawer', () => {
  it('reads the drawer from the query', () => {
    expect(
      getIssueDetailsDrawer({
        pathname: '/organizations/org-slug/issues/1/',
        query: {drawer: 'merged', tab: 'events'},
      })
    ).toBe(IssueDetailsDrawer.MERGED);
  });

  it('reads the drawer from legacy paths', () => {
    expect(
      getIssueDetailsDrawer({
        pathname: '/organizations/org-slug/issues/1/activity/',
        query: {},
      })
    ).toBe(IssueDetailsDrawer.ACTIVITY);
    expect(
      getIssueDetailsDrawer({
        pathname: '/issues/1/events/abc123/distributions/browser/',
        query: {},
      })
    ).toBe(IssueDetailsDrawer.DISTRIBUTIONS);
  });

  it('returns null without a drawer', () => {
    expect(
      getIssueDetailsDrawer({
        pathname: '/organizations/org-slug/issues/1/replays/',
        query: {tab: 'events'},
      })
    ).toBeNull();
  });
});
