import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import AutofixOverview2 from 'sentry/views/seerWorkflows/overview2';

describe('AutofixOverview2', () => {
  const organization = OrganizationFixture({
    features: ['seer-night-shift-ui'],
  });
  const basePath = `/organizations/${organization.slug}/issues/autofix/overview2/`;

  const emptyMilestones = {
    autofix_root_cause: [],
    autofix_solution: [],
    autofix_code_changes: [],
    has_pull_request: [],
    pull_requests_merged: [],
  };

  const rootCauseRun = {
    groupId: '2',
    shortId: 'PROJ-1',
    title: 'TypeError in checkout cart',
    rootCause: {
      oneLineDescription: 'The cart total is read before it is set.',
    },
    proposedFix: null,
    seerRunId: 'run-1',
    lastTriggeredAt: '2026-07-14T09:00:00Z',
  };

  const solutionRun = {
    groupId: '3',
    shortId: 'PROJ-2',
    title: 'KeyError in proxy handler',
    rootCause: {oneLineDescription: 'The Authorization header is dropped.'},
    proposedFix: {
      oneLineSummary: 'Restore the Authorization header as a fallback.',
    },
    seerRunId: 'run-2',
    lastTriggeredAt: '2026-07-14T10:00:00Z',
  };

  function mockOverview(runsByMilestone: Record<string, unknown[]>) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      body: {runsByMilestone: {...emptyMilestones, ...runsByMilestone}},
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    localStorage.clear();

    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
    ProjectsStore.loadInitialData([ProjectFixture()]);
    OrganizationStore.onUpdate(organization, {replace: true});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [ProjectFixture()],
    });
  });

  function renderPage() {
    return render(<AutofixOverview2 />, {
      organization,
      initialRouterConfig: {location: {pathname: basePath}},
    });
  }

  it('gates the page behind the seer-night-shift-ui feature', () => {
    mockOverview({});

    render(<AutofixOverview2 />, {
      organization: OrganizationFixture({features: []}),
      initialRouterConfig: {location: {pathname: basePath}},
    });

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
    expect(screen.queryByText('Autofix Overview')).not.toBeInTheDocument();
  });

  it('renders every section with counts from the single endpoint', async () => {
    mockOverview({
      autofix_root_cause: [rootCauseRun],
      autofix_solution: [solutionRun],
    });

    renderPage();

    expect(
      await screen.findByRole('button', {name: 'Confirm Root Cause 1'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Generate code changes 1'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create PR 0'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Review Open PRs 0'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Merged 0'})).toBeInTheDocument();
  });

  it('renders card prose and links from the endpoint payload', async () => {
    mockOverview({
      autofix_root_cause: [rootCauseRun],
      autofix_solution: [solutionRun],
    });

    renderPage();

    const titleLink = await screen.findByRole('link', {
      name: 'TypeError in checkout cart',
    });
    expect(titleLink).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/2/`
    );

    expect(
      screen.getByText('The cart total is read before it is set.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Restore the Authorization header as a fallback.')
    ).toBeInTheDocument();
    expect(screen.getByText('PROJ-1')).toBeInTheDocument();

    // The root-cause-only run has no proposed fix, so only the solution card
    // carries the fix label.
    expect(screen.getAllByText('Root cause')).toHaveLength(2);
    expect(screen.getAllByText('Proposed fix')).toHaveLength(1);
  });

  it('renders the whole page from one request, with no per-card enrichment', async () => {
    // Two projects keep the page-filter selection at "My Projects"; a lone
    // project gets force-selected, which legitimately refetches once.
    ProjectsStore.loadInitialData([
      ProjectFixture(),
      ProjectFixture({id: '11', slug: 'project-two'}),
    ]);
    const overviewRequest = mockOverview({
      autofix_root_cause: [rootCauseRun],
      autofix_solution: [solutionRun],
    });
    const runsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: [],
    });
    const autofixRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/2/autofix/`,
      body: {autofix: null},
    });
    const issuesRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [],
    });

    renderPage();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();

    expect(overviewRequest).toHaveBeenCalledTimes(1);
    expect(runsRequest).not.toHaveBeenCalled();
    expect(autofixRequest).not.toHaveBeenCalled();
    expect(issuesRequest).not.toHaveBeenCalled();
  });

  it('scopes the request to the selected project', async () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [2]}));
    const overviewRequest = mockOverview({
      autofix_root_cause: [rootCauseRun],
    });

    renderPage();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();
    expect(overviewRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/autofix-overview/`,
      expect.objectContaining({
        query: expect.objectContaining({project: [2]}),
      })
    );
  });

  it('shows an error state when the request fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      statusCode: 500,
      body: {detail: 'boom'},
    });

    renderPage();

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });
});
