import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {TopBar} from 'sentry/views/navigation/topBar';

import ConversationsLayout from './layout';

const organization = OrganizationFixture({
  features: ['performance-view', 'gen-ai-conversations'],
});

function renderLayout(
  location: {pathname: string; query?: Record<string, string | number | string[]>},
  route: string
) {
  return render(
    <TopBar.Slot.Provider>
      <div data-test-id="top-bar-container">
        <TopBar />
      </div>
      <ConversationsLayout />
    </TopBar.Slot.Provider>,
    {
      organization,
      initialRouterConfig: {
        route,
        location,
      },
    }
  );
}

describe('ConversationsLayout', () => {
  beforeEach(() => {
    PageFiltersStore.init();
  });

  it('renders the landing title on the list page', async () => {
    renderLayout(
      {pathname: `/organizations/${organization.slug}/explore/conversations/`},
      '/organizations/:orgId/explore/conversations/'
    );

    const topBar = screen.getByTestId('top-bar-container');
    expect(await within(topBar).findByText('AI Conversations')).toBeInTheDocument();
  });

  it('renders saved query breadcrumbs on the list page', async () => {
    renderLayout(
      {
        pathname: `/organizations/${organization.slug}/explore/conversations/`,
        query: {id: 'abc', title: 'My saved query'},
      },
      '/organizations/:orgId/explore/conversations/'
    );

    const topBar = screen.getByTestId('top-bar-container');
    expect(
      await within(topBar).findByRole('link', {name: 'Conversations'})
    ).toBeInTheDocument();
    expect(within(topBar).getByText('My saved query')).toBeInTheDocument();
  });

  it('defers the title to the detail page on a conversation detail route', async () => {
    renderLayout(
      {
        pathname: `/organizations/${organization.slug}/explore/conversations/6c5b72fc/`,
      },
      '/organizations/:orgId/explore/conversations/:conversationId/'
    );

    // The detail page renders its own breadcrumbs, so the layout leaves the
    // top bar title slot empty.
    const topBar = await screen.findByTestId('top-bar-container');
    expect(within(topBar).queryByText('AI Conversations')).not.toBeInTheDocument();
    expect(
      within(topBar).queryByRole('link', {name: 'Conversations'})
    ).not.toBeInTheDocument();
  });
});
