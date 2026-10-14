import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Text} from '@sentry/scraps/text';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

import {PrebuiltDashboardOnboardingGate} from './prebuiltDashboardOnboardingGate';

const organization = OrganizationFixture();
const eventsUrl = `/organizations/${organization.slug}/events/`;
const availabilityQuery = '(has:gen_ai.operation.type OR has:gen_ai.conversation.id)';
const project = ProjectFixture({
  id: '1',
  platform: 'ruby',
  hasInsightsAgentMonitoring: false,
});

function Dashboard({
  prebuiltId = PrebuiltDashboardId.AI_AGENTS_OVERVIEW,
}: {
  prebuiltId?: PrebuiltDashboardId;
}) {
  return (
    <PrebuiltDashboardOnboardingGate prebuiltId={prebuiltId}>
      <Text>Dashboard widgets</Text>
    </PrebuiltDashboardOnboardingGate>
  );
}

function mockAvailability(data: Array<{id: string}>) {
  return MockApiClient.addMockResponse({
    url: eventsUrl,
    match: [MockApiClient.matchQuery({query: availabilityQuery})],
    body: {data},
  });
}

describe('PrebuiltDashboardOnboardingGate', () => {
  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [1],
        environments: ['production'],
        datetime: {period: '30d', start: null, end: null, utc: false},
      })
    );
    MockApiClient.addMockResponse({url: eventsUrl, body: {data: []}});
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      body: ProjectKeysFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [],
    });
  });

  afterEach(() => {
    PageFiltersStore.reset();
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('renders flagged projects without querying spans', () => {
    ProjectsStore.loadInitialData([{...project, hasInsightsAgentMonitoring: true}]);
    const request = mockAvailability([]);

    render(<Dashboard />, {organization});

    expect(screen.getByText('Dashboard widgets')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    PrebuiltDashboardId.AI_AGENTS_OVERVIEW,
    PrebuiltDashboardId.AI_AGENTS_MODELS,
    PrebuiltDashboardId.AI_AGENTS_TOOLS,
  ])(
    'renders agent dashboard %s when spans exist without the project flag',
    async prebuiltId => {
      const request = mockAvailability([{id: 'ai-span'}]);

      render(<Dashboard prebuiltId={prebuiltId} />, {organization});

      expect(await screen.findByText('Dashboard widgets')).toBeInTheDocument();
      expect(request).toHaveBeenCalledWith(
        eventsUrl,
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            field: ['id'],
            per_page: 1,
            project: [1],
            environment: ['production'],
            statsPeriod: '30d',
            query: availabilityQuery,
          }),
        })
      );
      expect(
        screen.queryByRole('button', {name: 'Copy instructions'})
      ).not.toBeInTheDocument();
    }
  );

  it('does not flash onboarding while checking availability', async () => {
    mockAvailability([{id: 'ai-span'}]);

    render(<Dashboard />, {organization});

    expect(screen.queryByText('Dashboard widgets')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy instructions'})
    ).not.toBeInTheDocument();
    expect(await screen.findByText('Dashboard widgets')).toBeInTheDocument();
  });

  it('shows onboarding when neither a project flag nor span data exists', async () => {
    mockAvailability([]);

    render(<Dashboard />, {organization});

    expect(
      await screen.findByRole('button', {name: 'Copy instructions'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Dashboard widgets')).not.toBeInTheDocument();
  });

  it('lets widgets handle errors when the availability query fails', async () => {
    MockApiClient.addMockResponse({
      url: eventsUrl,
      statusCode: 500,
      body: {detail: 'Unavailable'},
    });

    render(<Dashboard />, {organization});

    expect(await screen.findByText('Dashboard widgets')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy instructions'})
    ).not.toBeInTheDocument();
  });

  it('does not use an unselected project’s flag', async () => {
    ProjectsStore.loadInitialData([
      project,
      ProjectFixture({id: '2', hasInsightsAgentMonitoring: true}),
    ]);
    mockAvailability([]);

    render(<Dashboard />, {organization});

    expect(
      await screen.findByRole('button', {name: 'Copy instructions'})
    ).toBeInTheDocument();
  });

  it.each([{projects: []}, {projects: [-1]}])(
    'uses any project flag for all-projects selection $projects',
    ({projects}) => {
      ProjectsStore.loadInitialData([{...project, hasInsightsAgentMonitoring: true}]);
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects}));
      const request = mockAvailability([]);

      render(<Dashboard />, {organization});

      expect(screen.getByText('Dashboard widgets')).toBeInTheDocument();
      expect(request).not.toHaveBeenCalled();
    }
  );

  it('rechecks a changed selection without retaining the previous project’s spans', async () => {
    ProjectsStore.loadInitialData([project, ProjectFixture({id: '2'})]);
    MockApiClient.addMockResponse({
      url: eventsUrl,
      match: [MockApiClient.matchQuery({query: availabilityQuery, project: [1]})],
      body: {data: [{id: 'ai-span'}]},
    });
    const emptyRequest = MockApiClient.addMockResponse({
      url: eventsUrl,
      match: [MockApiClient.matchQuery({query: availabilityQuery, project: [2]})],
      body: {data: []},
    });
    render(<Dashboard />, {organization});
    expect(await screen.findByText('Dashboard widgets')).toBeInTheDocument();

    act(() => {
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [2]}));
    });

    expect(screen.queryByText('Dashboard widgets')).not.toBeInTheDocument();
    await waitFor(() => expect(emptyRequest).toHaveBeenCalled());
    expect(
      await screen.findByRole('button', {name: 'Copy instructions'})
    ).toBeInTheDocument();
  });

  it('serializes an absolute time range', async () => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [1],
        datetime: {
          period: null,
          start: '2025-01-01T00:00:00',
          end: '2025-01-02T00:00:00',
          utc: true,
        },
      })
    );
    const request = mockAvailability([{id: 'ai-span'}]);
    render(<Dashboard />, {organization});

    expect(await screen.findByText('Dashboard widgets')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      eventsUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          start: '2025-01-01T00:00:00.000',
          end: '2025-01-02T00:00:00.000',
          utc: 'true',
        }),
      })
    );
  });

  it('does not query spans for unrelated dashboard onboarding', () => {
    ProjectsStore.loadInitialData([{...project, hasSessions: true}]);
    const request = mockAvailability([]);
    render(<Dashboard prebuiltId={PrebuiltDashboardId.FRONTEND_SESSION_HEALTH} />, {
      organization,
    });

    expect(screen.getByText('Dashboard widgets')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
