import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import type {SeerAutomationRun} from 'sentry/views/seerWorkflows/types';

import {RunsTable} from './runsTable';

function makeRun(overrides: Partial<SeerAutomationRun> = {}): SeerAutomationRun {
  return {
    id: '1',
    configId: '1',
    configName: null,
    strategy: 'agentic_triage_v2',
    dateAdded: '2026-04-20T00:00:00Z',
    dateUpdated: '2026-04-20T00:01:00Z',
    dateCompleted: '2026-04-20T00:01:00Z',
    executions: [],
    status: 'complete',
    trigger: null,
    ...overrides,
  } as SeerAutomationRun;
}

function makeExecution(
  overrides: Partial<SeerAutomationRun['executions'][number]> = {}
): SeerAutomationRun['executions'][number] {
  return {
    id: '1',
    seerRunId: null,
    dateAdded: '2026-04-20T00:00:00Z',
    dateUpdated: '2026-04-20T00:01:00Z',
    dateCompleted: '2026-04-20T00:01:00Z',
    outputs: [],
    status: 'complete',
    ...overrides,
  } as SeerAutomationRun['executions'][number];
}

function makeInvestigation(id: string, title: string) {
  return {type: 'investigation', id, title} as const;
}

function makeFailedRun(message: string, overrides: Partial<SeerAutomationRun> = {}) {
  return makeRun({
    status: 'failed',
    error: {code: 'internal_error', message},
    ...overrides,
  });
}

function makeRunningRun(overrides: Partial<SeerAutomationRun> = {}) {
  return makeRun({status: 'running', dateCompleted: null, ...overrides});
}

type MonitorTrigger = Extract<SeerAutomationRun['trigger'], {type: 'monitor'}>;

function makeMonitorTrigger(overrides: Partial<MonitorTrigger> = {}): MonitorTrigger {
  return {
    detectorId: '5',
    detectorName: 'Checkout latency',
    environment: 'production',
    eventId: 'abc',
    groupExists: true,
    groupId: '4388',
    observedAt: '2026-04-20T00:00:00Z',
    occurrenceId: 'def',
    projectId: '2',
    type: 'monitor',
    ...overrides,
  };
}

describe('RunsTable', () => {
  const organization = OrganizationFixture({features: ['seer-automations']});
  const runsUrl = `/organizations/${organization.slug}/seer/workflows/runs/`;
  const runsPath = `/organizations/${organization.slug}/seer/automations/runs/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders a row per run', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({
            id: '12',
            configId: '7',
            configName: 'Checkout health',
            strategy: 'breached_metric_investigation',
          }),
          makeFailedRun('Boom', {id: '11', configId: '8'}),
        ],
      },
    });

    render(<RunsTable />, {organization});

    expect(await screen.findByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
    expect(screen.getByText('#12')).toBeInTheDocument();
    expect(screen.getAllByText('took 1min')).toHaveLength(2);
    expect(await screen.findByRole('link', {name: 'Checkout health'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/seer/automations/7/`
    );
    expect(screen.getByRole('link', {name: 'Agentic triage'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/seer/automations/8/`
    );
  });

  it('links a single investigation in the result column', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({
            executions: [
              makeExecution({
                outputs: [makeInvestigation('2307', 'Latency spike')],
              }),
            ],
          }),
        ],
      },
    });

    render(<RunsTable />, {organization});

    expect(await screen.findByRole('link', {name: 'Latency spike'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/seer/investigations/2307/`
    );
    expect(screen.getByText('INV-2307')).toBeInTheDocument();
  });

  it('collapses several investigations into a count that lists them on hover', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({
            executions: [
              makeExecution({
                id: '1',
                outputs: [makeInvestigation('2307', 'Latency spike')],
              }),
              makeExecution({
                id: '2',
                outputs: [makeInvestigation('2308', 'Error burst')],
              }),
            ],
          }),
        ],
      },
    });

    render(<RunsTable />, {organization});

    expect(await screen.findByText('2 investigations')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Latency spike'})).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('2 investigations'));

    expect(await screen.findByRole('link', {name: 'Latency spike'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/seer/investigations/2307/`
    );
    expect(screen.getByRole('link', {name: 'Error burst'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/seer/investigations/2308/`
    );
  });

  it('says when a run has no output', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({id: '1', executions: [makeExecution()]}),
          makeRunningRun({id: '2'}),
        ],
      },
    });

    render(<RunsTable />, {organization});

    expect(await screen.findByText('No output')).toBeInTheDocument();
    expect(screen.getByText('Investigating…')).toBeInTheDocument();
  });

  it('shows a failed run with finished executions as incomplete', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({
            status: 'failed',
            error: null,
            executions: [
              makeExecution({id: '1'}),
              makeExecution({
                id: '2',
                status: 'failed',
                error: {code: 'seer_timeout', message: 'Seer timed out'},
              }),
            ],
          }),
        ],
      },
    });

    render(<RunsTable />, {organization});

    expect(await screen.findByText('Incomplete')).toBeInTheDocument();
    expect(screen.getByText('Seer timed out')).toBeInTheDocument();
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
  });

  it('links to the monitor and issue that triggered a run', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({id: '1', trigger: makeMonitorTrigger()}),
          // The monitor has since been deleted
          makeRun({
            id: '2',
            trigger: makeMonitorTrigger({
              detectorId: '6',
              detectorName: null,
              environment: null,
              groupId: '4389',
              groupShortId: 'CHECKOUT-2',
            }),
          }),
        ],
      },
    });

    render(<RunsTable />, {organization});

    expect(await screen.findByRole('link', {name: 'Checkout latency'})).toHaveAttribute(
      'href',
      makeMonitorDetailsPathname(organization.slug, '5')
    );
    expect(screen.getByRole('link', {name: 'issue:4388'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/4388/`
    );
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('Monitor 6')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'CHECKOUT-2'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/4389/`
    );
  });

  it('describes triggers without a monitor', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({id: '1', trigger: {type: 'cron'}}),
          makeRun({
            id: '2',
            // A type the frontend doesn't know about yet
            trigger: {
              type: 'custom_trigger-type',
            } as unknown as SeerAutomationRun['trigger'],
          }),
        ],
      },
    });

    render(<RunsTable />, {organization});

    expect(await screen.findByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Custom Trigger Type')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /issue:/})).not.toBeInTheDocument();
  });

  it('leaves the automation out when showStrategy is false', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {runs: [makeRun({strategy: 'breached_metric_investigation'})]},
    });

    render(<RunsTable showStrategy={false} />, {organization});

    expect(await screen.findByText('Succeeded')).toBeInTheDocument();
    expect(screen.queryByText('Automation')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'Breached metrics'})
    ).not.toBeInTheDocument();
    // Status, result, trigger, started
    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(4);
    expect(cells[2]).toHaveTextContent('—');
  });

  it('shows a dash in the status cell for runs without a status', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {runs: [makeRun({status: null})]},
    });

    render(<RunsTable />, {organization});

    expect(await screen.findByText('No output')).toBeInTheDocument();
    const [statusCell] = screen.getAllByRole('cell');
    expect(statusCell).toHaveTextContent('—');
  });

  it('shows an empty state when there are no runs', async () => {
    MockApiClient.addMockResponse({url: runsUrl, body: {runs: []}});

    render(<RunsTable />, {organization});

    expect(await screen.findByText('No runs yet')).toBeInTheDocument();
  });

  it('pages through runs with the cursor', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {runs: [makeFailedRun('Newer run', {id: '2'})]},
      headers: {
        Link:
          `<${runsUrl}?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ` +
          `<${runsUrl}?cursor=0:1:0>; rel="next"; results="true"; cursor="0:1:0"`,
      },
    });
    const nextPageRequest = MockApiClient.addMockResponse({
      url: runsUrl,
      body: {runs: [makeFailedRun('Older run', {id: '1'})]},
      match: [MockApiClient.matchQuery({cursor: '0:1:0'})],
    });

    const {router} = render(<RunsTable />, {
      organization,
      initialRouterConfig: {location: {pathname: runsPath}},
    });

    expect(await screen.findByText('Newer run')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(router.location.query.cursor).toBe('0:1:0');
    expect(await screen.findByText('Older run')).toBeInTheDocument();
    expect(nextPageRequest).toHaveBeenCalled();
  });

  it('filters runs to a config', async () => {
    const request = MockApiClient.addMockResponse({
      url: runsUrl,
      body: {runs: [makeRun({id: '3', configId: '7'})]},
      match: [MockApiClient.matchQuery({config: '7', per_page: 20})],
    });

    render(<RunsTable configId="7" />, {organization});

    expect(await screen.findByText('Succeeded')).toBeInTheDocument();
    expect(request).toHaveBeenCalled();
  });

  it('shows an error with retry when the first load fails', async () => {
    MockApiClient.addMockResponse({url: runsUrl, statusCode: 500});

    render(<RunsTable />, {organization});

    expect(await screen.findByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });

  describe('polling', () => {
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

    it('keeps showing runs when a poll fails', async () => {
      MockApiClient.addMockResponse({url: runsUrl, body: {runs: [makeRunningRun()]}});

      render(<RunsTable />, {organization});
      expect(await screen.findByText('Investigating…')).toBeInTheDocument();

      MockApiClient.clearMockResponses();
      const pollRequest = MockApiClient.addMockResponse({url: runsUrl, statusCode: 500});
      act(() => jest.advanceTimersByTime(5000));

      await waitFor(() => expect(pollRequest).toHaveBeenCalled());
      expect(screen.getByText('Investigating…')).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    });
  });
});
