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

  it('closes once the URL no longer opens the drawer', () => {
    const {result} = renderDrawerOptions({
      pathname: '/organizations/org-slug/issues/1/',
      query: {drawer: 'activity'},
    });

    expect(
      result.current.shouldCloseOnLocationChange({
        query: {drawer: 'activity', tab: 'replays'},
      })
    ).toBe(false);
    expect(result.current.shouldCloseOnLocationChange({query: {tab: 'replays'}})).toBe(
      true
    );
  });
});
