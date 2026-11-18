import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {IssueDetailsDrawer} from './issueDetailsQueryParams';
import {Tab} from './types';
import {getIssueDetailsDrawer, useIssueDetailsParams} from './useGroupDetailsRoute';

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
