import {OrganizationFixture} from 'sentry-fixture/organization';
import {SeerWorkflowConfigFixture} from 'sentry-fixture/seerWorkflowConfig';

import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {LegacyAutomationRunsList} from 'sentry/views/seerWorkflows/runs/legacyRunsList';
import type {SeerAutomationRun} from 'sentry/views/seerWorkflows/types';

function makeRun(overrides: Partial<SeerAutomationRun>): SeerAutomationRun {
  return {
    id: '1',
    configId: '1',
    dateAdded: '2026-04-20T00:00:00Z',
    dateUpdated: '2026-04-20T00:01:00Z',
    dateCompleted: '2026-04-20T00:01:00Z',
    executions: [],
    status: 'complete',
    ...overrides,
  } as SeerAutomationRun;
}

function makeExecution(
  overrides: Partial<SeerAutomationRun['executions'][number]>
): SeerAutomationRun['executions'][number] {
  return {
    id: '100',
    seerRunId: null,
    dateAdded: '2026-04-20T00:00:10Z',
    dateUpdated: '2026-04-20T00:00:20Z',
    dateCompleted: '2026-04-20T00:00:20Z',
    status: 'complete',
    ...overrides,
  } as SeerAutomationRun['executions'][number];
}

describe('LegacyAutomationRunsList', () => {
  const organization = OrganizationFixture({features: ['seer-automations']});
  const runsUrl = `/organizations/${organization.slug}/seer/workflows/runs/`;
  const runsPath = `/organizations/${organization.slug}/seer/automations/runs/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/configs/`,
      body: {
        configs: [
          SeerWorkflowConfigFixture({id: '1', strategy: 'agentic_triage'}),
          SeerWorkflowConfigFixture({id: '2', strategy: 'duplicate_monitors'}),
        ],
      },
    });
  });

  it('hides the monitor scan trigger when its flag is disabled', async () => {
    MockApiClient.addMockResponse({url: runsUrl, body: {runs: []}});
    render(<LegacyAutomationRunsList />, {organization});
    expect(await screen.findByText('No workflow runs yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Run…'})).not.toBeInTheDocument();
  });

  describe('starting a run', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      try {
        act(() => {
          jest.runOnlyPendingTimers();
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('clears filters when starting a scan, expands it, and polls for completion', async () => {
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      const scanOrganization = OrganizationFixture({
        features: ['seer-automations', 'seer-workflows-monitor-cleanup'],
      });
      const previousRun = makeRun({id: '1', configId: '2'});
      MockApiClient.addMockResponse({url: runsUrl, body: {runs: [previousRun]}});
      const startScan = MockApiClient.addMockResponse({
        url: runsUrl,
        method: 'POST',
        statusCode: 202,
        body: {runId: '2'},
      });
      const {router} = render(<LegacyAutomationRunsList />, {
        organization: scanOrganization,
        initialRouterConfig: {
          location: {
            pathname: runsPath,
            query: {status: 'failed', strategy: 'agentic_triage'},
          },
        },
      });
      expect(await screen.findByText('No runs match your filters.')).toBeInTheDocument();

      const runningRun = makeRun({
        id: '2',
        configId: '2',
        dateAdded: '2026-04-21T00:00:00Z',
        dateCompleted: null,
        status: 'running',
      });
      MockApiClient.addMockResponse({
        url: runsUrl,
        body: {runs: [runningRun, previousRun]},
      });
      await user.click(screen.getByRole('button', {name: 'Run…'}));
      await user.click(screen.getByRole('menuitemradio', {name: 'Monitor scan'}));

      expect(await screen.findByRole('status', {name: 'Running'})).toBeInTheDocument();
      expect(startScan).toHaveBeenCalledWith(
        runsUrl,
        expect.objectContaining({data: {strategy: 'duplicate_monitors'}})
      );
      expect(router.location.query).toEqual({});
      expect(screen.getByRole('button', {name: 'Collapse run'})).toBeInTheDocument();

      MockApiClient.addMockResponse({
        url: runsUrl,
        body: {runs: [{...runningRun, status: 'complete'}, previousRun]},
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
      });
      expect(screen.queryByRole('status', {name: 'Running'})).not.toBeInTheDocument();
      expect(screen.getAllByRole('img', {name: 'Succeeded'})).toHaveLength(2);
    });
  });

  it("shows each run's strategy from its config", async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({id: '1', configId: '1'}),
          makeRun({id: '2', configId: '2', dateAdded: '2026-04-19T00:00:00Z'}),
        ],
      },
    });

    render(<LegacyAutomationRunsList />, {organization});

    expect(await screen.findByText('Agentic triage')).toBeInTheDocument();
    expect(screen.getByText('Duplicate monitors')).toBeInTheDocument();
  });

  it('shows the error message for failed and rejected runs', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({
            id: '1',
            status: 'failed',
            error: {code: 'unknown', message: 'No error details are available.'},
          }),
          makeRun({
            id: '2',
            dateAdded: '2026-04-19T00:00:00Z',
            status: 'rejected',
            error: {code: 'no_quota', message: 'No Seer quota available.'},
          }),
        ],
      },
    });

    render(<LegacyAutomationRunsList />, {organization});

    expect(
      await screen.findByText('No error details are available.')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Failed')).toBeInTheDocument();
    expect(screen.getByText('No Seer quota available.')).toBeInTheDocument();
    expect(screen.getByLabelText('Skipped')).toBeInTheDocument();
  });

  it('expands a row to show its executions with agent run links', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({
            executions: [
              makeExecution({
                id: '100',
                seerRunId: '09a15703-bf37-4208-bd90-c57013c9694b',
              }),
              makeExecution({
                id: '101',
                status: 'failed',
                error: {code: 'dispatch_failed', message: 'Could not start execution.'},
              }),
            ],
          }),
        ],
      },
    });

    render(<LegacyAutomationRunsList />, {organization});

    expect(await screen.findByText('2 executions')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Expand run'}));
    expect(screen.getByText('Execution 100')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View agent run'})).toHaveAttribute(
      'href',
      expect.stringContaining('explorerRunId=09a15703-bf37-4208-bd90-c57013c9694b')
    );
    expect(screen.getByText('Could not start execution.')).toBeInTheDocument();
  });

  it('sorts by date desc by default and toggles asc on Date header click', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({
            id: 'older',
            dateAdded: '2026-04-10T00:00:00Z',
            executions: [makeExecution({id: '1'})],
          }),
          makeRun({
            id: 'newer',
            dateAdded: '2026-04-20T00:00:00Z',
            executions: [makeExecution({id: '2'}), makeExecution({id: '3'})],
          }),
        ],
      },
    });

    const {router} = render(<LegacyAutomationRunsList />, {organization});

    const resultsDesc = (await screen.findAllByText(/executions?$/)).map(
      el => el.textContent
    );
    expect(resultsDesc).toEqual(['2 executions', '1 execution']);

    await userEvent.click(
      within(screen.getByRole('columnheader', {name: /Date/})).getByRole('button')
    );

    expect(router.location.query.sort).toBe('asc');
    const resultsAsc = (await screen.findAllByText(/executions?$/)).map(
      el => el.textContent
    );
    expect(resultsAsc).toEqual(['1 execution', '2 executions']);
  });

  it('shows error state when fetch fails', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      statusCode: 404,
      body: {detail: 'not found'},
    });

    render(<LegacyAutomationRunsList />, {organization});

    expect(await screen.findByRole('button', {name: /retry/i})).toBeInTheDocument();
  });

  it('filters rows by status via URL query param', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({id: '1', executions: [makeExecution({})]}),
          makeRun({
            id: '2',
            dateAdded: '2026-04-21T00:00:00Z',
            status: 'failed',
            error: {code: 'unknown', message: 'Run failed'},
          }),
        ],
      },
    });

    render(<LegacyAutomationRunsList />, {
      organization,
      initialRouterConfig: {location: {pathname: runsPath, query: {status: 'failed'}}},
    });

    expect(await screen.findByText('Run failed')).toBeInTheDocument();
    expect(screen.queryByText('1 execution')).not.toBeInTheDocument();
  });

  it('Clear all resets all filter query params', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {runs: [makeRun({executions: [makeExecution({})]})]},
    });

    const {router} = render(<LegacyAutomationRunsList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: runsPath,
          query: {status: 'failed', strategy: 'agentic_triage', period: '7d'},
        },
      },
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Clear all'}));

    expect(router.location.query.status).toBeUndefined();
    expect(router.location.query.strategy).toBeUndefined();
    expect(router.location.query.period).toBeUndefined();
    expect(await screen.findByText('1 execution')).toBeInTheDocument();
  });

  it('expandLatest auto-expands the latest run visible under active filters', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({
            id: 'newer-failed',
            dateAdded: '2026-04-21T00:00:00Z',
            status: 'failed',
            error: {code: 'unknown', message: 'Run failed'},
          }),
          makeRun({
            id: 'older-succeeded',
            executions: [makeExecution({id: '100'})],
          }),
        ],
      },
    });

    render(<LegacyAutomationRunsList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: runsPath,
          query: {expandLatest: 'agentic_triage', status: 'succeeded'},
        },
      },
    });

    expect(await screen.findByText('Execution 100')).toBeInTheDocument();
  });
});
