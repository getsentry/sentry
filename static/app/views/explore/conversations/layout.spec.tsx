import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {TopBar} from 'sentry/views/navigation/topBar';

import ConversationsLayout from './layout';
import {CONVERSATIONS_LANDING_TITLE, CONVERSATIONS_SIDEBAR_LABEL} from './settings';

const organization = OrganizationFixture({
  features: ['performance-view', 'gen-ai-conversations'],
});

function renderLayout(
  location: {pathname: string; query?: Record<string, string | number | string[]>},
  route: string,
  features?: string[]
) {
  return render(
    <TopBar.Slot.Provider>
      <TopBar />
      <ConversationsLayout />
    </TopBar.Slot.Provider>,
    {
      organization: features
        ? OrganizationFixture({features: [...organization.features, ...features]})
        : organization,
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
      {pathname: `/organizations/${organization.slug}/explore/agents/`},
      '/organizations/:orgId/explore/agents/'
    );

    const topBar = screen.getByRole('banner');
    expect(
      await within(topBar).findByText(CONVERSATIONS_LANDING_TITLE)
    ).toBeInTheDocument();
    expect(within(topBar).getByLabelText('new')).toBeInTheDocument();
  });

  it('renders saved query breadcrumbs on the list page', async () => {
    renderLayout(
      {
        pathname: `/organizations/${organization.slug}/explore/agents/`,
        query: {id: 'abc', title: 'My saved query'},
      },
      '/organizations/:orgId/explore/agents/'
    );

    const topBar = screen.getByRole('banner');
    expect(
      await within(topBar).findByRole('link', {name: CONVERSATIONS_SIDEBAR_LABEL})
    ).toBeInTheDocument();
    expect(within(topBar).getByText('My saved query')).toBeInTheDocument();
  });

  it('renders saved query breadcrumbs with BreadcrumbList', async () => {
    renderLayout(
      {
        pathname: `/organizations/${organization.slug}/explore/agents/`,
        query: {id: 'abc', title: 'My saved query'},
      },
      '/organizations/:orgId/explore/agents/'
    );

    const topBar = screen.getByRole('banner');
    expect(
      await within(topBar).findByRole('link', {name: CONVERSATIONS_SIDEBAR_LABEL})
    ).toBeInTheDocument();
    // The saved query title is the page heading, owned by the TopBar title slot.
    expect(
      within(topBar).getByRole('heading', {name: /My saved query/})
    ).toBeInTheDocument();
  });

  it('defers the title to the detail page on a conversation detail route', () => {
    renderLayout(
      {
        pathname: `/organizations/${organization.slug}/explore/agents/conversations/6c5b72fc/`,
      },
      '/organizations/:orgId/explore/agents/conversations/:conversationId/'
    );

    // The detail page renders its own breadcrumbs, so the layout leaves the
    // top bar title slot empty.
    const topBar = screen.getByRole('banner');
    expect(
      within(topBar).queryByText(CONVERSATIONS_LANDING_TITLE)
    ).not.toBeInTheDocument();
    expect(
      within(topBar).queryByRole('link', {name: CONVERSATIONS_SIDEBAR_LABEL})
    ).not.toBeInTheDocument();
  });
});
