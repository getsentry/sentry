import {GroupFixture} from 'sentry-fixture/group';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {useDrawer} from '@sentry/scraps/drawer';

import {DiffFileType, DiffLineType} from 'sentry/components/events/autofix/types';
import {
  getPageFilterStorage,
  setPageFiltersStorage,
} from 'sentry/components/pageFilters/persistence';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {Actor} from 'sentry/types/core';
import type {PullRequestStatus} from 'sentry/types/integrations';
import AutofixOverview from 'sentry/views/seerWorkflows/overview';
import type {
  AutofixOverviewResponse,
  OverviewPullRequest,
  OverviewRunIssue,
} from 'sentry/views/seerWorkflows/overview/types';
import {SCM_WINDOW_SIZE} from 'sentry/views/seerWorkflows/overview/types';
import {useOverviewSeerDrawer} from 'sentry/views/seerWorkflows/overview/useOverviewSeerDrawer';

describe('AutofixOverview', () => {
  const organization = OrganizationFixture({
    features: ['seer-night-shift-ui', 'gen-ai-features'],
  });
  const basePath = `/organizations/${organization.slug}/issues/autofix/`;

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
    };
  }

  const rootCauseRun = {
    groupId: '2',
    shortId: 'PROJ-1',
    title: 'TypeError in checkout cart',
    rootCause: {
      headline: null,
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
    rootCause: {
      headline: null,
      oneLineDescription: 'The Authorization header is dropped.',
    },
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
    baseStatusCode,
    truncated,
    projectConfig,
    projectConfigAsyncDelay,
    issueStatsAsyncDelay,
    issueStatsStatusCode,
    scmInfo,
    scmInfoStatusCode,
    scmInfoAsyncDelay,
  }: {
    base: Partial<AutofixOverviewResponse['runsByMilestone']>;
    baseStatusCode?: number;
    issueStatsAsyncDelay?: number | Promise<void>;
    issueStatsStatusCode?: number;
    projectConfig?: AutofixOverviewResponse['projectConfig'];
    projectConfigAsyncDelay?: number | Promise<void>;
    scmInfo?: Record<string, {pullRequests: OverviewPullRequest[]}>;
    scmInfoAsyncDelay?: number | Promise<void>;
    scmInfoStatusCode?: number;
    truncated?: AutofixOverviewResponse['truncatedMilestones'];
  }) {
    const overviewBody = {
      runsByMilestone: {...emptyMilestones, ...base},
      truncatedMilestones: truncated ?? [],
    };
    const statusPollRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      match: [MockApiClient.matchQuery({expand: ['status']})],
      statusCode: baseStatusCode,
      body: overviewBody,
    });
    const issueStatsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      match: [MockApiClient.matchQuery({expand: ['issueStats']})],
      asyncDelay: issueStatsAsyncDelay,
      statusCode: issueStatsStatusCode,
      body: overviewBody,
    });
    const projectConfigRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      match: [MockApiClient.matchQuery({expand: ['projectConfig']})],
      asyncDelay: projectConfigAsyncDelay,
      body: {
        ...overviewBody,
        ...(projectConfig ? {projectConfig} : {}),
      },
    });
    const scmInfoRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-scm-info/`,
      asyncDelay: scmInfoAsyncDelay,
      statusCode: scmInfoStatusCode,
      body: {scmInfoByRunId: scmInfo ?? {}},
    });
    return {statusPollRequest, issueStatsRequest, projectConfigRequest, scmInfoRequest};
  }

  function deferredResponse() {
    let resolve!: () => void;
    const promise = new Promise<void>(r => {
      resolve = r;
    });
    return {promise, resolve};
  }

  // Flush pending microtasks so already-resolved mock responses apply and render.
  async function tick() {
    await Promise.resolve();
    await Promise.resolve();
  }

  const originalIntersectionObserver = window.IntersectionObserver;
  function makeCardsVisible({
    deferred = false,
    onlyMatching,
  }: {deferred?: boolean; onlyMatching?: string} = {}) {
    class VisibleObserver {
      root = null;
      rootMargin = '';
      thresholds = [];
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        const isIntersecting =
          !onlyMatching || (target.textContent ?? '').includes(onlyMatching);
        const fire = () =>
          this.callback(
            [{isIntersecting, target} as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          );
        if (deferred) {
          setTimeout(fire, 0);
        } else {
          fire();
        }
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    window.IntersectionObserver =
      VisibleObserver as unknown as typeof IntersectionObserver;
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

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver;
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
    const {statusPollRequest, scmInfoRequest} = mockOverview({
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
    expect(scmInfoRequest).not.toHaveBeenCalled();
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

  it('batches project member fetches into a single request across projects', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '2', slug: 'project-slug'}),
      ProjectFixture({id: '3', slug: 'other-project'}),
    ]);
    const runOne = {
      ...rootCauseRun,
      groupId: '2',
      seerRunId: 'run-1',
      title: 'First project issue',
      issue: issueFixture({project: {id: '2', slug: 'project-slug', platform: 'python'}}),
    };
    const runTwo = {
      ...rootCauseRun,
      groupId: '3',
      seerRunId: 'run-2',
      title: 'Second project issue',
      issue: issueFixture({
        project: {id: '3', slug: 'other-project', platform: 'python'},
      }),
    };
    mockOverview({base: {autofix_root_cause: [runOne, runTwo]}});
    const usersMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });

    renderPage();

    expect(await screen.findByText('First project issue')).toBeInTheDocument();
    expect(await screen.findByText('Second project issue')).toBeInTheDocument();

    // Both visible projects should be fetched in one batched request, not one
    // request per project.
    await waitFor(() =>
      expect(usersMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/users/`,
        expect.objectContaining({
          query: expect.objectContaining({project: expect.arrayContaining(['2', '3'])}),
        })
      )
    );
    expect(usersMock).toHaveBeenCalledTimes(1);
  });

  it('refetches the overview after a card action is dispatched', async () => {
    const {statusPollRequest} = mockOverview({
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
    await waitFor(() => expect(statusPollRequest).toHaveBeenCalledTimes(2));
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
    const {statusPollRequest} = mockOverview({
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
    expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
    expect(statusPollRequest).toHaveBeenCalledTimes(1);
  });

  it('keeps the page-local activity window through param navigation instead of resetting it', async () => {
    const {statusPollRequest} = mockOverview({
      base: {autofix_root_cause: [{...rootCauseRun, status: 'processing'}]},
    });

    const {router} = renderPage({activityStatsPeriod: '30d'});

    await screen.findByRole('tab', {name: /All Runs/});
    expect(
      screen.getByRole('button', {name: 'Autofix Activity 30D'})
    ).toBeInTheDocument();
    const requestsBeforeClick = statusPollRequest.mock.calls.length;

    await userEvent.click(screen.getByRole('tab', {name: /In Progress/}));

    expect(router.location.query.view).toBe('in_progress');
    expect(router.location.query.activityStatsPeriod).toBe('30d');
    expect(
      screen.getByRole('button', {name: 'Autofix Activity 30D'})
    ).toBeInTheDocument();
    expect(statusPollRequest).toHaveBeenCalledTimes(requestsBeforeClick);
  });

  it('defaults to the last 7 days and ignores a globally pinned time window', async () => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({datetime: {period: '30d', start: null, end: null, utc: null}})
    );
    setPageFiltersStorage(organization.slug, new Set(['datetime']));
    const {statusPollRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });

    renderPage();

    expect(
      await screen.findByRole('button', {name: 'Autofix Activity 7D'})
    ).toBeInTheDocument();
    expect(statusPollRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/autofix-overview/`,
      expect.objectContaining({
        query: expect.objectContaining({statsPeriod: '7d'}),
      })
    );
  });

  it('writes only the page-local param and leaves global page filters untouched', async () => {
    mockOverview({base: {autofix_root_cause: [rootCauseRun]}});

    const {router} = renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Autofix Activity 7D'})
    );
    await userEvent.click(await screen.findByRole('option', {name: 'Last 24 hours'}));

    await waitFor(() => expect(router.location.query.activityStatsPeriod).toBe('24h'));
    expect(router.location.query.statsPeriod).not.toBe('24h');
    expect(PageFiltersStore.getState().selection.datetime.period).not.toBe('24h');
    expect(getPageFilterStorage(organization.slug).pinnedFilters.has('datetime')).toBe(
      false
    );
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

    expect(await screen.findByText('No Autofix runs')).toBeInTheDocument();
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

  it('offers activity periods up to 30 days but not 90 days', async () => {
    mockOverview({base: {}});

    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Autofix Activity 7D'})
    );

    expect(await screen.findByRole('option', {name: 'Last 30 days'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Last 90 days'})).not.toBeInTheDocument();
  });

  it('keeps a stale 90-day selection valid on the trigger', async () => {
    mockOverview({base: {}});

    renderPage({activityStatsPeriod: '90d'});

    expect(
      await screen.findByRole('button', {name: 'Autofix Activity 90D'})
    ).toBeInTheDocument();
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

  it('uses the root cause headline as the card title with the issue title beneath', async () => {
    mockOverview({
      base: {
        autofix_root_cause: [
          {
            ...rootCauseRun,
            rootCause: {
              headline: 'Checkout crashes on an empty cart',
              oneLineDescription: 'The cart total is read before it is set.',
            },
          },
        ],
      },
    });

    renderPage();

    // The generated headline becomes the linked card title.
    const titleLink = await screen.findByRole('link', {
      name: 'Checkout crashes on an empty cart',
    });
    expect(titleLink).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/2/`
    );
    // The raw issue title still shows, beneath the headline.
    expect(screen.getByText('TypeError in checkout cart')).toBeInTheDocument();
    // The issue title is not itself a link (only the headline links out).
    expect(
      screen.queryByRole('link', {name: 'TypeError in checkout cart'})
    ).not.toBeInTheDocument();
  });

  it('shows "0 users" for a card with events but zero affected users', async () => {
    mockOverview({
      base: {
        autofix_root_cause: [
          {...rootCauseRun, issue: issueFixture({count: '1200', userCount: 0})},
        ],
      },
    });

    renderPage();

    expect(await screen.findByText('0 users')).toBeInTheDocument();
    expect(screen.getByText('1.2K events')).toBeInTheDocument();
  });

  it('omits the users datapoint when the stat is unavailable', async () => {
    mockOverview({
      base: {
        autofix_root_cause: [
          {...rootCauseRun, issue: issueFixture({count: '1200', userCount: null})},
        ],
      },
    });

    renderPage();

    expect(await screen.findByText('1.2K events')).toBeInTheDocument();
    expect(screen.queryByText('0 users')).not.toBeInTheDocument();
  });

  it('holds the skeleton until the issueStats call resolves, then shows vitals', async () => {
    const issueStats = deferredResponse();
    const {statusPollRequest, projectConfigRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
      issueStatsAsyncDelay: issueStats.promise,
    });

    renderPage();

    // Let the status + projectConfig responses land and render; only the vitals
    // stay pending. Cards must not paint yet, so events/users never shimmer.
    await waitFor(() => expect(statusPollRequest).toHaveBeenCalled());
    await waitFor(() => expect(projectConfigRequest).toHaveBeenCalled());
    await act(tick);
    expect(screen.queryByText('TypeError in checkout cart')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('loading-placeholder').length).toBeGreaterThan(0);

    issueStats.resolve();

    expect(await screen.findByText('TypeError in checkout cart')).toBeInTheDocument();
    expect(screen.getByText('1.2K events')).toBeInTheDocument();
    expect(screen.getByText('5 users')).toBeInTheDocument();
  });

  it('shows the cards when the issueStats call fails instead of blocking forever', async () => {
    mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
      issueStatsStatusCode: 500,
    });

    renderPage();

    // A failed vitals call must not withhold the cards forever; once the query
    // settles (after its one retry) the cards render. The timeout covers the
    // issueStats retry backoff.
    expect(
      await screen.findByText('TypeError in checkout cart', undefined, {timeout: 5000})
    ).toBeInTheDocument();
  });

  it('fetches the vitals once for a stable run set, without looping', async () => {
    const {issueStatsRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });

    renderPage();

    expect(await screen.findByText('1.2K events')).toBeInTheDocument();
    expect(issueStatsRequest).toHaveBeenCalledTimes(1);
  });

  it('renders inline code in root cause and plan summaries', async () => {
    mockOverview({
      base: {
        autofix_solution: [
          {
            ...solutionRun,
            rootCause: {
              headline: null,
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

  it('scopes the request to the page-local activity window', async () => {
    const {statusPollRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });

    render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {
        location: {pathname: basePath, query: {activityStatsPeriod: '24h'}},
      },
    });

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();
    expect(statusPollRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/autofix-overview/`,
      expect.objectContaining({
        query: expect.objectContaining({statsPeriod: '24h'}),
      })
    );
  });

  it('scopes the request to an absolute page-local activity window', async () => {
    const {statusPollRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });

    render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: basePath,
          query: {
            activityStart: '2026-07-01T00:00:00',
            activityEnd: '2026-07-08T00:00:00',
          },
        },
      },
    });

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();
    expect(statusPollRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/autofix-overview/`,
      expect.objectContaining({
        query: expect.objectContaining({
          start: expect.stringContaining('2026-07-01T00:00:00'),
          end: expect.stringContaining('2026-07-08T00:00:00'),
        }),
      })
    );
  });

  it('polls status only and fetches Snuba vitals off the hot path', async () => {
    const {statusPollRequest, issueStatsRequest, scmInfoRequest} = mockOverview({
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
    expect(issueStatsRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/autofix-overview/`,
      expect.objectContaining({
        query: expect.objectContaining({expand: ['issueStats']}),
      })
    );
    expect(statusPollRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/autofix-overview/`,
      expect.objectContaining({
        query: expect.not.objectContaining({environment: expect.anything()}),
      })
    );
    expect(scmInfoRequest).not.toHaveBeenCalled();
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

  it('windows scm-info for a visible PR card and shimmers until it resolves', async () => {
    makeCardsVisible();
    const scmInfo = deferredResponse();
    const basePullRequest: OverviewPullRequest = {
      id: '42',
      number: 42,
      url: 'https://github.com/getsentry/sentry/pull/42',
      status: 'open',
      checksStatus: null,
      reviewStatus: null,
      repoName: 'getsentry/sentry',
      files: [],
    };
    const {scmInfoRequest} = mockOverview({
      base: {has_pull_request: [{...rootCauseRun, pullRequests: [basePullRequest]}]},
      scmInfoAsyncDelay: scmInfo.promise,
      scmInfo: {
        'run-1': {
          pullRequests: [
            {
              ...basePullRequest,
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
            },
          ],
        },
      },
    });

    renderPage();

    expect(
      await screen.findByRole('button', {name: /Review PR #42/})
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('loading-placeholder').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(scmInfoRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/seer/autofix-scm-info/`,
        expect.objectContaining({query: expect.objectContaining({runIds: ['run-1']})})
      )
    );

    scmInfo.resolve();

    expect(await screen.findByText('Checks Passing')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('getsentry/sentry')).toBeInTheDocument();
    expect(screen.getByText('src/sentry/foo.py')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
  });

  it('shimmers an un-enriched PR card from first paint, before it is observed', async () => {
    const {scmInfoRequest} = mockOverview({
      base: {
        has_pull_request: [
          {
            ...rootCauseRun,
            pullRequests: [pullRequestFixture({number: 42, status: 'open'})],
          },
        ],
      },
    });

    renderPage();

    expect(
      await screen.findByRole('button', {name: /Review PR #42/})
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('loading-placeholder').length).toBeGreaterThan(0);
    expect(scmInfoRequest).not.toHaveBeenCalled();
  });

  it('scopes the scm-info window request to the selected project', async () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [2]}));
    makeCardsVisible();
    const {scmInfoRequest} = mockOverview({
      base: {
        has_pull_request: [
          {
            ...rootCauseRun,
            pullRequests: [pullRequestFixture({number: 42, status: 'open'})],
          },
        ],
      },
    });

    renderPage();

    expect(
      await screen.findByRole('button', {name: /Review PR #42/})
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(scmInfoRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/seer/autofix-scm-info/`,
        expect.objectContaining({
          query: expect.objectContaining({project: [2], runIds: ['run-1']}),
        })
      )
    );
  });

  const windowedRuns = (count: number) =>
    Array.from({length: count}, (_, i) => ({
      ...rootCauseRun,
      groupId: String(100 + i),
      seerRunId: `run-${i}`,
      title: `Windowed run ${i}`,
      pullRequests: [pullRequestFixture({number: 100 + i, status: 'open'})],
    }));

  it('prefetches the next window when only the first card is visible', async () => {
    makeCardsVisible({onlyMatching: 'Windowed run 0'});
    const runCount = SCM_WINDOW_SIZE * 2;
    const {scmInfoRequest} = mockOverview({
      base: {has_pull_request: windowedRuns(runCount)},
    });

    renderPage();

    expect(await screen.findByText('Windowed run 0')).toBeInTheDocument();

    await waitFor(() => expect(scmInfoRequest).toHaveBeenCalledTimes(2));
    const windows = scmInfoRequest.mock.calls.map(
      ([, options]: [string, {query: {runIds: string[]}}]) => options.query.runIds
    );
    expect(windows.map(ids => ids.length)).toEqual([SCM_WINDOW_SIZE, SCM_WINDOW_SIZE]);
    const requestedIds = windows.flat();
    expect(new Set(requestedIds)).toEqual(
      new Set(Array.from({length: runCount}, (_, i) => `run-${i}`))
    );
  });

  it('partitions PR cards into disjoint windows of SCM_WINDOW_SIZE', async () => {
    makeCardsVisible({deferred: true});
    const runCount = SCM_WINDOW_SIZE * 2 + 1;
    const {scmInfoRequest} = mockOverview({
      base: {has_pull_request: windowedRuns(runCount)},
    });

    renderPage();

    expect(await screen.findByText('Windowed run 0')).toBeInTheDocument();

    await waitFor(() => expect(scmInfoRequest).toHaveBeenCalledTimes(3));
    const windows = scmInfoRequest.mock.calls.map(
      ([, options]: [string, {query: {runIds: string[]}}]) => options.query.runIds
    );
    expect(windows.map(ids => ids.length).sort((a, b) => b - a)).toEqual([
      SCM_WINDOW_SIZE,
      SCM_WINDOW_SIZE,
      1,
    ]);
    const requestedIds = windows.flat();
    expect(requestedIds).toHaveLength(runCount);
    expect(new Set(requestedIds).size).toBe(runCount);
  });

  it('re-windows scm-info for cards reshown after a sort change', async () => {
    makeCardsVisible();
    const prRun = {
      ...rootCauseRun,
      pullRequests: [pullRequestFixture({number: 42, status: 'open'})],
    };
    const {scmInfoRequest} = mockOverview({base: {has_pull_request: [prRun]}});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      match: [MockApiClient.matchQuery({sort: 'events'})],
      body: {
        runsByMilestone: {...emptyMilestones, has_pull_request: [prRun]},
        truncatedMilestones: [],
      },
    });

    renderPage();

    expect(
      await screen.findByRole('button', {name: /Review PR #42/})
    ).toBeInTheDocument();
    await waitFor(() => expect(scmInfoRequest).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', {name: /Sort/}));
    await userEvent.click(screen.getByRole('option', {name: 'Most events'}));

    await waitFor(() => expect(scmInfoRequest).toHaveBeenCalledTimes(2));
  });

  it('degrades a visible PR card gracefully when scm-info fails', async () => {
    makeCardsVisible();
    const basePullRequest: OverviewPullRequest = {
      id: '42',
      number: 42,
      url: 'https://github.com/getsentry/sentry/pull/42',
      status: 'open',
      checksStatus: null,
      reviewStatus: null,
      files: [],
    };
    const {scmInfoRequest} = mockOverview({
      base: {has_pull_request: [{...rootCauseRun, pullRequests: [basePullRequest]}]},
      scmInfoStatusCode: 500,
    });

    renderPage();

    expect(
      await screen.findByRole('button', {name: /Review PR #42/})
    ).toBeInTheDocument();
    await waitFor(() => expect(scmInfoRequest).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument()
    );
    expect(screen.queryByText('Checks Passing')).not.toBeInTheDocument();
  });

  it('shows the skeleton while a sort change reloads', async () => {
    mockOverview({base: {autofix_root_cause: [rootCauseRun]}});

    // A sort change is a new scope, so previous data is dropped instead of held.
    // Hold the events-sorted response open to keep the skeleton on screen.
    const events = deferredResponse();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      match: [MockApiClient.matchQuery({sort: 'events'})],
      asyncDelay: events.promise,
      body: {runsByMilestone: {...emptyMilestones, autofix_solution: [solutionRun]}},
    });

    renderPage();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /Sort/}));
    await userEvent.click(screen.getByRole('option', {name: 'Most events'}));

    // The old list drops out and the skeleton shows while the reordered results
    // load — matching a project or date change.
    expect((await screen.findAllByTestId('loading-placeholder')).length).toBeGreaterThan(
      0
    );
    expect(
      screen.queryByRole('link', {name: 'TypeError in checkout cart'})
    ).not.toBeInTheDocument();

    events.resolve();

    expect(
      await screen.findByRole('link', {name: 'KeyError in proxy handler'})
    ).toBeInTheDocument();
    expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
  });

  it('shows the skeleton again when the selected project changes', async () => {
    mockOverview({base: {autofix_root_cause: [rootCauseRun]}});
    const otherProject = deferredResponse();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      match: [MockApiClient.matchQuery({project: [3]})],
      asyncDelay: otherProject.promise,
      body: {runsByMilestone: {...emptyMilestones, autofix_solution: [solutionRun]}},
    });

    renderPage();
    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();

    act(() => PageFiltersStore.updateProjects([3], null));

    expect((await screen.findAllByTestId('loading-placeholder')).length).toBeGreaterThan(
      0
    );
    expect(
      screen.queryByRole('link', {name: 'TypeError in checkout cart'})
    ).not.toBeInTheDocument();

    otherProject.resolve();

    expect(
      await screen.findByRole('link', {name: 'KeyError in proxy handler'})
    ).toBeInTheDocument();
    expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
  });

  it('shows the skeleton again when the time window changes', async () => {
    mockOverview({base: {autofix_root_cause: [rootCauseRun]}});
    const narrower = deferredResponse();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      match: [MockApiClient.matchQuery({statsPeriod: '24h'})],
      asyncDelay: narrower.promise,
      body: {runsByMilestone: emptyMilestones},
    });

    const {router} = renderPage();
    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();

    router.navigate(`${basePath}?activityStatsPeriod=24h`);

    expect((await screen.findAllByTestId('loading-placeholder')).length).toBeGreaterThan(
      0
    );
    expect(
      screen.queryByRole('link', {name: 'TypeError in checkout cart'})
    ).not.toBeInTheDocument();

    narrower.resolve();

    expect(await screen.findByText('No Autofix runs')).toBeInTheDocument();
  });

  it('holds the project filter as a placeholder until projects finish loading', async () => {
    // Reset the store so `useProjects().initiallyLoaded` is false; without this the
    // project filter would swap "Loading…" for its label and shift the whole row.
    ProjectsStore.reset();
    mockOverview({base: {autofix_root_cause: [rootCauseRun]}});

    renderPage();

    // The rest of the filter row renders for real from the first frame; only
    // the project picker waits behind a placeholder.
    expect(await screen.findByRole('button', {name: /Sort/})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Autofix Activity/})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'project-slug'})).not.toBeInTheDocument();

    act(() => ProjectsStore.loadInitialData([ProjectFixture()]));

    expect(await screen.findByRole('button', {name: 'project-slug'})).toBeInTheDocument();
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
      failedCheckDetails: [
        {name: 'build (3.12)', url: null},
        {name: 'mypy', url: null},
      ],
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

  it('links a failing check to its run and leaves url-less checks as plain text', async () => {
    const failingPullRequest: OverviewPullRequest = {
      ...pullRequestFixture({number: 3, status: 'open'}),
      checksStatus: 'failure',
      failedCheckDetails: [
        {name: 'build (3.12)', url: 'https://github.com/getsentry/sentry/runs/1'},
        {name: 'flaky', url: null},
      ],
    };
    mockOverview({
      base: {has_pull_request: [{...rootCauseRun, pullRequests: [failingPullRequest]}]},
    });

    renderPage();

    await userEvent.hover(await screen.findByText('2 Checks Failing'));

    const runLink = await screen.findByRole('link', {name: 'build (3.12)'});
    expect(runLink).toHaveAttribute('href', 'https://github.com/getsentry/sentry/runs/1');
    // A check with no run url stays plain text, not a link.
    expect(screen.getByText('flaky')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'flaky'})).not.toBeInTheDocument();
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
                failedCheckDetails: [{name: 'mypy', url: null}],
              },
            ],
          },
        ],
      },
    });

    renderPage();

    expect(await screen.findByText('1 Check Failing')).toBeInTheDocument();
  });

  it('shows the plain failing label when a failing PR has no check details', async () => {
    // A failing PR with no per-check details must show the plain label rather
    // than reading .length of undefined.
    const failingWithoutDetails: OverviewPullRequest = {
      ...pullRequestFixture({number: 3, status: 'open'}),
      checksStatus: 'failure',
    };
    mockOverview({
      base: {
        has_pull_request: [{...rootCauseRun, pullRequests: [failingWithoutDetails]}],
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

  it('prefetches PR file diffs when the code changes section is hovered', async () => {
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

    const section = await screen.findByText('Code Changes');
    expect(filesRequest).not.toHaveBeenCalled();

    await userEvent.hover(section);
    await waitFor(() => expect(filesRequest).toHaveBeenCalledTimes(1));

    await userEvent.unhover(section);
    await userEvent.hover(section);
    expect(filesRequest).toHaveBeenCalledTimes(1);

    await userEvent.click(
      await screen.findByRole('button', {name: /src\/sentry\/foo\.py/})
    );
    expect(await screen.findByText('addedone')).toBeInTheDocument();
    expect(filesRequest).toHaveBeenCalledTimes(1);
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

  it('defaults to Recommended and keeps the sort param out of the URL', async () => {
    const {statusPollRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });

    const {router} = renderPage();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Sort/})).toHaveTextContent('Recommended');
    expect(statusPollRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/autofix-overview/`,
      expect.objectContaining({
        query: expect.objectContaining({sort: 'recommended'}),
      })
    );
    expect(router.location.query.sort).toBeUndefined();
  });

  it('omits the sort param for the Recent Seer Activity backend default', async () => {
    const {statusPollRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });

    const {router} = renderPage();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /Sort/}));
    await userEvent.click(screen.getByRole('option', {name: 'Recent Seer Activity'}));

    await waitFor(() =>
      expect(statusPollRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/seer/autofix-overview/`,
        expect.objectContaining({
          query: expect.not.objectContaining({sort: expect.anything()}),
        })
      )
    );
    expect(router.location.query.sort).toBe('seer');
  });

  it.each([
    {option: 'Most events', sort: 'events'},
    {option: 'Recent Issue Activity', sort: 'issue'},
    {option: 'Most users', sort: 'users'},
  ])('sends the $sort sort to the endpoint and URL', async ({option, sort}) => {
    const {statusPollRequest} = mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
    });

    const {router} = renderPage();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /Sort/}));
    await userEvent.click(screen.getByRole('option', {name: option}));

    await waitFor(() =>
      expect(statusPollRequest).toHaveBeenCalledWith(
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
      const {statusPollRequest} = mockOverview({
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
      expect(statusPollRequest).toHaveBeenCalledTimes(1);
    });

    it('shows a filtered empty state when no runs match the assignee', async () => {
      mockOverview({base: {autofix_root_cause: [assignedRun]}});

      renderPage({assignee: 'user:999'});

      expect(
        await screen.findByText('No Autofix runs match the selected assignee.')
      ).toBeInTheDocument();
      expect(screen.queryByText('No Autofix runs')).not.toBeInTheDocument();
      // No tabs above the message when the filter matches nothing to switch between.
      expect(screen.queryByRole('tab', {name: /All Runs/})).not.toBeInTheDocument();
    });

    it('shows a truncation notice in the assignee menu when the backend caps a section', async () => {
      mockOverview({
        base: {autofix_root_cause: [assignedRun]},
        truncated: ['autofix_root_cause'],
      });

      renderPage();

      await userEvent.click(await screen.findByRole('button', {name: /Assignee/}));

      expect(
        await screen.findByText('Assignee counts may be incomplete')
      ).toBeInTheDocument();
    });

    it('omits the truncation notice when nothing is capped', async () => {
      mockOverview({base: {autofix_root_cause: [assignedRun]}});

      renderPage();

      await userEvent.click(await screen.findByRole('button', {name: /Assignee/}));

      expect(
        screen.queryByText('Assignee counts may be incomplete')
      ).not.toBeInTheDocument();
    });

    it('omits the truncation notice when the menu has no assignee options', async () => {
      mockOverview({base: {}, truncated: ['autofix_root_cause']});

      renderPage();

      await userEvent.click(await screen.findByRole('button', {name: /Assignee/}));

      expect(
        screen.queryByText('Assignee counts may be incomplete')
      ).not.toBeInTheDocument();
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

    it('batches team avatar fetches into a single request across cards', async () => {
      act(() => {
        TeamStore.loadInitialData([]);
      });
      const teamOne: Actor = {type: 'team', id: '8', name: 'team-eight'};
      const teamTwo: Actor = {type: 'team', id: '9', name: 'team-nine'};
      mockOverview({
        base: {
          autofix_root_cause: [
            {
              ...rootCauseRun,
              groupId: '2',
              seerRunId: 'run-1',
              title: 'First team issue',
              issue: issueFixture({assignedTo: teamOne}),
            },
            {
              ...rootCauseRun,
              groupId: '3',
              seerRunId: 'run-2',
              title: 'Second team issue',
              issue: issueFixture({assignedTo: teamTwo}),
            },
          ],
        },
      });
      const teamsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: [
          TeamFixture({id: '8', slug: 'team-eight'}),
          TeamFixture({id: '9', slug: 'team-nine'}),
        ],
      });

      renderPage();

      expect(await screen.findByText('First team issue')).toBeInTheDocument();
      expect(await screen.findByText('Second team issue')).toBeInTheDocument();

      // Both assignee teams should resolve via one batched request, not one per team.
      await waitFor(() => {
        const batched = teamsMock.mock.calls.find(([, options]: any) => {
          const query = options?.query?.query ?? '';
          return query.includes('id:8') && query.includes('id:9');
        });
        expect(batched).toBeDefined();
      });
      expect(teamsMock).toHaveBeenCalledTimes(1);
    });

    it('restores a usable assignee control when an assigned team never resolves', async () => {
      act(() => {
        TeamStore.loadInitialData([]);
      });
      const deletedTeam: Actor = {type: 'team', id: '404', name: 'gone'};
      mockOverview({
        base: {
          autofix_root_cause: [
            {
              ...rootCauseRun,
              groupId: '2',
              seerRunId: 'run-1',
              title: 'Orphaned issue',
              issue: issueFixture({assignedTo: deletedTeam}),
            },
          ],
        },
      });
      // The batched request omits the assigned team (deleted / inaccessible),
      // so it never enters the resolved set.
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: [],
      });

      renderPage();

      expect(await screen.findByText('Orphaned issue')).toBeInTheDocument();
      // Once the batch settles, the card must fall back to the interactive
      // assignee control rather than hang on a placeholder.
      expect(
        await screen.findByRole('button', {name: 'Modify issue assignee'})
      ).toBeInTheDocument();
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
        body: [MemberFixture({user: nextAssignee, projects: ['project-slug']})],
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

    expect(
      await screen.findByText('There was an error loading data.', undefined, {
        timeout: 5000,
      })
    ).toBeInTheDocument();
  });

  it('retries the project config request from the error state', async () => {
    const {projectConfigRequest} = mockOverview({
      base: {},
      baseStatusCode: 500,
      projectConfig: [{id: '2', slug: 'project-slug', hasReposConnected: false}],
    });

    renderPage();

    const retry = await screen.findByRole('button', {name: 'Retry'}, {timeout: 5000});
    expect(projectConfigRequest).toHaveBeenCalledTimes(1);

    await userEvent.click(retry);

    await waitFor(() => expect(projectConfigRequest).toHaveBeenCalledTimes(2));
  });

  it('replaces the overview content when the org is eligible for Seer but has not purchased it', () => {
    const {statusPollRequest, scmInfoRequest} = mockOverview({
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
    expect(scmInfoRequest).not.toHaveBeenCalled();
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

  it('shows the setup empty state when no selected project has a repo connected', async () => {
    mockOverview({
      base: {},
      projectConfig: [{id: '2', slug: 'project-slug', hasReposConnected: false}],
    });

    renderPage();

    expect(
      await screen.findByText('Set up Seer to start fixing issues')
    ).toBeInTheDocument();
    expect(screen.queryByText('No Autofix runs')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Set up Seer'})).toHaveAttribute(
      'href',
      '/settings/org-slug/seer/'
    );
  });

  it('does not flash the generic empty state while project config is loading', async () => {
    const deferred = deferredResponse();
    mockOverview({
      base: {},
      projectConfig: [{id: '2', slug: 'project-slug', hasReposConnected: false}],
      projectConfigAsyncDelay: deferred.promise,
    });

    renderPage();

    expect((await screen.findAllByTestId('loading-placeholder')).length).toBeGreaterThan(
      0
    );
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.queryByText('No Autofix runs')).not.toBeInTheDocument();

    deferred.resolve();

    expect(
      await screen.findByText('Set up Seer to start fixing issues')
    ).toBeInTheDocument();
    expect(screen.queryByText('No Autofix runs')).not.toBeInTheDocument();
  });

  it('does not flash the generic empty state when switching from an unconfigured project to one with runs', async () => {
    mockOverview({
      base: {},
      projectConfig: [{id: '2', slug: 'project-slug', hasReposConnected: false}],
    });
    const configured = deferredResponse();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      match: [MockApiClient.matchQuery({project: [3]})],
      asyncDelay: configured.promise,
      body: {
        runsByMilestone: {...emptyMilestones, autofix_root_cause: [rootCauseRun]},
        truncatedMilestones: [],
        projectConfig: [{id: '3', slug: 'beta-project', hasReposConnected: true}],
      },
    });

    renderPage();
    expect(
      await screen.findByText('Set up Seer to start fixing issues')
    ).toBeInTheDocument();

    act(() => PageFiltersStore.updateProjects([3], null));

    expect((await screen.findAllByTestId('loading-placeholder')).length).toBeGreaterThan(
      0
    );
    expect(
      screen.queryByText('Set up Seer to start fixing issues')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('No Autofix runs')).not.toBeInTheDocument();

    configured.resolve();

    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();
    expect(screen.queryByText('No Autofix runs')).not.toBeInTheDocument();
  });

  it('waits for project config before painting cards so the warning does not pop in', async () => {
    const deferred = deferredResponse();
    mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
      projectConfig: [
        {id: '2', slug: 'alpha-project', hasReposConnected: true},
        {id: '3', slug: 'beta-project', hasReposConnected: false},
      ],
      projectConfigAsyncDelay: deferred.promise,
    });

    renderPage();

    // The skeleton holds while project config is loading; neither the cards nor
    // the setup warning are painted yet.
    expect((await screen.findAllByTestId('loading-placeholder')).length).toBeGreaterThan(
      0
    );
    expect(
      screen.queryByRole('link', {name: 'TypeError in checkout cart'})
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Seer setup warning')).not.toBeInTheDocument();

    deferred.resolve();

    // Once project config resolves, the warning and the cards appear together.
    expect(await screen.findByLabelText('Seer setup warning')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();
  });

  it('shows the subset warning counting only the unconfigured projects', async () => {
    mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
      projectConfig: [
        {id: '2', slug: 'alpha-project', hasReposConnected: true},
        {id: '3', slug: 'beta-project', hasReposConnected: false},
      ],
    });

    renderPage();

    await userEvent.hover(await screen.findByLabelText('Seer setup warning'));

    const tooltip = await screen.findByText(/Seer automation isn't set up for/);
    expect(tooltip).toHaveTextContent(
      "Seer automation isn't set up for 1 project in the current filter. Enable automation"
    );
    expect(screen.getByRole('link', {name: 'Enable automation'})).toHaveAttribute(
      'href',
      '/settings/org-slug/seer/'
    );
    expect(
      screen.queryByText('Set up Seer to start fixing issues')
    ).not.toBeInTheDocument();
  });

  it('shows no setup warning when every selected project is configured', async () => {
    mockOverview({
      base: {autofix_root_cause: [rootCauseRun]},
      projectConfig: [{id: '2', slug: 'project-slug', hasReposConnected: true}],
    });

    renderPage();

    expect(
      await screen.findByRole('button', {name: 'Create Plan 1'})
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Seer setup warning')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Set up Seer to start fixing issues')
    ).not.toBeInTheDocument();
  });
});
