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

const savedQueryBody = {
  id: 1,
  name: 'My saved query',
  dataset: 'ai_conversations',
  projects: [1],
  starred: false,
  query: [{visualize: [], groupby: []}],
};

describe('ConversationsLayout', () => {
  beforeEach(() => {
    PageFiltersStore.init();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/abc/`,
      body: savedQueryBody,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
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

  it('splits a saved query across the breadcrumb and title slots', async () => {
    renderLayout(
      {
        pathname: `/organizations/${organization.slug}/explore/agents/`,
        query: {id: 'abc', title: 'My saved query'},
      },
      '/organizations/:orgId/explore/agents/'
    );

    const topBar = screen.getByRole('banner');
    const trail = await within(topBar).findByRole('list');

    expect(
      within(trail).getByRole('link', {name: CONVERSATIONS_SIDEBAR_LABEL})
    ).toBeInTheDocument();
    // The parent crumb is a link, never a second heading.
    expect(
      within(topBar).queryByRole('heading', {name: CONVERSATIONS_SIDEBAR_LABEL})
    ).not.toBeInTheDocument();

    // The saved query title is the page heading, owned by the TopBar title slot,
    // and must not also appear in the trail.
    expect(
      within(topBar).getByRole('heading', {name: /My saved query/, level: 1})
    ).toBeInTheDocument();
    expect(within(trail).queryByText('My saved query')).not.toBeInTheDocument();
  });

  it('offers the saved query actions beside the title', async () => {
    renderLayout(
      {
        pathname: `/organizations/${organization.slug}/explore/agents/`,
        query: {id: 'abc', title: 'My saved query'},
      },
      '/organizations/:orgId/explore/agents/'
    );

    const topBar = screen.getByRole('banner');
    expect(
      await within(topBar).findByRole('button', {name: 'More saved query options'})
    ).toBeInTheDocument();
    expect(within(topBar).getByRole('button', {name: 'Star'})).toBeInTheDocument();
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
