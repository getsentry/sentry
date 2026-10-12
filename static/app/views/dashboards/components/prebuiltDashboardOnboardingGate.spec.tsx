import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {PrebuiltDashboardOnboardingGate} from 'sentry/views/dashboards/components/prebuiltDashboardOnboardingGate';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

jest.mock('sentry/views/insights/pages/agents/onboarding', () => ({
  Onboarding: () => <div>Agent onboarding</div>,
}));

describe('PrebuiltDashboardOnboardingGate', () => {
  function setup({hasInsightsAgentMonitoring}: {hasInsightsAgentMonitoring: boolean}) {
    const project = ProjectFixture({
      id: '1',
      hasInsightsAgentMonitoring,
      firstTransactionEvent: true,
    });
    ProjectsStore.loadInitialData([project]);
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [1]}));
  }

  function renderGate() {
    render(
      <PrebuiltDashboardOnboardingGate
        prebuiltId={PrebuiltDashboardId.AI_AGENTS_OVERVIEW}
      >
        <div>Dashboard content</div>
      </PrebuiltDashboardOnboardingGate>
    );
  }

  afterEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.reset();
    ProjectsStore.reset();
  });

  it('renders the dashboard when the project flag is set', () => {
    setup({hasInsightsAgentMonitoring: true});
    const eventsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });

    renderGate();

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    expect(eventsRequest).not.toHaveBeenCalled();
  });

  it('renders the dashboard when AI spans exist without the project flag', async () => {
    setup({hasInsightsAgentMonitoring: false});
    const eventsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{id: 'span-id'}]},
    });

    renderGate();

    expect(await screen.findByText('Dashboard content')).toBeInTheDocument();
    expect(eventsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'has:gen_ai.operation.type',
          referrer: 'api.insights.agent-monitoring.onboarding',
        }),
      })
    );
  });

  it('renders onboarding when there are no AI spans', async () => {
    setup({hasInsightsAgentMonitoring: false});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });

    renderGate();

    expect(await screen.findByText('Agent onboarding')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
  });
});
