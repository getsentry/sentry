import {GroupFixture} from 'sentry-fixture/group';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {useDrawer} from '@sentry/scraps/drawer';

import {DiffFileType, DiffLineType} from 'sentry/components/events/autofix/types';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Actor} from 'sentry/types/core';
import type {PullRequestStatus} from 'sentry/types/integrations';
import AutofixOverview from 'sentry/views/seerWorkflows/overview';
import type {
  AutofixOverviewResponse,
  OverviewPullRequest,
  OverviewRunIssue,
} from 'sentry/views/seerWorkflows/overview/types';
import {useOverviewSeerDrawer} from 'sentry/views/seerWorkflows/overview/useOverviewSeerDrawer';

describe('AutofixOverview', () => {
  const organization = OrganizationFixture({
    features: ['seer-night-shift-ui', 'gen-ai-features'],
  });
  const basePath = `/organizations/${organization.slug}/issues/autofix/overview/`;

  const emptyMilestones = {
    autofix_root_cause: [],
    autofix_solution: [],
    autofix_code_changes: [],
    has_pull_request: [],
    pull_requests_merged: [],
  };

  function issueFixture(overrides: Partial<OverviewRunIssue> = {}): OverviewRunIssue {
    return {
      ...GroupFixture(),
      count: '0',
      userCount: 0,
      owners: [],
      substatus: 'ongoing',
      project: {id: '2', slug: 'project-slug', platform: 'python'},
      ...overrides,
    };
  }

  function pullRequestFixture({
    number,
    status,
  }: {
    number: number;
    status: PullRequestStatus | null;
  }): OverviewPullRequest {
    return {
      id: String(number),
      number,
      url: `https://github.com/getsentry/sentry/pull/${number}`,
      status,
      checksStatus: null,
      reviewStatus: null,
      files: [],
      failedChecks: [],
    };
  }

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
    pullRequests: [],
    status: null,
    issue: issueFixture({count: '1200', userCount: 5}),
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
    pullRequests: [],
    status: null,
    issue: issueFixture({project: {id: '3', slug: 'project-slug', platform: 'python'}}),
  };

  function mockOverview({
    base,
    enriched,
    enrichedAsyncDelay,
    enrichedStatusCode,
    baseStatusCode,
    truncated,
  }: {
    base: Partial<AutofixOverviewResponse['runsByMilestone']>;
    baseStatusCode?: number;
    enriched?: Partial<AutofixOverviewResponse['runsByMilestone']>;
    enrichedAsyncDelay?: number | Promise<void>;
    enrichedStatusCode?: number;
    truncated?: AutofixOverviewResponse['truncatedMilestones'];
  }) {
    const statusPollRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      statusCode: baseStatusCode,
      body: {
        runsByMilestone: {...emptyMilestones, ...base},
        truncatedMilestones: truncated ?? [],
      },
    });
    const enrichedRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      match: [MockApiClient.matchQuery({expand: ['scmInfo', 'issueStats', 'status']})],
      asyncDelay: enrichedAsyncDelay,
      statusCode: enrichedStatusCode,
      body: {
        runsByMilestone: {...emptyMilestones, ...(enriched ?? base)},
        truncatedMilestones: truncated ?? [],
      },
    });
    return {statusPollRequest, enrichedRequest};
  }

  // The un-expanded call cannot reach Snuba, so it nulls out the issue stats.
  const unenrichedRootCauseRun = {
    ...rootCauseRun,
    issue: issueFixture({count: null, userCount: null, lastSeen: null}),
  };

  // Holds the enriched response open so the pending state can be asserted, with
  // no reliance on real timers.
  function deferEnriched() {
    let resolve!: () => void;
    const promise = new Promise<void>(r => {
      resolve = r;
    });
    return {promise, resolve};
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
    // The reused assignee selector self-fetches its member options.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {integrations: []},
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/seer/repos/',
      body: [{provider: 'github'}],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/repos/',
      body: {repos: [{has_write_access: true, integration_id: 5}]},
    });
  });

  function renderPage(query: Record<string, string> = {}) {
    return render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {location: {pathname: basePath, query}},
    });
  }

  function getTagForText(text: string) {
    const tag = screen.getByText(text).closest('[data-test-id="tag-background"]');
    expect(tag).toBeInTheDocument();
    return tag!;
  }

  it('gates the page and issues no requests when the feature is disabled', async () => {
    const {statusPollRequest, enrichedRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });

    render(<AutofixOverview />, {
      organization: OrganizationFixture({features: []}),
      initialRouterConfig: {location: {pathname: basePath}},
    });

    expect(
      await screen.findByText("You don't have access to this feature")
    ).toBeInTheDocument();
    expect(screen.queryByText('Autofix Overview')).not.toBeInTheDocument();
    expect(statusPollRequest).not.toHaveBeenCalled();
    expect(enrichedRequest).not.toHaveBeenCalled();
  });

  it('renders only populated sections with counts from the single endpoint', async () => {
    mockOverview({
      base: {
        autofix_root_cause: [rootCauseRun],
        autofix_solution: [solutionRun],
      },
    });

    renderPage();

    expect(
      await screen.findByRole('button', {name: 'Create Plan 1'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Generate code changes 1'})
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Create PR/})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: /Review Open PRs/})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Merged/})).not.toBeInTheDocument();
    expect(screen.queryByText('No issues')).not.toBeInTheDocument();
  });

  it('refetches the overview after a card action is dispatched', async () => {
    const {enrichedRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/',
      method: 'POST',
      body: {run_id: 1, sentry_run_id: 'run-1'},
    });

    renderPage();

    await userEvent.click(await screen.findByRole('button', {name: 'Create Plan'}));

    expect(await screen.findByRole('button', {name: /Creating Plan/})).toBeDisabled();
    await waitFor(() => expect(enrichedRequest).toHaveBeenCalledTimes(2));
  });

  describe('Seer drawer', () => {
    // Holds setup open so the drawer sits in its loading state and fires no
    // downstream content requests.
    function mockDrawerFor(groupId: string) {
      const groupRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${groupId}/`,
        body: GroupFixture({id: groupId}),
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${groupId}/autofix/`,
        body: {autofix: null},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${groupId}/autofix/setup/`,
        asyncDelay: new Promise<void>(() => {}),
        body: {},
      });
      return groupRequest;
    }

    function seerDrawer() {
      return screen.queryByRole('complementary', {name: 'Seer drawer'});
    }

    // Drives the hook alongside a button that opens a second drawer, so a test
    // can replace and dismiss the Seer drawer the way Seer Agent would.
    function DrawerHarness() {
      useOverviewSeerDrawer();
      const {openDrawer} = useDrawer();
      return (
        <button
          onClick={() =>
            openDrawer(() => <div>Other drawer body</div>, {ariaLabel: 'Other drawer'})
          }
        >
          open other
        </button>
      );
    }

    it('opens in place when the URL carries a group id', async () => {
      mockOverview({base: {autofix_root_cause: [rootCauseRun]}});
      const groupRequest = mockDrawerFor('2');

      renderPage({seerDrawer: '2'});

      // The overview list stays mounted behind the drawer.
      expect(
        await screen.findByRole('link', {name: 'TypeError in checkout cart'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('complementary', {name: 'Seer drawer'})
      ).toBeInTheDocument();
      expect(groupRequest).toHaveBeenCalled();
    });

    it('stays closed and clears the param when the org lacks gen-ai access', async () => {
      mockOverview({base: {autofix_root_cause: [rootCauseRun]}});
      mockDrawerFor('2');

      const {router} = render(<AutofixOverview />, {
        organization: OrganizationFixture({features: ['seer-night-shift-ui']}),
        initialRouterConfig: {
          location: {pathname: basePath, query: {seerDrawer: '2'}},
        },
      });

      expect(
        await screen.findByRole('link', {name: 'TypeError in checkout cart'})
      ).toBeInTheDocument();
      expect(seerDrawer()).not.toBeInTheDocument();
      await waitFor(() => expect(router.location.query.seerDrawer).toBeUndefined());
    });

    it('clears the param and closes when the drawer is dismissed', async () => {
      mockOverview({base: {autofix_root_cause: [rootCauseRun]}});
      mockDrawerFor('2');

      const {router} = renderPage({seerDrawer: '2'});

      await userEvent.click(await screen.findByRole('button', {name: 'Close Drawer'}));

      await waitFor(() => expect(seerDrawer()).not.toBeInTheDocument());
      expect(router.location.query.seerDrawer).toBeUndefined();
    });

    it('closes when the group id leaves the URL (back navigation)', async () => {
      mockOverview({base: {autofix_root_cause: [rootCauseRun]}});
      mockDrawerFor('2');

      const {router} = renderPage({seerDrawer: '2'});

      expect(
        await screen.findByRole('complementary', {name: 'Seer drawer'})
      ).toBeInTheDocument();

      router.navigate(basePath);

      await waitFor(() => expect(seerDrawer()).not.toBeInTheDocument());
    });

    it('switches to another run when the URL group id changes', async () => {
      mockOverview({base: {autofix_root_cause: [rootCauseRun]}});
      mockDrawerFor('2');
      const group3Request = mockDrawerFor('3');

      const {router} = renderPage({seerDrawer: '2'});

      expect(
        await screen.findByRole('complementary', {name: 'Seer drawer'})
      ).toBeInTheDocument();
      expect(group3Request).not.toHaveBeenCalled();

      router.navigate(`${basePath}?seerDrawer=3`);

      await waitFor(() => expect(group3Request).toHaveBeenCalled());
      expect(seerDrawer()).toBeInTheDocument();
    });

    it('reopens after another drawer replaces and then closes it', async () => {
      mockDrawerFor('2');

      render(<DrawerHarness />, {
        organization,
        initialRouterConfig: {location: {pathname: basePath, query: {seerDrawer: '2'}}},
      });

      expect(
        await screen.findByRole('complementary', {name: 'Seer drawer'})
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'open other'}));
      expect(
        await screen.findByRole('complementary', {name: 'Other drawer'})
      ).toBeInTheDocument();
      expect(seerDrawer()).not.toBeInTheDocument();

      await userEvent.keyboard('{Escape}');

      expect(
        await screen.findByRole('complementary', {name: 'Seer drawer'})
      ).toBeInTheDocument();
    });
  });

  it('renders All Runs and In Progress tabs with counts', async () => {
    mockOverview({
      base: {
        autofix_root_cause: [{...rootCauseRun, status: 'processing'}],
        autofix_solution: [solutionRun],
      },
    });

    renderPage();

    expect(await screen.findByRole('tab', {name: 'All Runs (2)'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'In Progress (1)'})).toBeInTheDocument();
  });

  it('filters to only in-progress runs when the In Progress tab is selected', async () => {
    mockOverview({
      base: {
        autofix_root_cause: [{...rootCauseRun, status: 'processing'}],
        autofix_solution: [solutionRun],
      },
    });

    renderPage();

    expect(
      await screen.findByRole('button', {name: 'Create Plan 1'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Generate code changes 1'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', {name: 'In Progress (1)'}));

    expect(screen.getByRole('button', {name: 'Create Plan 1'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Generate code changes 1'})
    ).not.toBeInTheDocument();
  });

  it('shows an empty state on the In Progress tab when nothing is processing', async () => {
    mockOverview({base: {autofix_root_cause: [rootCauseRun]}});

    renderPage();

    expect(
      await screen.findByRole('button', {name: 'Create Plan 1'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', {name: 'In Progress (0)'}));

    expect(
      screen.getByText('No Autofix runs are currently in progress.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Create Plan 1'})).not.toBeInTheDocument();
  });

  it('persists the selected tab in the URL', async () => {
    mockOverview({
      base: {
        autofix_root_cause: [{...rootCauseRun, status: 'processing'}],
        autofix_solution: [solutionRun],
      },
    });

    const {router} = renderPage();

    await userEvent.click(await screen.findByRole('tab', {name: 'In Progress (1)'}));
    expect(router.location.query.view).toBe('in_progress');

    await userEvent.click(screen.getByRole('tab', {name: 'All Runs (2)'}));
    expect(router.location.query.view).toBeUndefined();
  });

  it('starts on the In Progress tab when the URL selects it', async () => {
    mockOverview({
      base: {
        autofix_root_cause: [{...rootCauseRun, status: 'processing'}],
        autofix_solution: [solutionRun],
      },
    });

    renderPage({view: 'in_progress'});

    expect(
      await screen.findByRole('button', {name: 'Create Plan 1'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Generate code changes 1'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('tab', {name: 'In Progress (1)', selected: true})
    ).toBeInTheDocument();
  });

  it('shows the empty state while keeping the query controls visible', async () => {
    mockOverview({base: {}});

    renderPage();

    expect(
      await screen.findByText('You don’t have any Autofix runs...yet.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'project-slug'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Autofix Activity 7D'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Sort/})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Create Plan/})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: /Generate code changes/})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Create PR/})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: /Review Open PRs/})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Merged/})).not.toBeInTheDocument();
    expect(screen.queryByText('No issues')).not.toBeInTheDocument();
  });

  it('renders card prose and links from the endpoint payload', async () => {
    mockOverview({
      base: {
        autofix_root_cause: [rootCauseRun],
        autofix_solution: [solutionRun],
      },
    });

    renderPage();

    const titleLink = await screen.findByRole('link', {
      name: 'TypeError in checkout cart',
    });
    expect(titleLink).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/2/`
    );
    expect(screen.getAllByText('TypeError in checkout cart')).toHaveLength(1);

    expect(
      screen.getByText('The cart total is read before it is set.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Restore the Authorization header as a fallback.')
    ).toBeInTheDocument();
    expect(screen.getByText('PROJ-1')).toBeInTheDocument();

    // The root-cause-only run has no plan, so only the solution card carries
    // the plan label.
    expect(screen.getAllByText('Root Cause')).toHaveLength(2);
    expect(screen.getAllByText('Plan')).toHaveLength(1);
  });

  it('renders inline code in root cause and plan summaries', async () => {
    mockOverview({
      base: {
        autofix_solution: [
          {
            ...solutionRun,
            rootCause: {
              oneLineDescription: 'The request is passed to `dateutil.parse()`.',
            },
            proposedFix: {
              oneLineSummary: 'Wrap `parse_date()` in a try/catch.',
            },
          },
        ],
      },
    });

    renderPage();

    await screen.findByRole('link', {name: 'KeyError in proxy handler'});
    expect(screen.getByText('dateutil.parse()').tagName).toBe('CODE');
    expect(screen.getByText('parse_date()').tagName).toBe('CODE');
  });

  it('scopes the request to the selected project', async () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [2]}));
    const {statusPollRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });

    renderPage();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();
    expect(statusPollRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/autofix-overview/`,
      expect.objectContaining({
        query: expect.objectContaining({project: [2]}),
      })
    );
  });

  it('scopes the request to the selected time window', async () => {
    const {statusPollRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });

    render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {
        location: {pathname: basePath, query: {statsPeriod: '7d'}},
      },
    });

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();
    expect(statusPollRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/autofix-overview/`,
      expect.objectContaining({
        query: expect.objectContaining({statsPeriod: '7d'}),
      })
    );
  });

  it('issues a cheap request and an enriched expand request', async () => {
    const {statusPollRequest, enrichedRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });
    // Overview reads everything from the overview endpoint; the legacy
    // per-card endpoints must never be hit.
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
    expect(statusPollRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/autofix-overview/`,
      expect.objectContaining({
        query: expect.objectContaining({expand: ['status']}),
      })
    );
    expect(statusPollRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/autofix-overview/`,
      expect.objectContaining({
        query: expect.not.objectContaining({environment: expect.anything()}),
      })
    );
    await waitFor(() =>
      expect(enrichedRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/seer/autofix-overview/`,
        expect.objectContaining({
          query: expect.objectContaining({expand: ['scmInfo', 'issueStats', 'status']}),
        })
      )
    );
    expect(runsRequest).not.toHaveBeenCalled();
    expect(autofixRequest).not.toHaveBeenCalled();
    expect(issuesRequest).not.toHaveBeenCalled();
  });

  it('shows a step-specific working button that opens Seer for a processing run', async () => {
    mockOverview({
      base: {autofix_root_cause: [{...rootCauseRun, status: 'processing' as const}]},
    });

    renderPage();

    expect(await screen.findByText('Creating Plan…')).toBeInTheDocument();

    const openSeer = screen.getByRole('button', {name: 'Open Seer'});
    expect(openSeer).toHaveAttribute('href', expect.stringContaining('seerDrawer=2'));
  });

  it('falls back to a generic working label for a processing run past code changes', async () => {
    mockOverview({
      base: {has_pull_request: [{...rootCauseRun, status: 'processing' as const}]},
    });

    renderPage();

    expect(await screen.findByText('Working…')).toBeInTheDocument();
  });

  it('shimmers the enriched slots until the expand request resolves', async () => {
    const enriched = deferEnriched();
    mockOverview({
      base: {autofix_root_cause: [unenrichedRootCauseRun]},
      enriched: {autofix_root_cause: [rootCauseRun]},
      enrichedAsyncDelay: enriched.promise,
    });

    renderPage();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('loading-placeholder').length).toBeGreaterThan(0);

    enriched.resolve();

    expect(await screen.findByText('1.2K events')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
  });

  it('stops shimmering when the enriched request fails', async () => {
    mockOverview({
      base: {autofix_root_cause: [unenrichedRootCauseRun]},
      enrichedStatusCode: 500,
    });

    renderPage();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument()
    );
    expect(screen.queryByText(/events/)).not.toBeInTheDocument();
    expect(screen.getByText('PROJ-1')).toBeInTheDocument();
  });

  it('renders the enriched payload when the base request fails', async () => {
    mockOverview({
      base: {},
      enriched: {autofix_root_cause: [rootCauseRun]},
      baseStatusCode: 500,
    });

    renderPage();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();
    expect(
      screen.queryByText('There was an error loading data.')
    ).not.toBeInTheDocument();
  });

  it('keeps the list up with a spinner while a sort change reloads', async () => {
    const {statusPollRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });

    // The events sort returns a different run; hold its enrichment open to keep
    // the reloading state on screen.
    const eventsEnriched = deferEnriched();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      match: [
        MockApiClient.matchQuery({
          sort: 'events',
          expand: ['scmInfo', 'issueStats', 'status'],
        }),
      ],
      asyncDelay: eventsEnriched.promise,
      body: {runsByMilestone: {...emptyMilestones, autofix_solution: [solutionRun]}},
    });

    renderPage();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();
    expect(statusPollRequest).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', {name: /Sort/}));
    await userEvent.click(screen.getByRole('option', {name: 'Most events'}));

    // The status poll refetches for the new sort, but the old list stays up with
    // a spinner (keepPreviousData) while the enriched request reloads.
    expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();
    expect(statusPollRequest).toHaveBeenCalledTimes(2);

    eventsEnriched.resolve();

    expect(
      await screen.findByRole('link', {name: 'KeyError in proxy handler'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'TypeError in checkout cart'})
    ).not.toBeInTheDocument();
  });

  it('renders the changed files of an open pull request', async () => {
    // Without `expand=scmInfo` the endpoint still returns the pull request, but
    // its SCM-sourced fields come back empty.
    const unenrichedPullRequest: OverviewPullRequest = {
      id: '42',
      number: 42,
      url: 'https://github.com/getsentry/sentry/pull/42',
      status: 'open',
      checksStatus: null,
      reviewStatus: null,
      repoName: 'getsentry/sentry',
      files: [],
      failedChecks: [],
    };

    const enriched = deferEnriched();
    mockOverview({
      enrichedAsyncDelay: enriched.promise,
      base: {
        has_pull_request: [{...rootCauseRun, pullRequests: [unenrichedPullRequest]}],
      },
      enriched: {
        has_pull_request: [
          {
            ...rootCauseRun,
            pullRequests: [
              {
                ...unenrichedPullRequest,
                files: [
                  {
                    path: 'src/sentry/foo.py',
                    additions: 10,
                    deletions: 2,
                    changeType: 'MODIFIED',
                  },
                  {
                    path: 'src/sentry/bar.py',
                    additions: 3,
                    deletions: 0,
                    changeType: 'ADDED',
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    renderPage();

    expect(await screen.findByText('PROJ-1')).toBeInTheDocument();

    enriched.resolve();

    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(screen.getByText('src/sentry/foo.py')).toBeInTheDocument();
    expect(screen.getByText('src/sentry/bar.py')).toBeInTheDocument();
    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
  });

  it('falls back to a file count when a pull request has no repo name', async () => {
    const pullRequest: OverviewPullRequest = {
      id: '99',
      number: 99,
      url: 'https://github.com/getsentry/sentry/pull/99',
      status: 'open',
      checksStatus: null,
      reviewStatus: null,
      repoName: null,
      failedChecks: [],
      files: [
        {path: 'src/sentry/foo.py', additions: 1, deletions: 1, changeType: 'MODIFIED'},
        {path: 'src/sentry/bar.py', additions: 2, deletions: 0, changeType: 'ADDED'},
      ],
    };
    mockOverview({
      base: {has_pull_request: [{...rootCauseRun, pullRequests: [pullRequest]}]},
    });

    renderPage();

    expect(await screen.findByText('2 files changed')).toBeInTheDocument();
    expect(screen.getByText('src/sentry/foo.py')).toBeInTheDocument();
    expect(screen.queryByText('getsentry/sentry')).not.toBeInTheDocument();
  });

  it('renders the newest actionable pull request, not the oldest link', async () => {
    const closedPullRequest: OverviewPullRequest = {
      id: '1',
      number: 1,
      url: 'https://github.com/getsentry/sentry/pull/1',
      status: 'closed',
      checksStatus: null,
      reviewStatus: null,
      files: [],
      failedChecks: [],
    };
    // The endpoint enriches open/draft links only, so the actionable PR is the
    // one carrying badges and files.
    const openPullRequest: OverviewPullRequest = {
      id: '2',
      number: 2,
      url: 'https://github.com/getsentry/sentry/pull/2',
      status: 'open',
      checksStatus: 'success',
      reviewStatus: 'approved',
      files: [
        {
          path: 'src/sentry/foo.py',
          additions: 10,
          deletions: 2,
          changeType: 'MODIFIED',
        },
      ],
      failedChecks: [],
    };
    mockOverview({
      base: {
        has_pull_request: [
          {...rootCauseRun, pullRequests: [closedPullRequest, openPullRequest]},
        ],
      },
    });

    renderPage();

    expect(await screen.findByRole('button', {name: /Review PR #2/})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/pull/2'
    );
    expect(screen.queryByRole('button', {name: /Review PR #1/})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Seer'})).toHaveAttribute(
      'href',
      expect.stringContaining('seerDrawer=2')
    );
    const approvedTag = getTagForText('Approved');
    const checksPassingTag = getTagForText('Checks Passing');
    expect(
      approvedTag.compareDocumentPosition(checksPassingTag) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(approvedTag.className).toEqual(checksPassingTag.className);
    expect(screen.getByText('src/sentry/foo.py')).toBeInTheDocument();
  });

  it('renders failure and pending statuses with the configured tags', async () => {
    const failingPullRequest: OverviewPullRequest = {
      ...pullRequestFixture({number: 3, status: 'open'}),
      checksStatus: 'failure',
      reviewStatus: 'changes_requested',
      failedChecks: ['build (3.12)', 'mypy'],
    };
    const pendingPullRequest: OverviewPullRequest = {
      ...pullRequestFixture({number: 4, status: 'open'}),
      checksStatus: 'pending',
      reviewStatus: 'review_required',
    };
    mockOverview({
      base: {
        has_pull_request: [
          {...rootCauseRun, pullRequests: [failingPullRequest]},
          {
            ...rootCauseRun,
            groupId: '3',
            shortId: 'PROJ-2',
            title: 'KeyError in proxy handler',
            seerRunId: 'run-2',
            pullRequests: [pendingPullRequest],
          },
        ],
      },
    });

    renderPage();

    expect(await screen.findByText('Changes Requested')).toBeInTheDocument();
    const changesRequestedTag = getTagForText('Changes Requested');
    const checksFailingTag = getTagForText('2 Checks Failing');
    const checksRunningTag = getTagForText('Checks Running');
    expect(
      changesRequestedTag.compareDocumentPosition(checksFailingTag) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(changesRequestedTag.className).toEqual(checksRunningTag.className);
    expect(checksFailingTag.className).not.toEqual(changesRequestedTag.className);
    expect(screen.queryByText('Checks Failing')).not.toBeInTheDocument();
    expect(screen.queryByText('Review Required')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('2 Checks Failing'));
    expect(await screen.findByText('build (3.12)')).toBeInTheDocument();
    expect(screen.getByText('mypy')).toBeInTheDocument();
  });

  it('uses the singular label for a single failed check', async () => {
    mockOverview({
      base: {
        has_pull_request: [
          {
            ...rootCauseRun,
            pullRequests: [
              {
                ...pullRequestFixture({number: 3, status: 'open'}),
                checksStatus: 'failure',
                failedChecks: ['mypy'],
              },
            ],
          },
        ],
      },
    });

    renderPage();

    expect(await screen.findByText('1 Check Failing')).toBeInTheDocument();
  });

  it('falls back to the plain failing label when a failing PR omits failedChecks', async () => {
    // The field is absent until the backend deploys; the failing tag must fall
    // back to the plain label rather than reading .length of undefined.
    const {failedChecks: _omitted, ...withoutFailedChecks} = {
      ...pullRequestFixture({number: 3, status: 'open'}),
      checksStatus: 'failure' as const,
    };
    mockOverview({
      base: {
        has_pull_request: [{...rootCauseRun, pullRequests: [withoutFailedChecks]}],
      },
    });

    renderPage();

    expect(await screen.findByText('Checks Failing')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ Checks? Failing$/)).not.toBeInTheDocument();
  });

  it('renders a draft pull request as the actionable one', async () => {
    mockOverview({
      base: {
        has_pull_request: [
          {
            ...rootCauseRun,
            pullRequests: [
              pullRequestFixture({number: 7, status: 'draft'}),
              pullRequestFixture({number: 9, status: 'closed'}),
            ],
          },
        ],
      },
    });

    renderPage();

    expect(await screen.findByRole('button', {name: /Review PR #7/})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/pull/7'
    );
    expect(screen.queryByRole('button', {name: /Review PR #9/})).not.toBeInTheDocument();
  });

  it('falls back to the newest link when no pull request is actionable', async () => {
    mockOverview({
      base: {
        has_pull_request: [
          {
            ...rootCauseRun,
            pullRequests: [
              pullRequestFixture({number: 1, status: 'merged'}),
              pullRequestFixture({number: 5, status: 'closed'}),
            ],
          },
        ],
      },
    });

    renderPage();

    expect(await screen.findByRole('button', {name: /Review PR #5/})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/pull/5'
    );
    expect(screen.queryByRole('button', {name: /Review PR #1/})).not.toBeInTheDocument();
  });

  it('renders a Seer button alongside a merged pull request', async () => {
    mockOverview({
      base: {
        pull_requests_merged: [
          {
            ...rootCauseRun,
            pullRequests: [pullRequestFixture({number: 8, status: 'merged'})],
          },
        ],
      },
    });

    renderPage();

    expect(await screen.findByRole('button', {name: /Merged #8/})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/pull/8'
    );
    expect(screen.getByRole('button', {name: 'Open Seer'})).toHaveAttribute(
      'href',
      expect.stringContaining('seerDrawer=2')
    );
  });

  it('labels non-modified files with their change type', async () => {
    mockOverview({
      base: {
        has_pull_request: [
          {
            ...rootCauseRun,
            pullRequests: [
              {
                id: '42',
                number: 42,
                url: 'https://github.com/getsentry/sentry/pull/42',
                status: 'open',
                checksStatus: null,
                reviewStatus: null,
                failedChecks: [],
                files: [
                  {
                    path: 'src/sentry/new.py',
                    additions: 12,
                    deletions: 0,
                    changeType: 'ADDED',
                  },
                  {
                    path: 'src/sentry/gone.py',
                    additions: 0,
                    deletions: 30,
                    changeType: 'DELETED',
                  },
                  {
                    path: 'src/sentry/kept.py',
                    additions: 1,
                    deletions: 1,
                    changeType: 'MODIFIED',
                  },
                  {
                    path: 'src/sentry/moved.py',
                    additions: 0,
                    deletions: 0,
                    changeType: 'RENAMED',
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    renderPage();

    expect(await screen.findByText('src/sentry/new.py')).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('Deleted')).toBeInTheDocument();
    expect(screen.getByText('Renamed')).toBeInTheDocument();
    expect(screen.queryByText('Modified')).not.toBeInTheDocument();
    expect(screen.getByText('+12')).toBeInTheDocument();
    expect(screen.getByText('-30')).toBeInTheDocument();

    // Added and deleted keep their own color, while other non-modified states
    // use the muted label.
    const tagClassName = (label: string) =>
      screen.getByText(label).closest('[data-test-id="tag-background"]')?.className;
    expect(tagClassName('Added')).not.toEqual(tagClassName('Deleted'));
    expect(tagClassName('Added')).not.toEqual(tagClassName('Renamed'));
    expect(tagClassName('Deleted')).not.toEqual(tagClassName('Renamed'));
  });

  it('renders a file with an unknown change type without a tag', async () => {
    mockOverview({
      base: {
        has_pull_request: [
          {
            ...rootCauseRun,
            pullRequests: [
              {
                id: '42',
                number: 42,
                url: 'https://github.com/getsentry/sentry/pull/42',
                status: 'open',
                checksStatus: null,
                reviewStatus: null,
                failedChecks: [],
                files: [
                  {
                    path: 'src/sentry/mystery.py',
                    additions: 4,
                    deletions: 4,
                    changeType: null,
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    renderPage();

    const fileToggle = await screen.findByRole('button', {
      name: /src\/sentry\/mystery\.py/,
    });
    const fileRow = fileToggle.closest<HTMLElement>('[data-disclosure]')!;

    expect(within(fileRow).getByText('+4')).toBeInTheDocument();
    expect(within(fileRow).queryByTestId('tag-background')).not.toBeInTheDocument();
  });

  it('fetches all PR files and renders a diff when a file is expanded', async () => {
    mockOverview({
      base: {
        has_pull_request: [
          {
            ...rootCauseRun,
            pullRequests: [
              {
                id: '77',
                number: 42,
                url: 'https://github.com/getsentry/sentry/pull/42',
                status: 'open',
                checksStatus: null,
                reviewStatus: null,
                failedChecks: [],
                files: [
                  {
                    path: 'src/sentry/foo.py',
                    additions: 2,
                    deletions: 1,
                    changeType: 'MODIFIED',
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const filesRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/pull-requests/77/files/`,
      body: {
        files: [
          {
            path: 'src/sentry/foo.py',
            patch: '@@ -1,2 +1,3 @@\n keep\n-drop\n+addedone\n+addedtwo',
          },
        ],
      },
    });

    renderPage();

    const fileToggle = await screen.findByRole('button', {name: /src\/sentry\/foo\.py/});
    // The diff endpoint is only hit once the user expands a file.
    expect(filesRequest).not.toHaveBeenCalled();

    await userEvent.click(fileToggle);

    await waitFor(() => expect(filesRequest).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('addedone')).toBeInTheDocument();
    // The diff viewer must not repeat the file path/stats header we already
    // render in the row title.
    expect(screen.getAllByText('src/sentry/foo.py')).toHaveLength(1);
  });

  it('renders the deleted-file view when a deleted file has no patch', async () => {
    mockOverview({
      base: {
        has_pull_request: [
          {
            ...rootCauseRun,
            pullRequests: [
              {
                id: '77',
                number: 42,
                url: 'https://github.com/getsentry/sentry/pull/42',
                status: 'open',
                checksStatus: null,
                reviewStatus: null,
                failedChecks: [],
                files: [
                  {
                    path: 'src/sentry/gone.py',
                    additions: 0,
                    deletions: 9,
                    changeType: 'DELETED',
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/pull-requests/77/files/`,
      body: {files: [{path: 'src/sentry/gone.py', patch: null}]},
    });

    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: /src\/sentry\/gone\.py/})
    );

    expect(await screen.findByText('This file will be deleted.')).toBeInTheDocument();
    expect(screen.queryByText('No diff available.')).not.toBeInTheDocument();
  });

  it('renders generated code changes for the Create PR step', async () => {
    const codeChangesRun = {
      ...rootCauseRun,
      codeChanges: [
        {
          repoName: 'getsentry/sentry',
          patch: {
            path: 'src/sentry/foo.py',
            source_file: 'src/sentry/foo.py',
            target_file: 'src/sentry/foo.py',
            type: DiffFileType.MODIFIED,
            added: 1,
            removed: 1,
            hunks: [
              {
                source_start: 1,
                source_length: 1,
                target_start: 1,
                target_length: 1,
                section_header: '',
                lines: [
                  {
                    line_type: DiffLineType.REMOVED,
                    value: 'old',
                    source_line_no: 1,
                    target_line_no: null,
                    diff_line_no: 1,
                  },
                  {
                    line_type: DiffLineType.ADDED,
                    value: 'new',
                    source_line_no: null,
                    target_line_no: 1,
                    diff_line_no: 2,
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    mockOverview({base: {autofix_code_changes: [codeChangesRun]}});

    renderPage();

    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    // The generated diff comes back inline, so expanding needs no extra request.
    await userEvent.click(
      await screen.findByRole('button', {name: /src\/sentry\/foo\.py/})
    );
    expect(await screen.findByText('new')).toBeInTheDocument();
  });

  it('renders a Create PR step run whose code changes are absent', async () => {
    mockOverview({base: {autofix_code_changes: [rootCauseRun]}});

    renderPage();

    expect(await screen.findByText('TypeError in checkout cart')).toBeInTheDocument();
    expect(screen.queryByText('Code Changes')).not.toBeInTheDocument();
  });

  it('defaults to Recent Seer Activity and omits the sort param', async () => {
    const {statusPollRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });

    renderPage();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Sort/})).toHaveTextContent(
      'Recent Seer Activity'
    );
    expect(statusPollRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/autofix-overview/`,
      expect.objectContaining({
        query: expect.not.objectContaining({sort: expect.anything()}),
      })
    );
  });

  // A sort change refetches only the enriched request, not the base bootstrap.
  it.each([
    {option: 'Most events', sort: 'events'},
    {option: 'Recent Issue Activity', sort: 'issue'},
    {option: 'Most users', sort: 'users'},
  ])('sends the $sort sort to the endpoint and URL', async ({option, sort}) => {
    const {enrichedRequest} = mockOverview({base: {autofix_root_cause: [rootCauseRun]}});

    const {router} = renderPage();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /Sort/}));
    await userEvent.click(screen.getByRole('option', {name: option}));

    await waitFor(() =>
      expect(enrichedRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/seer/autofix-overview/`,
        expect.objectContaining({
          query: expect.objectContaining({sort}),
        })
      )
    );
    expect(router.location.query.sort).toBe(sort);
  });

  describe('assignee filter', () => {
    const jane: Actor = {type: 'user', id: '7', name: 'Jane Doe', email: ''};
    const assignedRun = {
      ...rootCauseRun,
      issue: issueFixture({assignedTo: jane, count: '1200', userCount: 5}),
    };

    it('derives options with counts and filters sections via the URL', async () => {
      const {enrichedRequest} = mockOverview({
        base: {autofix_root_cause: [assignedRun], autofix_solution: [solutionRun]},
      });

      const {router} = renderPage();
      await screen.findByRole('button', {name: 'Generate code changes 1'});

      await userEvent.click(screen.getByRole('button', {name: /Assignee/}));

      const janeOption = await screen.findByRole('option', {name: /Jane Doe/});
      expect(within(janeOption).getByText('1')).toBeInTheDocument();
      const unassignedOption = screen.getByRole('option', {name: /Unassigned/});
      expect(within(unassignedOption).getByText('1')).toBeInTheDocument();

      await userEvent.click(janeOption);

      expect(
        await screen.findByRole('button', {name: 'Create Plan 1'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /Generate code changes/})
      ).not.toBeInTheDocument();
      expect(router.location.query.assignee).toBe('user:7');
      expect(enrichedRequest).toHaveBeenCalledTimes(1);
    });

    it('shows a filtered empty state when no runs match the assignee', async () => {
      mockOverview({base: {autofix_root_cause: [assignedRun]}});

      renderPage({assignee: 'user:999'});

      expect(
        await screen.findByText('No Autofix runs match the selected assignee.')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('You don’t have any Autofix runs...yet.')
      ).not.toBeInTheDocument();
      // No tabs above the message when the filter matches nothing to switch between.
      expect(screen.queryByRole('tab', {name: /All Runs/})).not.toBeInTheDocument();
    });

    it('shows a truncation notice when the backend caps a section', async () => {
      mockOverview({
        base: {autofix_root_cause: [assignedRun]},
        truncated: ['autofix_root_cause'],
      });

      renderPage();

      expect(
        await screen.findByText(
          'Some sections show only their most recent runs, so assignee options and counts may be incomplete.'
        )
      ).toBeInTheDocument();
    });

    it('formats team assignees with a # prefix', async () => {
      const squad: Actor = {type: 'team', id: '9', name: 'squad'};
      mockOverview({
        base: {
          autofix_root_cause: [
            {...rootCauseRun, issue: issueFixture({assignedTo: squad})},
          ],
        },
      });

      renderPage();
      await screen.findByRole('button', {name: 'Create Plan 1'});

      await userEvent.click(screen.getByRole('button', {name: /Assignee/}));

      expect(await screen.findByRole('option', {name: /#squad/})).toBeInTheDocument();
    });

    it('clears the filter and restores all sections', async () => {
      mockOverview({
        base: {autofix_root_cause: [assignedRun], autofix_solution: [solutionRun]},
      });

      const {router} = renderPage({assignee: 'user:7'});
      await screen.findByRole('button', {name: 'Create Plan 1'});
      expect(
        screen.queryByRole('button', {name: /Generate code changes/})
      ).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: /Assignee/}));
      await userEvent.click(await screen.findByRole('button', {name: 'Clear'}));

      expect(
        await screen.findByRole('button', {name: 'Generate code changes 1'})
      ).toBeInTheDocument();
      expect(router.location.query.assignee).toBeUndefined();
    });

    it('adds a newly assigned user to the filter options', async () => {
      const nextAssignee = UserFixture({id: '42', name: 'Next Assignee'});
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/users/`,
        body: [MemberFixture({user: nextAssignee})],
      });
      mockOverview({base: {autofix_root_cause: [rootCauseRun]}});
      const assignRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${rootCauseRun.groupId}/`,
        method: 'PUT',
        body: {
          ...GroupFixture({id: rootCauseRun.groupId}),
          assignedTo: {id: nextAssignee.id, name: nextAssignee.name, type: 'user'},
        },
      });

      renderPage();
      await screen.findByRole('button', {name: 'Create Plan 1'});

      await userEvent.click(screen.getByRole('button', {name: 'Modify issue assignee'}));
      await userEvent.click(await screen.findByRole('option', {name: /Next Assignee/}));
      await waitFor(() => expect(assignRequest).toHaveBeenCalled());

      await userEvent.click(screen.getByRole('button', {name: /Assignee/}));
      const newOption = await screen.findByRole('option', {name: /Next Assignee/});
      expect(within(newOption).getByText('1')).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: /Unassigned/})).not.toBeInTheDocument();
    });
  });

  it('shows an error state when the request fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      statusCode: 500,
      body: {detail: 'boom'},
    });

    renderPage();

    // Error waits for the enriched request (retry: 1) to also fail.
    expect(
      await screen.findByText('There was an error loading data.', undefined, {
        timeout: 5000,
      })
    ).toBeInTheDocument();
  });

  it('replaces the overview content when the org is eligible for Seer but has not purchased it', () => {
    const {statusPollRequest, enrichedRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });

    render(<AutofixOverview />, {
      organization: OrganizationFixture({
        features: ['seer-night-shift-ui', 'seer-user-billing-launch'],
      }),
      initialRouterConfig: {location: {pathname: basePath}},
    });

    expect(screen.getByText('Autofix Overview')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Sort/})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Create Plan/})).not.toBeInTheDocument();
    expect(statusPollRequest).not.toHaveBeenCalled();
    expect(enrichedRequest).not.toHaveBeenCalled();
  });

  it('renders the overview normally when the org has seat-based Seer', async () => {
    mockOverview({base: {autofix_root_cause: [rootCauseRun]}});

    render(<AutofixOverview />, {
      organization: OrganizationFixture({
        features: ['seer-night-shift-ui', 'seat-based-seer-enabled'],
      }),
      initialRouterConfig: {location: {pathname: basePath}},
    });

    expect(
      await screen.findByRole('button', {name: 'Create Plan 1'})
    ).toBeInTheDocument();
  });
});
