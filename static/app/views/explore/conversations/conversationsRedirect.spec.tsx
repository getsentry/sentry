import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import ConversationsRedirect from './conversationsRedirect';

describe('ConversationsRedirect', () => {
  it('redirects the legacy list path to the agents landing, preserving query', async () => {
    const {router} = render(<ConversationsRedirect />, {
      organization: OrganizationFixture(),
      initialRouterConfig: {
        route: '/organizations/:orgId/explore/conversations/',
        location: {
          pathname: '/organizations/org-slug/explore/conversations/',
          query: {statsPeriod: '24h'},
        },
      },
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/org-slug/explore/agents/');
    });
    expect(router.location.query).toEqual({statsPeriod: '24h'});
  });

  it('redirects a legacy detail path under the agents path, preserving query', async () => {
    const {router} = render(<ConversationsRedirect />, {
      organization: OrganizationFixture(),
      initialRouterConfig: {
        route: '/organizations/:orgId/explore/conversations/:conversationId/',
        location: {
          pathname: '/organizations/org-slug/explore/conversations/conv-1/',
          query: {referrer: 'trace-view'},
        },
      },
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/explore/agents/conversations/conv-1/'
      );
    });
    expect(router.location.query).toEqual({referrer: 'trace-view'});
  });
});
