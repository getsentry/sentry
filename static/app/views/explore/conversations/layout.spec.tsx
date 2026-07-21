import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {TopBar} from 'sentry/views/navigation/topBar';

import ConversationsLayout from './layout';

describe('ConversationsLayout', () => {
  beforeEach(() => {
    PageFiltersStore.init();
  });

  it('renders detail breadcrumbs in the top bar', async () => {
    const organization = OrganizationFixture({
      features: ['performance-view', 'gen-ai-conversations'],
    });

    render(
      <TopBar.Slot.Provider>
        <div data-test-id="top-bar-container">
          <TopBar />
        </div>
        <ConversationsLayout />
      </TopBar.Slot.Provider>,
      {
        organization,
        initialRouterConfig: {
          route: '/organizations/:orgId/explore/conversations/:conversationId/',
          location: {
            pathname: `/organizations/${organization.slug}/explore/conversations/6c5b72fc/`,
            query: {
              environment: ['prod'],
              project: ['1'],
              statsPeriod: '7d',
            },
          },
        },
      }
    );

    const topBar = screen.getByTestId('top-bar-container');
    expect(await within(topBar).findByText('6c5b72fc')).toBeInTheDocument();
    expect(within(topBar).getByRole('link', {name: 'Conversations'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/explore/conversations/?environment=prod&project=1&referrer=conversations-breadcrumb&statsPeriod=24h`
    );
  });

  it('restores the originating list filters from router state', async () => {
    const organization = OrganizationFixture({
      features: ['performance-view', 'gen-ai-conversations'],
    });

    render(
      <TopBar.Slot.Provider>
        <div data-test-id="top-bar-container">
          <TopBar />
        </div>
        <ConversationsLayout />
      </TopBar.Slot.Provider>,
      {
        organization,
        initialRouterConfig: {
          route: '/organizations/:orgId/explore/conversations/:conversationId/',
          location: {
            pathname: `/organizations/${organization.slug}/explore/conversations/6c5b72fc/`,
            // The detail page repurposes start/end as the conversation window,
            // so the list filters are carried over via router state instead.
            query: {
              start: '2024-01-01T00:00:00.000Z',
              end: '2024-01-02T00:00:00.000Z',
              project: ['1'],
            },
            state: {
              conversationsListQuery: {
                project: ['1'],
                environment: ['prod'],
                statsPeriod: '7d',
                query: 'gen_ai.conversation.id:abc',
                agent: 'my-agent',
              },
            },
          },
        },
      }
    );

    const topBar = screen.getByTestId('top-bar-container');
    const link = await within(topBar).findByRole('link', {name: 'Conversations'});
    const href = link.getAttribute('href')!;
    const [pathname, search] = href.split('?');
    const params = new URLSearchParams(search);

    expect(pathname).toBe(`/organizations/${organization.slug}/explore/conversations/`);
    // The user's original list filters are restored exactly...
    expect(params.get('statsPeriod')).toBe('7d');
    expect(params.get('environment')).toBe('prod');
    expect(params.get('project')).toBe('1');
    expect(params.get('query')).toBe('gen_ai.conversation.id:abc');
    expect(params.get('agent')).toBe('my-agent');
    // ...and the conversation-scoped time window does not leak back in.
    expect(params.has('start')).toBe(false);
    expect(params.has('end')).toBe(false);
  });

  it('refreshes restored filters when re-opening the same conversation', async () => {
    const organization = OrganizationFixture({
      features: ['performance-view', 'gen-ai-conversations'],
    });
    const detailPathname = `/organizations/${organization.slug}/explore/conversations/6c5b72fc/`;

    const {router} = render(
      <TopBar.Slot.Provider>
        <div data-test-id="top-bar-container">
          <TopBar />
        </div>
        <ConversationsLayout />
      </TopBar.Slot.Provider>,
      {
        organization,
        initialRouterConfig: {
          route: '/organizations/:orgId/explore/conversations/:conversationId/',
          location: {
            pathname: detailPathname,
            state: {conversationsListQuery: {statsPeriod: '7d'}},
          },
        },
      }
    );

    const topBar = screen.getByTestId('top-bar-container');
    expect(
      await within(topBar).findByRole('link', {name: 'Conversations'})
    ).toHaveAttribute('href', expect.stringContaining('statsPeriod=7d'));

    // Re-open the same conversation with a different list query (e.g. the user
    // changed filters on the list before clicking back in).
    router.navigate(detailPathname, {
      state: {conversationsListQuery: {statsPeriod: '14d', query: 'foo:bar'}},
    });

    const link = await within(topBar).findByRole('link', {name: 'Conversations'});
    const params = new URLSearchParams(link.getAttribute('href')!.split('?')[1]);
    expect(params.get('statsPeriod')).toBe('14d');
    expect(params.get('query')).toBe('foo:bar');
  });
});
