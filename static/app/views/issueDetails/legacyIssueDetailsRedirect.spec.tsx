import {Outlet} from 'react-router';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import LegacyIssueDetailsRedirect from './legacyIssueDetailsRedirect';
import {Tab, TabPaths} from './types';

function renderRedirect({
  path,
  pathname,
  tab,
  query,
}: {
  path: string;
  pathname: string;
  tab: Tab;
  query?: Record<string, string>;
}) {
  return render(<Outlet />, {
    initialRouterConfig: {
      location: {pathname, query},
      route: '/organizations/:orgId/issues/',
      children: [
        {
          path,
          handle: {legacyIssueDetailsTab: tab},
          element: <LegacyIssueDetailsRedirect />,
        },
        {path: ':groupId/', element: <div>Issue details</div>},
      ],
    },
  });
}

describe('LegacyIssueDetailsRedirect', () => {
  it('moves a page tab into the query', async () => {
    const {router} = renderRedirect({
      path: `:groupId/${TabPaths[Tab.REPLAYS]}`,
      pathname: '/organizations/org-slug/issues/1/replays/',
      tab: Tab.REPLAYS,
      query: {environment: 'prod'},
    });

    expect(await screen.findByText('Issue details')).toBeInTheDocument();
    expect(router.location.pathname).toBe('/organizations/org-slug/issues/1/');
    expect(router.location.query).toEqual({environment: 'prod', tab: 'replays'});
  });

  it('keeps the query and the hash', async () => {
    const {router} = renderRedirect({
      path: ':groupId/events/:eventId/',
      pathname: '/organizations/org-slug/issues/',
      tab: Tab.DETAILS,
    });

    // The initial location in tests can't carry a hash.
    act(() =>
      router.navigate(
        '/organizations/org-slug/issues/1/events/abc123/?referrer=slack&notification_uuid=uuid#replay'
      )
    );

    await waitFor(() =>
      expect(router.location.pathname).toBe('/organizations/org-slug/issues/1/')
    );
    expect(router.location.query).toEqual({
      eventId: 'abc123',
      referrer: 'slack',
      notification_uuid: 'uuid',
    });
    expect(router.location.hash).toBe('#replay');
  });

  it('replaces the history entry', async () => {
    const {router} = renderRedirect({
      path: `:groupId/${TabPaths[Tab.ATTACHMENTS]}`,
      pathname: '/organizations/org-slug/issues/1/attachments/',
      tab: Tab.ATTACHMENTS,
    });

    await waitFor(() => expect(router.location.query).toEqual({tab: 'attachments'}));
    expect(router.historyAction).toBe('REPLACE');
  });
});
