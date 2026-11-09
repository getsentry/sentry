import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {SeerAutomationRun} from 'sentry/views/seerWorkflows/types';

import {RunsTable} from './runsTable';

function makeRun(overrides: Partial<SeerAutomationRun>): SeerAutomationRun {
  return {
    id: '1',
    configId: '1',
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
  overrides: Partial<SeerAutomationRun['executions'][number]>
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
          makeRun({id: '12', strategy: 'breached_metric_investigation'}),
          makeRun({
            id: '11',
            status: 'failed',
            error: {code: 'internal_error', message: 'Boom'},
          }),
        ],
      },
    });

    render(<RunsTable />, {organization});

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('Breached metrics')).toBeInTheDocument();
    expect(screen.getByText('Agentic triage')).toBeInTheDocument();
  });

  it('lists investigations from every execution in the output column', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({
            executions: [
              makeExecution({
                id: '1',
                outputs: [{type: 'investigation', id: '2307', title: 'Latency spike'}],
              }),
              makeExecution({
                id: '2',
                outputs: [{type: 'investigation', id: '2308', title: 'Error burst'}],
              }),
            ],
          }),
        ],
      },
    });

    render(<RunsTable />, {organization});

    expect(
      await screen.findByRole('link', {name: 'INV-2307 | Latency spike'})
    ).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/seer/investigations/2307/`
    );
    expect(screen.getByRole('link', {name: 'INV-2308 | Error burst'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/seer/investigations/2308/`
    );
  });

  it('shows a dash when a run has no outputs', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {runs: [makeRun({executions: [makeExecution({outputs: []})]})]},
    });

    render(<RunsTable />, {organization});

    expect(await screen.findByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /INV-/})).not.toBeInTheDocument();
  });

  it('links to the triggering issue under the strategy', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({
            strategy: 'breached_metric_investigation',
            trigger: {
              detectorId: '5',
              environment: null,
              eventId: 'abc',
              groupId: '4388',
              observedAt: '2026-04-20T00:00:00Z',
              occurrenceId: 'def',
              projectId: '2',
              type: 'monitor',
            },
          }),
        ],
      },
    });

    render(<RunsTable />, {organization});

    expect(await screen.findByText('Breached metrics')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'issue:4388'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/4388/`
    );
  });

  it('shows only the strategy when a run has no trigger', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {runs: [makeRun({strategy: 'breached_metric_investigation', trigger: null})]},
    });

    render(<RunsTable />, {organization});

    expect(await screen.findByText('Breached metrics')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /issue:/})).not.toBeInTheDocument();
  });

  it('shows the formatted trigger type for triggers without an issue', async () => {
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

    expect(await screen.findByText('Cron')).toBeInTheDocument();
    expect(screen.getByText('Custom Trigger Type')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: /issue:/})).not.toBeInTheDocument();
  });

  it('hides the strategy in the trigger column when showStrategy is false', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({
            id: '9',
            strategy: 'breached_metric_investigation',
            trigger: {
              detectorId: '5',
              environment: null,
              eventId: 'abc',
              groupId: '4388',
              observedAt: '2026-04-20T00:00:00Z',
              occurrenceId: 'def',
              projectId: '2',
              type: 'monitor',
            },
          }),
        ],
      },
    });

    render(<RunsTable showStrategy={false} />, {organization});

    expect(await screen.findByRole('link', {name: 'issue:4388'})).toBeInTheDocument();
    expect(screen.queryByText('Breached metrics')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no runs', async () => {
    MockApiClient.addMockResponse({url: runsUrl, body: {runs: []}});

    render(<RunsTable />, {organization});

    expect(await screen.findByText('No runs yet.')).toBeInTheDocument();
  });

  it('pages through runs with the cursor', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {runs: [makeRun({id: '2'})]},
      headers: {
        Link:
          `<${runsUrl}?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ` +
          `<${runsUrl}?cursor=0:1:0>; rel="next"; results="true"; cursor="0:1:0"`,
      },
    });
    const nextPageRequest = MockApiClient.addMockResponse({
      url: runsUrl,
      body: {runs: [makeRun({id: '1'})]},
      match: [MockApiClient.matchQuery({cursor: '0:1:0'})],
    });

    const {router} = render(<RunsTable />, {
      organization,
      initialRouterConfig: {location: {pathname: runsPath}},
    });

    expect(await screen.findByText('2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(router.location.query.cursor).toBe('0:1:0');
    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(nextPageRequest).toHaveBeenCalled();
  });

  it('filters runs to a config', async () => {
    const request = MockApiClient.addMockResponse({
      url: runsUrl,
      body: {runs: [makeRun({id: '3', configId: '7'})]},
      match: [MockApiClient.matchQuery({config: '7', per_page: 20})],
    });

    render(<RunsTable configId="7" />, {organization});

    expect(await screen.findByText('3')).toBeInTheDocument();
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
      MockApiClient.addMockResponse({
        url: runsUrl,
        body: {runs: [makeRun({id: '5', status: 'running', dateCompleted: null})]},
      });

      render(<RunsTable />, {organization});
      expect(await screen.findByText('5')).toBeInTheDocument();

      MockApiClient.clearMockResponses();
      const pollRequest = MockApiClient.addMockResponse({url: runsUrl, statusCode: 500});
      act(() => jest.advanceTimersByTime(5000));

      await waitFor(() => expect(pollRequest).toHaveBeenCalled());
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    });
  });
});
