import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {RunsTable} from 'sentry/views/seerWorkflows/automations/runs/runsTable';
import type {SeerAutomationRun} from 'sentry/views/seerWorkflows/types';

function makeRun(overrides: Partial<SeerAutomationRun>): SeerAutomationRun {
  return {
    id: '1001',
    configId: '1',
    dateAdded: '2026-10-25T12:30:00Z',
    dateUpdated: '2026-10-25T12:35:00Z',
    dateCompleted: '2026-10-25T12:35:00Z',
    executions: [],
    status: 'complete',
    ...overrides,
  } as SeerAutomationRun;
}

function getRow(runId: string) {
  return screen.getByText(runId).closest<HTMLElement>('[role="row"]')!;
}

describe('RunsTable', () => {
  const organization = OrganizationFixture({features: ['seer-automations']});
  const runsUrl = `/organizations/${organization.slug}/seer/workflows/runs/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows the id, date, and status of each run', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({id: '1001', status: 'complete'}),
          makeRun({
            id: '1002',
            status: 'failed',
            error: {code: 'seer_error', message: 'Seer failed'},
          }),
        ],
      },
    });

    render(<RunsTable />, {organization});

    expect(await screen.findByText('1001')).toBeInTheDocument();
    expect(within(getRow('1001')).getByText('Oct 25 12:30')).toBeInTheDocument();
    expect(within(getRow('1001')).getByLabelText('Succeeded')).toBeInTheDocument();
    expect(within(getRow('1002')).getByLabelText('Failed')).toBeInTheDocument();
  });

  it('shows dashes for details the API does not return', async () => {
    MockApiClient.addMockResponse({url: runsUrl, body: {runs: [makeRun({id: '1001'})]}});

    render(<RunsTable />, {organization});

    await screen.findByText('1001');
    // Output, trigger, and usage
    expect(within(getRow('1001')).getAllByText('—')).toHaveLength(3);
  });

  it('orders runs newest first', async () => {
    MockApiClient.addMockResponse({
      url: runsUrl,
      body: {
        runs: [
          makeRun({id: '1001', dateAdded: '2026-10-24T00:00:00Z'}),
          makeRun({id: '1002', dateAdded: '2026-10-26T00:00:00Z'}),
        ],
      },
    });

    render(<RunsTable />, {organization});

    const newer = await screen.findByText('1002');
    const older = screen.getByText('1001');
    expect(
      newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('only requests runs for the given automation', async () => {
    const request = MockApiClient.addMockResponse({
      url: runsUrl,
      body: {runs: [makeRun({id: '1001', configId: '42'})]},
      match: [MockApiClient.matchQuery({config: '42'})],
    });

    render(<RunsTable configId="42" />, {organization});

    expect(await screen.findByText('1001')).toBeInTheDocument();
    expect(request).toHaveBeenCalled();
  });

  it('shows an error with a retry when runs fail to load', async () => {
    MockApiClient.addMockResponse({url: runsUrl, statusCode: 500, body: {}});

    render(<RunsTable />, {organization});

    expect(await screen.findByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });

  it('does not request runs without seer-automations', () => {
    const request = MockApiClient.addMockResponse({url: runsUrl, body: {runs: []}});

    render(<RunsTable />, {organization: OrganizationFixture()});

    expect(request).not.toHaveBeenCalled();
  });
});
