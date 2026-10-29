import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {RunsTable} from 'sentry/views/seerWorkflows/automations/runs/runsTable';
import type {SeerAutomationRun} from 'sentry/views/seerWorkflows/types';

// TEMPORARY: exercise the runs API instead of placeholder runs
jest.mock('sentry/views/seerWorkflows/automations/runs/placeholderRuns', () => ({
  ...jest.requireActual('sentry/views/seerWorkflows/automations/runs/placeholderRuns'),
  USE_PLACEHOLDER_RUNS: false,
}));

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
    ...overrides,
  } as SeerAutomationRun;
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
          makeRun({id: '12', strategy: 'breached_metrics'}),
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
});
