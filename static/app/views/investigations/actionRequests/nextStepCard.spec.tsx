import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import InvestigationDetailView from 'sentry/views/investigations/detail';
import {
  InvestigationActionRequestFixture,
  InvestigationBreachedMetricDetailFixture,
  InvestigationOrchestrationFixture,
} from 'sentry/views/investigations/fixtures';
import type {
  InvestigationOrchestration,
  InvestigationActionRequest,
} from 'sentry/views/investigations/types';

const organization = OrganizationFixture({
  features: ['investigations'],
  openMembership: true,
});
const detailUrl = '/organizations/org-slug/investigations/investigation-1/';
const orchestrationUrl = `${detailUrl}orchestration/`;
const initialRouterConfig = {
  location: {
    pathname: '/organizations/org-slug/explore/investigations/investigation-1/',
  },
  route: '/organizations/:orgId/explore/investigations/:investigationId/',
};

const completedRun = InvestigationOrchestrationFixture({
  phase: 'completed',
  status: 'completed',
});

const latencyMonitor = {
  id: '789',
  name: 'Cart p95 latency',
  aggregate: 'p95(span.duration)',
  query: 'transaction:/api/cart',
  environment: 'production',
  detectionType: 'static',
  comparisonDeltaSeconds: null,
  conditions: [
    {type: 'gt', comparison: 800, result: 75},
    {type: 'lte', comparison: 800, result: 0},
  ],
};

function investigationWith(
  actionRequests: InvestigationActionRequest[],
  monitor: Record<string, unknown> = latencyMonitor
) {
  return InvestigationBreachedMetricDetailFixture({
    id: 'investigation-1',
    orchestration: {
      phase: 'completed',
      status: 'completed',
      heartbeatAt: null,
      notebookRevision: 5,
    },
    source: {
      type: 'metric_open_period',
      ref: {groupId: '123', openPeriodId: '456'},
      revision: null,
      snapshot: {monitor, project: {id: '1', slug: 'checkout-api'}},
    },
    actionRequests,
  });
}

function mockPage(
  actionRequests: InvestigationActionRequest[],
  {
    monitor,
    orchestration = completedRun,
  }: {
    monitor?: Record<string, unknown>;
    orchestration?: InvestigationOrchestration;
  } = {}
) {
  MockApiClient.addMockResponse({
    url: detailUrl,
    body: investigationWith(actionRequests, monitor),
  });
  MockApiClient.addMockResponse({url: orchestrationUrl, body: orchestration});
}

function renderPage() {
  return render(<InvestigationDetailView />, {organization, initialRouterConfig});
}

describe('NextStepCard', () => {
  beforeEach(() => {
    jest.spyOn(indicators, 'addSuccessMessage').mockImplementation();
    jest.spyOn(indicators, 'addErrorMessage').mockImplementation();
    MockApiClient.addMockResponse({url: `${detailUrl}comment-counts/`, body: {}});
    MockApiClient.addMockResponse({url: `${detailUrl}comments/`, body: []});
    MockApiClient.addMockResponse({
      url: `${detailUrl}presence/`,
      method: 'PUT',
      body: {viewers: [], total: 0, heartbeatIntervalMs: 5000},
    });
  });

  it('renders the primary request', async () => {
    mockPage([
      InvestigationActionRequestFixture({
        id: '313',
        key: 'instrument-retries',
        primary: false,
        title: 'Instrument checkout retries',
        action: null,
      }),
      InvestigationActionRequestFixture(),
    ]);
    renderPage();

    const card = await screen.findByRole('region', {name: 'Recommended action'});
    expect(card).toHaveTextContent('Widen the interval.');
    expect(card).toHaveTextContent(
      'The 5 minute window fires on single deploy spikes that recover within a minute.'
    );
    expect(card).toHaveTextContent('Would have suppressed 4 of the last 5 alerts.');
    expect(card).not.toHaveTextContent('Instrument checkout retries');
  });

  it('renders advice without an action as text only', async () => {
    mockPage([
      InvestigationActionRequestFixture({
        title: 'Instrument checkout retries',
        impact: 'Confirms the timeout cause next time.',
        action: null,
      }),
    ]);
    renderPage();

    const card = await screen.findByRole('region', {name: 'Recommended action'});
    expect(card).toHaveTextContent('Instrument checkout retries.');
    expect(card).toHaveTextContent('Confirms the timeout cause next time.');
  });

  it('renders nothing without a next step', async () => {
    mockPage([]);
    renderPage();

    expect(await screen.findByTestId('investigation-summary')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });

  it('renders text from Seer as plain text', async () => {
    mockPage([
      InvestigationActionRequestFixture({
        title: '**Widen** [the interval](https://example.com)',
        rationale: '<b>Spikes</b> recover _fast_',
        impact: '[Click here](https://example.com)',
      }),
    ]);
    renderPage();

    const card = await screen.findByRole('region', {name: 'Recommended action'});
    expect(card).toHaveTextContent('**Widen** [the interval](https://example.com).');
    expect(card).toHaveTextContent('<b>Spikes</b> recover _fast_');
    expect(card).toHaveTextContent('[Click here](https://example.com)');
    expect(
      within(card).queryByRole('link', {name: /interval|Click here/})
    ).not.toBeInTheDocument();
  });

  it('collapses a request Seer withdrew to its reason', async () => {
    mockPage([
      InvestigationActionRequestFixture({
        state: 'withdrawn',
        reason: 'The spikes are real breaches.',
      }),
    ]);
    renderPage();

    const card = await screen.findByRole('region', {name: 'Recommended action'});
    expect(card).toHaveTextContent(
      'Seer no longer recommends “Widen the interval”: The spikes are real breaches.'
    );
  });
});
