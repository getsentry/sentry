import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {IssueDetailsDrawer} from 'sentry/views/issueDetails/issueDetailsQueryParams';

import {useIssueDetailsDrawerOptions} from './useIssueDetailsDrawerOptions';

function renderDrawerOptions(location: {
  pathname: string;
  query?: Record<string, string>;
}) {
  return renderHookWithProviders(
    () =>
      useIssueDetailsDrawerOptions({
        drawer: IssueDetailsDrawer.ACTIVITY,
        groupId: '1',
        history: 'replace',
      }),
    {
      initialRouterConfig: {
        location,
        route: '/organizations/:orgId/issues/:groupId/',
        children: [{path: 'activity/', handle: {path: 'activity/'}}],
      },
    }
  );
}

describe('useIssueDetailsDrawerOptions', () => {
  it('keeps the page tab and event and drops the drawer params on close', async () => {
    const {result, router} = renderDrawerOptions({
      pathname: '/organizations/org-slug/issues/1/',
      query: {
        tab: 'replays',
        eventId: 'abc123',
        drawer: 'activity',
        filter: 'comments',
        environment: 'prod',
      },
    });

    act(() => result.current.onClose());

    await waitFor(() =>
      expect(router.location.query).toEqual({
        tab: 'replays',
        eventId: 'abc123',
        environment: 'prod',
      })
    );
  });

  it('returns to the page tab open before a path-based drawer', async () => {
    const {result, router} = renderDrawerOptions({
      pathname: '/organizations/org-slug/issues/1/',
      query: {tab: 'replays'},
    });

    act(() => router.navigate('/organizations/org-slug/issues/1/activity/'));
    act(() => result.current.onClose());

    await waitFor(() =>
      expect(router.location.pathname).toBe('/organizations/org-slug/issues/1/')
    );
    expect(router.location.query).toEqual({tab: 'replays'});
  });

  it('closes once the URL no longer opens the drawer', () => {
    const {result} = renderDrawerOptions({
      pathname: '/organizations/org-slug/issues/1/',
      query: {drawer: 'activity'},
    });

    expect(
      result.current.shouldCloseOnLocationChange({
        pathname: '/organizations/org-slug/issues/1/',
        query: {drawer: 'activity', tab: 'replays'},
      })
    ).toBe(false);
    expect(
      result.current.shouldCloseOnLocationChange({
        pathname: '/organizations/org-slug/issues/1/',
        query: {tab: 'replays'},
      })
    ).toBe(true);
  });
});
