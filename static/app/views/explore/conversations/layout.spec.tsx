import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {TopBar} from 'sentry/views/navigation/topBar';

import ConversationsLayout from './layout';

describe('ConversationsLayout', () => {
  beforeEach(() => {
    PageFiltersStore.init();
  });

  it('renders detail breadcrumbs in the top bar when page frame is enabled', async () => {
    const organization = OrganizationFixture({
      features: ['page-frame', 'performance-view', 'gen-ai-conversations'],
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
    expect(await within(topBar).findByTestId('breadcrumb-list')).toBeInTheDocument();
    expect(within(topBar).getByText('6c5b72fc')).toBeInTheDocument();
    expect(within(topBar).getByRole('link', {name: 'Conversations'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/explore/conversations/?environment=prod&project=1&statsPeriod=7d`
    );
  });
});
