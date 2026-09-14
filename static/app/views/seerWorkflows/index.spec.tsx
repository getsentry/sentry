import {OrganizationFixture} from 'sentry-fixture/organization';
import {PullRequestFixture} from 'sentry-fixture/pullRequest';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import SeerWorkflows from 'sentry/views/seerWorkflows';

describe('SeerWorkflows', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hides the monitor scan trigger when its flag is disabled', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [],
    });
    render(<SeerWorkflows />, {organization});
    expect(await screen.findByText('No workflow runs yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Run…'})).not.toBeInTheDocument();
  });

  it('clears filters when starting a scan, expands it, and polls for completion', async () => {
    const scanOrganization = OrganizationFixture({
      features: ['seer-workflows-monitor-cleanup'],
    });
    const url = `/organizations/${scanOrganization.slug}/seer/workflows/`;
    const previousRun = {
      id: '1',
      seerRunId: '45e94493-c356-4d2b-bb26-ae4e2e508a74',
      strategy: 'duplicate_monitors',
      dateAdded: '2026-09-09T00:00:00Z',
      extras: {status: 'complete'},
      results: [],
    };
    MockApiClient.addMockResponse({url, body: [previousRun]});
    const startScan = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      statusCode: 202,
      body: {
        runId: '2',
      },
    });
    const {router} = render(<SeerWorkflows />, {
      organization: scanOrganization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${scanOrganization.slug}/issues/autofix/workflows/`,
          query: {status: 'succeeded', strategy: 'agentic_triage', source: 'scheduled'},
        },
      },
    });
    expect(await screen.findByText('No runs match your filters.')).toBeInTheDocument();
    const runningRun = {
      ...previousRun,
      id: '2',
      seerRunId: '09a15703-bf37-4208-bd90-c57013c9694b',
      extras: {status: 'running'},
    };
    MockApiClient.addMockResponse({url, body: [runningRun, previousRun]});
    await userEvent.click(screen.getByRole('button', {name: 'Run…'}));
    expect(startScan).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Monitor scan'}));

    expect(await screen.findByRole('status', {name: 'Running'})).toBeInTheDocument();
    expect(screen.getAllByText('Scanning monitors…')).not.toHaveLength(0);
    expect(startScan).toHaveBeenCalledTimes(1);
    expect(startScan).toHaveBeenCalledWith(
      url,
      expect.objectContaining({data: {strategy: 'duplicate_monitors'}})
    );
    expect(router.location.query).toEqual({});
    expect(screen.getByRole('button', {name: 'Collapse run'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Expand run'})).toBeInTheDocument();

    const completedRun = {
      ...runningRun,
      extras: {status: 'complete'},
      results: [
        {
          id: '1',
          kind: 'duplicate_monitors',
          extras: {
            outputKind: 'monitor_cleanup',
            schemaVersion: 1,
            projectId: '1',
            projectSlug: 'checkout',
            scan: {status: 'complete', monitorsScanned: 2},
            summary: 'No duplicates found.',
            findings: [],
          },
        },
      ],
    };
    MockApiClient.addMockResponse({url, body: [completedRun, previousRun]});
    await waitFor(
      () =>
        expect(screen.queryByRole('status', {name: 'Running'})).not.toBeInTheDocument(),
      {timeout: 7000}
    );
    expect(screen.getAllByRole('img', {name: 'Succeeded'})).toHaveLength(2);
    expect(screen.getAllByText('No findings')).not.toHaveLength(0);
  }, 10000);

  it('keeps the running scan visible when a background poll fails', async () => {
    jest.useFakeTimers();
    const url = `/organizations/${organization.slug}/seer/workflows/`;
    MockApiClient.addMockResponse({
      url,
      body: [
        {
          id: '1',
          strategy: 'duplicate_monitors',
          dateAdded: '2026-09-09T00:00:00Z',
          extras: {status: 'running'},
          results: [],
        },
      ],
    });
    render(<SeerWorkflows />, {organization});
    expect(await screen.findByRole('status', {name: 'Running'})).toBeInTheDocument();

    const failedPoll = MockApiClient.addMockResponse({
      url,
      statusCode: 503,
      body: {detail: 'Service unavailable'},
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    expect(failedPoll).toHaveBeenCalled();
    expect(screen.getByRole('status', {name: 'Running'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /retry/i})).not.toBeInTheDocument();
  });

  it('renders structured duplicate monitor findings in workflow history', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '2',
          seerRunId: '09a15703-bf37-4208-bd90-c57013c9694b',
          strategy: 'duplicate_monitors',
          dateAdded: '2026-09-09T00:00:00Z',
          extras: {
            status: 'complete',
            coverage: {total: 1, complete: 1, partial: 0, failed: 0},
          },
          issues: [],
          results: [
            {
              id: '1',
              kind: 'duplicate_monitors',
              seerRunId: '09a15703-bf37-4208-bd90-c57013c9694b',
              extras: {
                outputKind: 'monitor_cleanup',
                schemaVersion: 1,
                projectId: '1',
                projectSlug: 'checkout',
                scan: {status: 'complete', monitorsScanned: 2},
                summary: 'One matching pair',
                findings: [
                  {
                    kind: 'exact_duplicate',
                    monitors: [
                      {id: '10', name: 'Checkout errors', enabled: true},
                      {id: '11', name: 'Checkout errors copy', enabled: true},
                    ],
                    suggestedKeepId: '10',
                    alerts: [],
                    comparison: [],
                    reason: 'Matching thresholds',
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    render(<SeerWorkflows />, {organization});
    expect(await screen.findByText('Duplicate monitors')).toBeInTheDocument();
    expect(screen.getByText('1 exact duplicate group')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Expand run'}));
    expect(screen.getByRole('link', {name: 'Checkout errors'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Debug'}));
    expect(
      screen.getByRole('link', {
        name: 'View prompt and agent run 09a15703-bf37-4208-bd90-c57013c9694b',
      })
    ).toHaveAttribute(
      'href',
      expect.stringContaining('explorerRunId=09a15703-bf37-4208-bd90-c57013c9694b')
    );
  });

  it('shows a safe failure label without exposing diagnostic errors', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: 'Unexpected Seer error',
          errorType: 'unknown',
          extras: {},
          issues: [],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    expect(await screen.findByText('Run failed')).toBeInTheDocument();
    expect(screen.getByLabelText('Failed')).toBeInTheDocument();
    expect(screen.queryByText('Unexpected Seer error')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Expand run'}));
    expect(screen.queryByText(/Unexpected Seer error/)).not.toBeInTheDocument();
  });

  it.each([
    ['no_quota', 'No Seer quota available', 'Skipped'],
    ['invalid_shard_plan', 'Could not prepare triage', 'Failed'],
  ])('shows friendly messaging for %s', async (errorType, resultText, status) => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: 'Backend diagnostic details',
          errorType,
          extras: {},
          issues: [],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    expect(await screen.findByText(resultText)).toBeInTheDocument();
    expect(screen.getByLabelText(status)).toBeInTheDocument();
  });

  it('expands a row to show the issue title, action, and a conversation link', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {foo: 'bar'},
          issues: [
            {
              id: '10',
              groupId: '100',
              groupTitle: 'ValueError: something broke',
              groupShortId: 'SEER-ABC',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    expect(await screen.findByText('1 issue')).toBeInTheDocument();
    expect(screen.getByLabelText('Succeeded')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Agentic triage'));

    expect(screen.getByText('Autofix queued')).toBeInTheDocument();

    expect(
      screen.getByRole('link', {name: 'SEER-ABC ValueError: something broke'})
    ).toHaveAttribute('href', `/organizations/${organization.slug}/issues/100/`);
    expect(screen.queryByRole('link', {name: '100'})).not.toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'Autofix queued'})).toHaveAttribute(
      'href',
      expect.stringContaining('explorerRunId=seer-1')
    );

    expect(screen.queryByText('seer-1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Agentic triage'));
    expect(screen.queryByText('Autofix queued')).not.toBeInTheDocument();
  });

  it('shows the reason for skipping an issue without a conversation link', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {},
          issues: [
            {
              id: '10',
              groupId: '100',
              groupTitle: 'ValueError: something broke',
              action: 'skip',
              skipReason: 'insufficient_info',
              reason: 'More information is needed to investigate.',
              seerRunId: null,
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Expand run'}));

    expect(screen.getByText('Skipped: insufficient info')).toBeInTheDocument();
    expect(
      screen.getByText('More information is needed to investigate.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'Skipped: insufficient info'})
    ).not.toBeInTheDocument();
  });

  it('shows a pull request chip for each PR linked to an issue', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {},
          issues: [
            {
              id: '10',
              groupId: '100',
              groupTitle: 'ValueError: something broke',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [
                {
                  ...PullRequestFixture({
                    id: '42',
                    externalUrl: 'https://github.com/getsentry/sentry/pull/42',
                  }),
                  status: 'merged',
                },
                {...PullRequestFixture({id: '43', externalUrl: ''}), status: 'merged'},
                {
                  ...PullRequestFixture({
                    id: '44',
                    externalUrl: 'https://github.com/getsentry/sentry/pull/44',
                  }),
                  status: null,
                },
              ],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Expand run'}));

    const prChip = screen.getByRole('button', {name: 'Merged #42'});
    expect(prChip).toHaveAttribute('href', 'https://github.com/getsentry/sentry/pull/42');
    expect(prChip).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Merged #43')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Merged #43'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: '#44'})).toBeInTheDocument();
    expect(screen.queryByText('Autofix queued')).not.toBeInTheDocument();
  });

  it('shows one labeled pill per triage batch in the expanded panel', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {},
          issues: [
            {
              id: '10',
              groupId: '100',
              groupTitle: 'ValueError: something broke',
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
          seerRuns: [{seerRunId: '42'}, {seerRunId: '43'}, {seerRunId: null}],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    expect(await screen.findByText('1 issue')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'Open run in Seer Explorer'})
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Expand run'}));

    expect(screen.getByText('Triage batches (2)')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Batch 1'})).toHaveAttribute(
      'href',
      expect.stringContaining('explorerRunId=42')
    );
    expect(screen.getByRole('button', {name: 'Batch 2'})).toHaveAttribute(
      'href',
      expect.stringContaining('explorerRunId=43')
    );
  });

  it('shows no triage batches recorded when a run has no shards', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {},
          issues: [],
          seerRuns: [],
        },
      ],
    });

    render(<SeerWorkflows />, {organization});

    expect(await screen.findByText('No issues processed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Expand run'}));

    expect(
      screen.getByText('No triage batches recorded for this run.')
    ).toBeInTheDocument();
  });

  it('sorts by date desc by default and toggles asc on Date header click', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: 'older',
          dateAdded: '2026-04-10T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {options: {source: 'cron'}},
          issues: [
            {
              id: '1',
              groupId: '100',
              groupTitle: null,
              action: 'a',
              seerRunId: 's1',
              pullRequests: [],
              dateAdded: '2026-04-10T00:00:01Z',
            },
          ],
        },
        {
          id: 'newer',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {options: {source: 'cron'}},
          issues: [
            {
              id: '2',
              groupId: '101',
              groupTitle: null,
              action: 'a',
              seerRunId: 's2',
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
            {
              id: '3',
              groupId: '102',
              groupTitle: null,
              action: 'a',
              seerRunId: 's3',
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:02Z',
            },
          ],
        },
      ],
    });

    const {router} = render(<SeerWorkflows />, {organization});

    const resultsDesc = (await screen.findAllByText(/issues?$/)).map(
      el => el.textContent
    );
    expect(resultsDesc).toEqual(['2 issues', '1 issue']);

    await userEvent.click(
      within(screen.getByRole('columnheader', {name: /Date/})).getByRole('button')
    );

    expect(router.location.query.sort).toBe('asc');
    const resultsAsc = (await screen.findAllByText(/issues?$/)).map(el => el.textContent);
    expect(resultsAsc).toEqual(['1 issue', '2 issues']);
  });

  it('shows error state when fetch fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      statusCode: 404,
      body: {detail: 'not found'},
    });

    render(<SeerWorkflows />, {organization});

    expect(await screen.findByRole('button', {name: /retry/i})).toBeInTheDocument();
  });

  it('filters rows by status via URL query param', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {options: {source: 'cron'}},
          issues: [
            {
              id: '10',
              groupId: '100',
              groupTitle: null,
              action: 'autofix_triggered',
              seerRunId: 's1',
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
        {
          id: '2',
          dateAdded: '2026-04-21T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: 'Unexpected Seer error',
          errorType: 'unknown',
          extras: {options: {source: 'cron'}},
          issues: [],
        },
      ],
    });

    render(<SeerWorkflows />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/autofix/workflows/',
          query: {status: 'failed'},
        },
      },
    });

    expect(await screen.findByText('Run failed')).toBeInTheDocument();
    expect(screen.queryByText('1 issue')).not.toBeInTheDocument();
  });

  it('Clear all resets all filter query params', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: '1',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {options: {source: 'cron'}},
          issues: [
            {
              id: '10',
              groupId: '100',
              groupTitle: null,
              action: 'autofix_triggered',
              seerRunId: 's1',
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    const {router} = render(<SeerWorkflows />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/autofix/workflows/',
          query: {status: 'failed', strategy: 'agentic_triage', period: '7d'},
        },
      },
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Clear all'}));

    expect(router.location.query.status).toBeUndefined();
    expect(router.location.query.strategy).toBeUndefined();
    expect(router.location.query.period).toBeUndefined();
    expect(await screen.findByText('1 issue')).toBeInTheDocument();
  });

  it('expandLatest auto-expands the latest run visible under active filters', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/`,
      body: [
        {
          id: 'newer-failed',
          dateAdded: '2026-04-21T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: 'Unexpected Seer error',
          errorType: 'unknown',
          extras: {},
          issues: [],
        },
        {
          id: 'older-succeeded',
          dateAdded: '2026-04-20T00:00:00Z',
          triageStrategy: 'agentic',
          errorMessage: null,
          extras: {},
          issues: [
            {
              id: '10',
              groupId: '100',
              groupTitle: null,
              action: 'autofix_triggered',
              seerRunId: 'seer-1',
              pullRequests: [],
              dateAdded: '2026-04-20T00:00:01Z',
            },
          ],
        },
      ],
    });

    render(<SeerWorkflows />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/autofix/workflows/',
          query: {expandLatest: 'agentic_triage', status: 'succeeded'},
        },
      },
    });

    expect(await screen.findByText('Autofix queued')).toBeInTheDocument();
  });
});
