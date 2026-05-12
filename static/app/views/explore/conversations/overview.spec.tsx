import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

import ConversationsOverviewPage from './overview';

jest.mock(
  'sentry/views/explore/conversations/hooks/useShowConversationOnboarding',
  () => ({
    useShowConversationOnboarding: () => ({
      showOnboarding: false,
      isLoading: false,
      refetch: jest.fn(),
    }),
  })
);

jest.mock('sentry/views/explore/conversations/components/conversationsTable', () => ({
  ConversationsTable: () => <div data-test-id="conversations-table" />,
}));

jest.mock('sentry/views/insights/common/components/agentSelector', () => ({
  AgentSelector: () => <button type="button">Agent</button>,
}));

describe('ConversationsOverviewPage', () => {
  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/validate/',
      method: 'POST',
      body: {attributes: {}},
    });
  });

  it('auto-focuses the search query builder', async () => {
    const organization = OrganizationFixture({
      features: ['gen-ai-conversations'],
    });

    render(<ConversationsOverviewPage />, {organization});

    expect(await screen.findByRole('combobox')).toHaveFocus();
  });
});
