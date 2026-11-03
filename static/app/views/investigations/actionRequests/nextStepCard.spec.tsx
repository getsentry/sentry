import {focusManager, QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {
  getPrimaryActionRequest,
  NextStepCard,
} from 'sentry/views/investigations/actionRequests/nextStepCard';
import {
  getInvestigationDetailQueryOptions,
  type ActionRequestFollowUp,
} from 'sentry/views/investigations/api';
import {
  InvestigationActionRequestFixture,
  InvestigationDetailFixture,
  InvestigationOrchestrationFixture,
} from 'sentry/views/investigations/fixtures';
import type {
  InvestigationAction,
  InvestigationActionRequest,
  InvestigationDetail,
  InvestigationOrchestration,
  InvestigationUpdateDetectorAction,
} from 'sentry/views/investigations/types';
import {
  SeerExplorerContext,
  useSeerExplorerContext,
} from 'sentry/views/seerExplorer/useSeerExplorerContext';

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

function sourceWith(monitor: Record<string, unknown> = latencyMonitor) {
  return {
    type: 'metric_open_period',
    ref: {groupId: '123', openPeriodId: '456'},
    revision: null,
    snapshot: {monitor, project: {id: '1', slug: 'checkout-api'}},
  } satisfies InvestigationDetail['source'];
}

function changeOf(
  before: InvestigationUpdateDetectorAction['before'],
  changes: InvestigationUpdateDetectorAction['changes']
): InvestigationUpdateDetectorAction {
  return {kind: 'update_detector', detectorId: '789', before, changes};
}

const completedRun = InvestigationOrchestrationFixture({
  phase: 'completed',
  status: 'completed',
});

function runWith(
  nextStep: NonNullable<InvestigationOrchestration['report']['nextStep']>,
  overrides: Partial<InvestigationOrchestration> = {},
  report: Partial<InvestigationOrchestration['report']> = {}
) {
  return InvestigationOrchestrationFixture({
    ...completedRun,
    ...overrides,
    report: {...completedRun.report, ...report, nextStep},
  });
}

const staleRequest = InvestigationActionRequestFixture({
  state: 'superseded',
  canApply: false,
  cannotApplyReason: 'not_suggested',
  error: {code: 'stale', current: {timeWindowSeconds: 600}},
});

const staleBody = {
  code: 'stale',
  detail: 'This changed since Seer suggested it.',
  current: {timeWindowSeconds: 600},
};

const finishingRun = runWith(
  {status: 'generating', error: null},
  {phase: 'metadata', status: 'processing'},
  {status: 'completed'}
);

const rerunningRun = runWith(
  {status: 'not_started', error: null},
  {phase: 'investigating', status: 'processing'},
  {revision: completedRun.report.revision + 1}
);

function connectRequest(overrides: Partial<InvestigationActionRequest> = {}) {
  return InvestigationActionRequestFixture({
    title: 'Connect Datadog',
    rationale: 'Checkout logs live in Datadog.',
    impact: null,
    action: {kind: 'connect_telemetry', provider: 'datadog'},
    ...overrides,
  });
}

const notConnectedBody = {
  detail: "The change wasn't valid.",
  code: 'validation_failed',
  messages: ["This provider isn't connected yet."],
};

function connectedRequest(followUp: InvestigationActionRequest['followUp']) {
  return connectRequest({
    state: 'applied',
    canApply: false,
    cannotApplyReason: 'not_suggested',
    dateApplied: '2026-08-27T12:00:00Z',
    appliedDetails: {provider: 'datadog'},
    followUp,
  });
}

const applyUrl =
  '/organizations/org-slug/notebooks/investigation-1/action-requests/312/apply/';
const recheckUrl =
  '/organizations/org-slug/notebooks/investigation-1/action-requests/312/recheck/';
const retryFollowUpUrl =
  '/organizations/org-slug/notebooks/investigation-1/action-requests/312/retry-follow-up/';

type MockResponse = Parameters<typeof MockApiClient.addMockResponse>[0];

function mockApply(response: MockResponse) {
  return MockApiClient.addMockResponse({
    url: applyUrl,
    method: 'POST',
    match: [(_url, options) => !options.data?.dryRun],
    ...response,
  });
}

function mockDryRun(response: MockResponse = {}) {
  return MockApiClient.addMockResponse({
    url: applyUrl,
    method: 'POST',
    match: [MockApiClient.matchData({dryRun: true})],
    body: {actionRequest: InvestigationActionRequestFixture()},
    ...response,
  });
}

function getCard() {
  return screen.getByRole('region', {name: 'Recommended action'});
}

async function findApplyButton() {
  const button = screen.getByRole('button', {name: 'Update monitor'});
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe('NextStepCard', () => {
  beforeEach(() => {
    mockDryRun();
  });

  afterEach(() => {
    focusManager.setFocused(undefined);
  });

  it('renders the primary request', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            id: '313',
            key: 'instrument-retries',
            primary: false,
            title: 'Instrument checkout retries',
            action: null,
          }),
          InvestigationActionRequestFixture(),
        ]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent('Widen the interval.');
    expect(card).toHaveTextContent(
      'The 5 minute window fires on single deploy spikes that recover within a minute.'
    );
    expect(card).toHaveTextContent('Would have suppressed 4 of the last 5 alerts.');
    expect(card).toHaveTextContent(
      'IntervalCurrent value: 5 minutes → , suggested value: 15 minutes'
    );
    expect(card).not.toHaveTextContent('Instrument checkout retries');
  });

  it('describes cleared filters, all environments and thresholds', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            action: {
              kind: 'update_detector',
              detectorId: '789',
              before: {query: '', environment: 'production', highThreshold: 1200},
              changes: {query: 'level:error', environment: null, highThreshold: 1500},
            },
          }),
        ]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent(
      'QueryCurrent value: No filter → , suggested value: level:error'
    );
    expect(card).toHaveTextContent(
      'EnvironmentCurrent value: production → , suggested value: All environments'
    );
    expect(card).toHaveTextContent(
      'High thresholdCurrent value: 1200 → , suggested value: 1500'
    );
  });

  it('renders advice without an action as text only', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            title: 'Instrument checkout retries',
            impact: 'Confirms the timeout cause next time.',
            action: null,
          }),
        ]}
      />
    );

    expect(getCard()).toHaveTextContent('Instrument checkout retries.');
    expect(getCard()).toHaveTextContent('Confirms the timeout cause next time.');
    expect(within(getCard()).queryByText('Interval')).not.toBeInTheDocument();
  });

  it('does not add a period after closing punctuation', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            title: 'Widen the interval (to 15 minutes).',
          }),
        ]}
      />
    );

    expect(getCard()).toHaveTextContent('Widen the interval (to 15 minutes). The 5');
  });

  it('renders nothing without a primary request', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture({primary: false})]}
      />
    );

    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });

  it('only shows a primary from the newest report', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={runWith({status: 'completed', error: null}, {}, {revision: 3})}
        actionRequests={[
          InvestigationActionRequestFixture({
            id: '314',
            key: 'check-retries',
            reportRevision: 3,
            primary: false,
            anchor: {type: 'hypothesis', id: 'h-1', blockId: null},
          }),
          InvestigationActionRequestFixture({
            reportRevision: 2,
            state: 'withdrawn',
            reason: 'The spikes are real breaches.',
          }),
        ]}
      />
    );

    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });

  it('renders nothing for a state it does not know', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture({state: 'archived'})]}
      />
    );

    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });

  it('renders text from Seer as plain text', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            title: '**Widen** [the interval](https://example.com)',
            rationale: '<b>Spikes</b> recover _fast_',
            impact: '[Click here](https://example.com)',
          }),
        ]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent('**Widen** [the interval](https://example.com).');
    expect(card).toHaveTextContent('<b>Spikes</b> recover _fast_');
    expect(card).toHaveTextContent('[Click here](https://example.com)');
    expect(
      within(card).queryByRole('link', {name: /interval|Click here/})
    ).not.toBeInTheDocument();
  });

  it('collapses a request Seer withdrew to its reason', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            state: 'withdrawn',
            reason: 'The spikes are real breaches.',
          }),
        ]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent(
      'Seer no longer recommends “Widen the interval”: The spikes are real breaches.'
    );
    expect(card).not.toHaveTextContent('The 5 minute window fires');
    expect(card).not.toHaveTextContent('Would have suppressed');
    expect(within(card).queryByText('Interval')).not.toBeInTheDocument();
  });

  it('collapses a withdrawn request without a reason to its title', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture({state: 'withdrawn'})]}
      />
    );

    expect(getCard()).toHaveTextContent(
      'Seer no longer recommends “Widen the interval”.'
    );
  });

  it('holds space while the next step generates', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        actionRequests={[]}
        orchestration={runWith(
          {status: 'generating', error: null},
          {phase: 'metadata', status: 'processing'}
        )}
      />
    );

    expect(getCard()).toHaveAttribute('aria-busy', 'true');
  });

  it('holds space before the next step starts', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        actionRequests={[]}
        orchestration={runWith(
          {status: 'not_started', error: null},
          {phase: 'metadata', status: 'processing'}
        )}
      />
    );

    expect(getCard()).toHaveAttribute('aria-busy', 'true');
  });

  it('holds space for a completed next step until its request arrives', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        actionRequests={[]}
        actionRequestsStale
        orchestration={runWith({status: 'completed', error: null})}
      />
    );

    expect(getCard()).toHaveAttribute('aria-busy', 'true');
  });

  it('renders nothing for a completed next step that suggested nothing', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        actionRequests={[]}
        orchestration={runWith({status: 'completed', error: null})}
      />
    );

    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });

  it('renders nothing while the run is loading', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        actionRequests={[InvestigationActionRequestFixture()]}
        orchestration={undefined}
        orchestrationLoading
      />
    );

    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });

  it('shows the newest primary over one Seer withdrew', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            id: '311',
            key: 'old-primary',
            state: 'withdrawn',
            title: 'Raise the threshold',
            reason: 'The spikes are real breaches.',
          }),
          InvestigationActionRequestFixture(),
        ]}
      />
    );

    expect(getCard()).toHaveTextContent('Widen the interval.');
    expect(getCard()).not.toHaveTextContent('no longer recommends');
  });

  it('still counts an applied primary as the next step', () => {
    const applied = InvestigationActionRequestFixture({id: '313', state: 'applied'});

    expect(
      getPrimaryActionRequest([InvestigationActionRequestFixture(), applied], undefined)
    ).toBe(applied);
  });

  it('shows the live primary over a newer one Seer replaced', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture(),
          InvestigationActionRequestFixture({
            id: '313',
            key: 'raise-threshold',
            state: 'superseded',
            title: 'Raise the threshold',
          }),
        ]}
      />
    );

    expect(getCard()).toHaveTextContent('Widen the interval.');
  });

  it('holds space for a new next step over a withdrawn one', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        actionRequests={[
          InvestigationActionRequestFixture({
            reportRevision: 1,
            state: 'withdrawn',
            reason: 'The spikes are real breaches.',
          }),
        ]}
        orchestration={runWith(
          {status: 'generating', error: null},
          {phase: 'metadata', status: 'processing'}
        )}
      />
    );

    expect(getCard()).toHaveAttribute('aria-busy', 'true');
    expect(getCard()).not.toHaveTextContent('no longer recommends');
  });

  it('explains a next step that failed', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        actionRequests={[]}
        orchestration={runWith({status: 'failed', error: null})}
      />
    );

    expect(getCard()).toHaveTextContent(
      'Seer could not suggest a next step for this investigation.'
    );
  });

  it('hides an old primary while a new report is written', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        actionRequests={[
          InvestigationActionRequestFixture({
            reportRevision: 2,
            state: 'withdrawn',
            reason: 'The spikes are real breaches.',
          }),
        ]}
        orchestration={runWith(
          {status: 'not_started', error: null},
          {phase: 'reporting', status: 'processing'},
          {status: 'composing', revision: 3}
        )}
      />
    );

    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });

  it('names the monitor and what it measures', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith()}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    const card = getCard();
    expect(within(card).getByText('Cart p95 latency')).toBeInTheDocument();
    expect(within(card).getByText('checkout-api • production')).toBeInTheDocument();
    expect(
      within(card).getByText('p95(span.duration) • transaction:/api/cart')
    ).toBeInTheDocument();
    expect(card).toHaveTextContent('Opens an issueAbove 800ms');
  });

  it('formats static thresholds with the aggregate unit', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith()}
        actionRequests={[
          InvestigationActionRequestFixture({
            action: changeOf(
              {highThreshold: 650, resolutionThreshold: 650},
              {highThreshold: 800, resolutionThreshold: 800}
            ),
          }),
        ]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent(
      'High thresholdCurrent value: 650ms → , suggested value: 800ms'
    );
    expect(card).toHaveTextContent(
      'Resolution thresholdCurrent value: 650ms → , suggested value: 800ms'
    );
    expect(within(card).queryByText('Opens an issue')).not.toBeInTheDocument();
  });

  it('formats each threshold with its own aggregate unit', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith()}
        actionRequests={[
          InvestigationActionRequestFixture({
            action: changeOf(
              {aggregate: 'p95(span.duration)', highThreshold: 800},
              {aggregate: 'count()', highThreshold: 50}
            ),
          }),
        ]}
      />
    );

    expect(getCard()).toHaveTextContent(
      'High thresholdCurrent value: 800ms → , suggested value: 50'
    );
    expect(getCard()).not.toHaveTextContent('50ms');
  });

  it('does not describe the opening condition when the aggregate changes', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith()}
        actionRequests={[
          InvestigationActionRequestFixture({
            action: changeOf(
              {aggregate: 'p95(span.duration)'},
              {aggregate: 'p99(span.duration)'}
            ),
          }),
        ]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent(
      'AggregateCurrent value: p95(span.duration) → , suggested value: p99(span.duration)'
    );
    expect(within(card).queryByText('Opens an issue')).not.toBeInTheDocument();
  });

  it('formats percent thresholds like the monitor page', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith({
          ...latencyMonitor,
          detectionType: 'percent',
          comparisonDeltaSeconds: 3600,
          conditions: [{type: 'gt', comparison: 110, result: 75}],
        })}
        actionRequests={[
          InvestigationActionRequestFixture({
            action: changeOf({highThreshold: 110}, {highThreshold: 60}),
          }),
        ]}
      />
    );

    expect(getCard()).toHaveTextContent(
      'High thresholdCurrent value: 10% higher → , suggested value: 40% lower'
    );
  });

  it('describes the condition that opens an issue for a percent monitor', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith({
          ...latencyMonitor,
          detectionType: 'percent',
          comparisonDeltaSeconds: 3600,
          conditions: [
            {type: 'gt', comparison: 125, result: 75},
            {type: 'gt', comparison: 110, result: 50},
          ],
        })}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    expect(
      within(getCard()).getByText('10% higher than the previous 1 hour')
    ).toBeInTheDocument();
  });

  it('describes the opening condition from a snapshot without a detection type', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith({...latencyMonitor, detectionType: undefined})}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    expect(getCard()).toHaveTextContent('Opens an issueAbove 800ms');
  });

  it('reads a percent monitor from a snapshot without a detection type', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith({
          ...latencyMonitor,
          detectionType: undefined,
          comparisonDeltaSeconds: 3600,
          conditions: [{type: 'gt', comparison: 110, result: 75}],
        })}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    expect(
      within(getCard()).getByText('10% higher than the previous 1 hour')
    ).toBeInTheDocument();
  });

  it('names the monitor without an opening condition for a dynamic monitor', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith({
          ...latencyMonitor,
          detectionType: 'dynamic',
          conditions: [
            {
              type: 'anomaly_detection',
              comparison: {sensitivity: 'medium', seasonality: 'auto', threshold_type: 0},
              result: 75,
            },
          ],
        })}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    const card = getCard();
    expect(within(card).getByText('Cart p95 latency')).toBeInTheDocument();
    expect(within(card).queryByText('Opens an issue')).not.toBeInTheDocument();
  });

  it('skips a condition type it does not know', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith({
          ...latencyMonitor,
          conditions: [{type: 'between', comparison: 800, result: 75}],
        })}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    const card = getCard();
    expect(within(card).getByText('Cart p95 latency')).toBeInTheDocument();
    expect(within(card).queryByText('Opens an issue')).not.toBeInTheDocument();
  });

  it('leaves out monitor details when the snapshot does not parse', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith({id: '789', name: 'Another monitor'})}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    const card = getCard();
    expect(within(card).getByText('Monitor')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('Another monitor');
    expect(within(card).queryByText('Opens an issue')).not.toBeInTheDocument();
    expect(card).toHaveTextContent('15 minutes');
  });

  it('leaves out a different monitor than the one the suggestion changes', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith({...latencyMonitor, id: '42', name: 'Another monitor'})}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    const card = getCard();
    expect(within(card).getByText('Monitor')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('Another monitor');
  });

  it('shows query and environment changes in place of what they replace', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith()}
        actionRequests={[
          InvestigationActionRequestFixture({
            title: 'Exclude handled errors',
            action: changeOf(
              {query: 'transaction:/api/cart', environment: 'production'},
              {query: 'transaction:/api/cart !error.handled:true', environment: null}
            ),
          }),
        ]}
      />
    );

    const card = getCard();
    expect(within(card).getByText('checkout-api')).toBeInTheDocument();
    expect(card).toHaveTextContent(
      'QueryCurrent value: transaction:/api/cart → , suggested value: transaction:/api/cart !error.handled:true'
    );
    expect(card).toHaveTextContent(
      'EnvironmentCurrent value: production → , suggested value: All environments'
    );
    expect(card).toHaveTextContent('Measuresp95(span.duration)');
    expect(card).not.toHaveTextContent('p95(span.duration) • transaction:/api/cart');
  });

  it('applies the change and stores the applied request', async () => {
    const actionRequest = InvestigationActionRequestFixture();
    const applied = InvestigationActionRequestFixture({
      state: 'applied',
      canApply: false,
      cannotApplyReason: 'not_suggested',
    });
    const apply = mockApply({body: {actionRequest: applied}});
    const queryClient = makeTestQueryClient();
    const detailKey = getInvestigationDetailQueryOptions(
      'org-slug',
      'investigation-1'
    ).queryKey;
    queryClient.setQueryData(detailKey, {
      headers: {},
      json: InvestigationDetailFixture({
        id: 'investigation-1',
        version: 4,
        actionRequests: [actionRequest],
      }),
    });
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[actionRequest]}
      />,
      {
        additionalWrapper: ({children}) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    );

    await userEvent.click(await findApplyButton());

    expect(apply).toHaveBeenCalledWith(
      applyUrl,
      expect.objectContaining({method: 'POST', data: {action: actionRequest.action}})
    );
    expect(await screen.findByText('Monitor updated.')).toBeInTheDocument();
    const cached = queryClient.getQueryData(detailKey)?.json;
    expect(cached?.actionRequests).toEqual([applied]);
    expect(cached?.version).toBe(4);
  });

  it('shows the updating state while the change is applied', async () => {
    mockApply({
      body: {actionRequest: InvestigationActionRequestFixture({state: 'applied'})},
      asyncDelay: 1_000_000,
    });
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    await userEvent.click(await findApplyButton());

    expect(await screen.findByRole('button', {name: 'Updating monitor…'})).toBeDisabled();
  });

  it.each([
    {
      status: 500,
      body: {detail: 'Internal Error', errorId: 'abc123'},
      message: 'Unable to apply this change.',
    },
    {
      status: 403,
      body: {detail: "This action can't be applied.", code: 'permission_denied'},
      message: "You don't have permission to edit this monitor.",
    },
  ])('says when an apply fails with $status', async ({status, body, message}) => {
    mockApply({statusCode: status, body});
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    await userEvent.click(await findApplyButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it.each([
    {status: 500, body: {detail: 'Internal Error'}},
    {status: 409, body: {detail: "This action can't be applied.", code: 'not_suggested'}},
  ])('refreshes the investigation when an apply fails with $status', async response => {
    mockApply({statusCode: response.status, body: response.body});
    const queryClient = makeTestQueryClient();
    const detailKey = getInvestigationDetailQueryOptions(
      'org-slug',
      'investigation-1'
    ).queryKey;
    queryClient.setQueryData(detailKey, {
      headers: {},
      json: InvestigationDetailFixture({id: 'investigation-1'}),
    });
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />,
      {
        additionalWrapper: ({children}) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    );

    await userEvent.click(await findApplyButton());

    await waitFor(() =>
      expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true)
    );
  });

  it.each([
    ['permission_denied', "You don't have permission to edit this monitor."],
    ['detector_not_found', 'This monitor is no longer available.'],
    [
      'not_target_detector',
      'This change targets a different monitor than this investigation.',
    ],
    ['dynamic_detector', "Seer can't change dynamic monitors yet."],
    ['investigation_archived', 'Archived investigations are read-only.'],
  ])('says why a %s change cannot apply', (cannotApplyReason, message) => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({canApply: false, cannotApplyReason}),
        ]}
      />
    );

    const button = within(getCard()).getByRole('button', {name: 'Update monitor'});
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(message);
  });

  it('holds the button while the change is checked', () => {
    mockDryRun({asyncDelay: 1_000_000});
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    const button = screen.getByRole('button', {name: 'Update monitor'});
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('checks the change before it is applied', async () => {
    const dryRun = mockDryRun();
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    expect(await findApplyButton()).toBeEnabled();
    expect(dryRun).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      status: 403,
      body: {detail: "This action can't be applied.", code: 'permission_denied'},
      message: "You don't have permission to edit this monitor.",
    },
    {
      status: 400,
      body: {
        detail: "The change wasn't valid.",
        code: 'validation_failed',
        messages: ['Invalid Time Window: 900'],
      },
      message: 'Invalid Time Window: 900.',
    },
  ])(
    'holds the update when the check fails with $body.code',
    async ({status, body, message}) => {
      mockDryRun({statusCode: status, body});
      render(
        <NextStepCard
          investigationId="investigation-1"
          orchestration={completedRun}
          actionRequests={[InvestigationActionRequestFixture()]}
        />
      );

      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(message));
      const button = screen.getByRole('button', {name: 'Update monitor'});
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(message);
    }
  );

  it.each([
    {status: 500, body: {detail: 'Internal Error', errorId: 'abc123'}},
    {status: 409, body: {detail: "This action can't be applied.", code: 'new_reason'}},
  ])('keeps the update available when the check returns $status', async response => {
    mockDryRun({statusCode: response.status, body: response.body});
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        "Couldn't check this change in advance. Applying it checks it again."
      )
    );
    expect(screen.getByRole('button', {name: 'Update monitor'})).toBeEnabled();
  });

  it('checks the change again when Seer changes it', async () => {
    const dryRun = mockDryRun();
    const actionRequest = InvestigationActionRequestFixture();
    const {rerender} = render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[actionRequest]}
      />
    );
    await waitFor(() => expect(dryRun).toHaveBeenCalledTimes(1));

    rerender(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          {
            ...actionRequest,
            action: changeOf({timeWindowSeconds: 300}, {timeWindowSeconds: 1800}),
          },
        ]}
      />
    );

    await waitFor(() => expect(dryRun).toHaveBeenCalledTimes(2));
  });

  it('waits for the new check instead of trusting the old one', async () => {
    mockDryRun();
    const actionRequest = InvestigationActionRequestFixture();
    const {rerender} = render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[actionRequest]}
      />
    );
    await findApplyButton();

    MockApiClient.clearMockResponses();
    mockDryRun({asyncDelay: 50});
    rerender(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          {
            ...actionRequest,
            action: changeOf({timeWindowSeconds: 300}, {timeWindowSeconds: 1800}),
          },
        ]}
      />
    );

    expect(screen.getByRole('button', {name: 'Update monitor'})).toBeDisabled();
    await findApplyButton();
  });

  it('does not check a change the viewer cannot apply', () => {
    const dryRun = mockDryRun();
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            canApply: false,
            cannotApplyReason: 'permission_denied',
          }),
        ]}
      />
    );

    expect(dryRun).not.toHaveBeenCalled();
  });

  it('has no apply button for advice', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            action: null,
            canApply: false,
            cannotApplyReason: 'unsupported_action',
          }),
        ]}
      />
    );

    expect(
      screen.queryByRole('button', {name: 'Update monitor'})
    ).not.toBeInTheDocument();
    expect(getCard()).not.toHaveTextContent("Seer can't apply this kind of change yet.");
  });

  it('says why the check would reject a change', async () => {
    mockDryRun({
      statusCode: 400,
      body: {
        detail: "The change wasn't valid.",
        code: 'validation_failed',
        messages: ['Invalid Time Window: 900', 'A valid number is required.'],
      },
    });
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Invalid Time Window: 900. A valid number is required.'
      )
    );
    expect(screen.getByRole('button', {name: 'Update monitor'})).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows why an apply was rejected and lets the user retry', async () => {
    const apply = mockApply({
      statusCode: 400,
      body: {
        detail: "The change wasn't valid.",
        code: 'validation_failed',
        messages: ['Invalid Time Window: 900'],
      },
    });
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    await userEvent.click(await findApplyButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This change could not be applied. Invalid Time Window: 900.'
    );
    expect(apply).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', {name: 'Update monitor'})).toBeEnabled();
    expect(screen.queryByText("This change wasn't valid.")).not.toBeInTheDocument();
  });

  it('renders the applied change with who applied it', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith()}
        actionRequests={[
          InvestigationActionRequestFixture({
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            appliedBy: {
              id: '2',
              name: 'Grace Hopper',
              email: 'grace@example.com',
              username: 'grace@example.com',
              ip_address: '',
            },
            dateApplied: '2026-08-27T12:00:00Z',
          }),
        ]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent(
      'Monitor updated. Cart p95 latency was changed to the settings below.'
    );
    expect(card).toHaveTextContent(/Applied by Grace Hopper •/);
    expect(card).not.toHaveTextContent('Widen the interval.');
    expect(within(card).getByText('Applied')).toBeInTheDocument();
    expect(within(card).getByText('15 minutes')).toBeInTheDocument();
    expect(within(card).getByText('was 5 minutes')).toBeInTheDocument();
    expect(within(card).getByRole('button', {name: 'View monitor'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/monitors/789/'
    );
    expect(
      within(card).queryByRole('button', {name: 'Update monitor'})
    ).not.toBeInTheDocument();
    expect(card).not.toHaveTextContent('This can no longer be applied.');
  });

  it('says when the viewer applied the change', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            appliedBy: {
              id: ConfigStore.get('user').id,
              name: 'Ada Lovelace',
              email: 'ada@example.com',
              username: 'ada@example.com',
              ip_address: '',
            },
          }),
        ]}
      />
    );

    expect(getCard()).toHaveTextContent('Applied by you');
    expect(getCard()).not.toHaveTextContent('Ada Lovelace');
  });

  it('says a change was applied when nobody is named', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            appliedBy: null,
            dateApplied: '2017-10-17T02:36:20Z',
          }),
        ]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent('Applied 5 minutes ago');
    expect(card).not.toHaveTextContent('Applied by');
  });

  it('offers to connect a provider through its integration settings', async () => {
    const dryRun = mockDryRun({statusCode: 400, body: notConnectedBody});
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[connectRequest()]}
      />
    );

    await waitFor(() => expect(dryRun).toHaveBeenCalled());
    const card = getCard();
    const connect = await within(card).findByRole('button', {
      name: 'Connect Datadog (opens in a new tab)',
    });
    expect(card).toHaveTextContent('Connect Datadog. Checkout logs live in Datadog.');
    expect(connect).toHaveAttribute('href', '/settings/org-slug/integrations/datadog/');
    expect(connect).toHaveAttribute('target', '_blank');
  });

  it.each([
    ['permission_denied', 'You need permission to install integrations.'],
    ['investigation_archived', 'Archived investigations are read-only.'],
  ] as const)('says why a provider cannot be connected: %s', (reason, message) => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[connectRequest({canApply: false, cannotApplyReason: reason})]}
      />
    );

    const connect = within(getCard()).getByRole('button', {
      name: 'Connect Datadog (opens in a new tab)',
    });
    expect(connect).toHaveAttribute('aria-disabled', 'true');
    expect(connect).toHaveAccessibleDescription(message);
  });

  it('offers a re-run once the provider is connected', async () => {
    const connected = connectRequest({
      state: 'applied',
      canApply: false,
      cannotApplyReason: 'not_suggested',
    });
    const apply = mockApply({body: {actionRequest: connected}});
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[connectRequest()]}
      />
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'Re-run with Datadog'})
    );

    expect(apply).toHaveBeenCalledWith(
      applyUrl,
      expect.objectContaining({method: 'POST', data: {action: connected.action}})
    );
  });

  it('checks the connection before offering either button', () => {
    mockDryRun({asyncDelay: 1_000_000});
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[connectRequest()]}
      />
    );

    expect(
      within(getCard()).getByRole('button', {name: 'Checking the Datadog connection…'})
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', {name: 'Connect Datadog (opens in a new tab)'})
    ).not.toBeInTheDocument();
  });

  it('keeps the re-run when a later connection check fails', async () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[connectRequest()]}
      />
    );
    await screen.findByRole('button', {name: 'Re-run with Datadog'});

    const failed = mockDryRun({statusCode: 500, body: {}});
    act(() => focusManager.setFocused(false));
    act(() => focusManager.setFocused(true));
    await waitFor(() => expect(failed).toHaveBeenCalled());

    expect(screen.getByRole('button', {name: 'Re-run with Datadog'})).toBeEnabled();
    expect(
      screen.queryByRole('button', {name: 'Connect Datadog (opens in a new tab)'})
    ).not.toBeInTheDocument();
  });

  it('offers to connect again when the re-run finds no connection', async () => {
    mockApply({statusCode: 400, body: notConnectedBody});
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[connectRequest()]}
      />
    );

    const rerun = await screen.findByRole('button', {name: 'Re-run with Datadog'});
    mockDryRun({statusCode: 400, body: notConnectedBody});
    await userEvent.click(rerun);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This change could not be applied. This provider isn't connected yet."
    );
    expect(
      await screen.findByRole('button', {name: 'Connect Datadog (opens in a new tab)'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Re-run with Datadog'})
    ).not.toBeInTheDocument();
  });

  it('drops the not-connected error once the provider connects', async () => {
    mockApply({statusCode: 400, body: notConnectedBody});
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[connectRequest()]}
      />
    );

    const rerun = await screen.findByRole('button', {name: 'Re-run with Datadog'});
    mockDryRun({statusCode: 400, body: notConnectedBody});
    await userEvent.click(rerun);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await screen.findByRole('button', {name: 'Connect Datadog (opens in a new tab)'});

    mockDryRun();
    act(() => focusManager.setFocused(false));
    act(() => focusManager.setFocused(true));

    expect(
      await screen.findByRole('button', {name: 'Re-run with Datadog'})
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    {
      status: 'accepted',
      rerun: null,
      note: 'Seer will re-run the investigation with it.',
    },
    {
      status: 'dispatched',
      rerun: null,
      note: 'Seer will re-run the investigation with it.',
    },
    {
      status: 'acknowledged',
      rerun: 'held',
      note: 'Seer will re-run the investigation with it once the current run finishes.',
    },
  ] as const)(
    'says Seer will re-run with a connected provider while the re-run is $status',
    ({status, rerun, note}) => {
      render(
        <NextStepCard
          investigationId="investigation-1"
          orchestration={completedRun}
          actionRequests={[
            connectedRequest({status, reason: null, rerun, retryable: false}),
          ]}
        />
      );

      const card = getCard();
      expect(card).toHaveTextContent(`Datadog connected. ${note}`);
      expect(
        within(card).getByRole('button', {name: 'View integration (opens in a new tab)'})
      ).toHaveAttribute('href', '/settings/org-slug/integrations/datadog/');
    }
  );

  it('drops a connected provider from an older report once the re-run starts', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={rerunningRun}
        actionRequests={[
          connectedRequest({
            status: 'acknowledged',
            reason: null,
            rerun: 'started',
            retryable: false,
          }),
        ]}
      />
    );

    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });

  it('shows only that a provider connected when no re-run follows', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[connectedRequest(null)]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent('Datadog connected.');
    expect(card).not.toHaveTextContent('re-run');
  });

  it('says why Seer did not re-run with a connected provider', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          connectedRequest({
            status: 'failed',
            reason: 'run_cancelled',
            rerun: 'skipped',
            retryable: false,
          }),
        ]}
      />
    );

    expect(getCard()).toHaveTextContent(
      "Datadog connected. Seer didn't re-run the investigation because it was cancelled."
    );
  });

  it('says when Seer started the re-run with a connected provider', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          connectedRequest({
            status: 'acknowledged',
            reason: null,
            rerun: 'started',
            retryable: false,
          }),
        ]}
      />
    );

    expect(getCard()).toHaveTextContent(
      'Datadog connected. Seer started re-running the investigation with it.'
    );
  });

  it('says the re-run failed when Seer gives no reason', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          connectedRequest({
            status: 'failed',
            reason: null,
            rerun: null,
            retryable: false,
          }),
        ]}
      />
    );

    expect(getCard()).toHaveTextContent(
      "Datadog connected. Seer couldn't re-run the investigation with it."
    );
  });

  it('tries a re-run that never reached Seer again', async () => {
    const retry = MockApiClient.addMockResponse({
      url: retryFollowUpUrl,
      method: 'POST',
      body: {
        actionRequest: connectedRequest({
          status: 'accepted',
          reason: null,
          rerun: null,
          retryable: false,
        }),
      },
    });
    const failed = connectedRequest({
      status: 'failed',
      reason: null,
      rerun: null,
      retryable: true,
    });
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[failed]}
      />
    );

    await userEvent.click(within(getCard()).getByRole('button', {name: 'Try again'}));

    expect(retry).toHaveBeenCalledWith(
      retryFollowUpUrl,
      expect.objectContaining({data: {action: failed.action}})
    );
  });

  it('says when a re-run can no longer be sent again', async () => {
    MockApiClient.addMockResponse({
      url: retryFollowUpUrl,
      method: 'POST',
      statusCode: 409,
      body: {detail: "There's nothing to send Seer again.", code: 'not_retryable'},
    });
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          connectedRequest({
            status: 'failed',
            reason: null,
            rerun: null,
            retryable: true,
          }),
        ]}
      />
    );

    await userEvent.click(within(getCard()).getByRole('button', {name: 'Try again'}));

    expect(
      await screen.findByText("This can't be sent to Seer again.")
    ).toBeInTheDocument();
  });

  it('sends a retry once when Try again is clicked twice', async () => {
    let respond!: () => void;
    const retry = MockApiClient.addMockResponse({
      url: retryFollowUpUrl,
      method: 'POST',
      asyncDelay: new Promise<void>(resolve => {
        respond = resolve;
      }),
      body: {
        actionRequest: connectedRequest({
          status: 'accepted',
          reason: null,
          rerun: null,
          retryable: false,
        }),
      },
    });
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          connectedRequest({
            status: 'failed',
            reason: null,
            rerun: null,
            retryable: true,
          }),
        ]}
      />
    );

    const button = within(getCard()).getByRole('button', {name: 'Try again'});
    await userEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await userEvent.click(button);
    respond();

    await waitFor(() => expect(retry).toHaveBeenCalled());
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('does not offer to retry a re-run that failed behind another command', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          connectedRequest({
            status: 'failed',
            reason: null,
            rerun: null,
            retryable: false,
          }),
        ]}
      />
    );

    expect(
      within(getCard()).queryByRole('button', {name: 'Try again'})
    ).not.toBeInTheDocument();
  });

  it('does not offer to retry a re-run on an archived investigation', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          {
            ...connectedRequest({
              status: 'failed',
              reason: null,
              rerun: null,
              retryable: true,
            }),
            cannotApplyReason: 'investigation_archived',
          },
        ]}
      />
    );

    expect(
      within(getCard()).queryByRole('button', {name: 'Try again'})
    ).not.toBeInTheDocument();
  });

  it('does not offer to retry a re-run Seer turned down', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          connectedRequest({
            status: 'failed',
            reason: 'provider_already_used',
            rerun: null,
            retryable: false,
          }),
        ]}
      />
    );

    expect(
      within(getCard()).queryByRole('button', {name: 'Try again'})
    ).not.toBeInTheDocument();
  });

  it('keeps the title of an applied change of a kind it does not know', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            title: 'Open a ticket',
            rationale: 'Seer needs traces.',
            action: {kind: 'open_ticket'} as unknown as InvestigationAction,
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            appliedBy: null,
            dateApplied: null,
          }),
        ]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent('Open a ticket. Seer needs traces.');
    expect(within(card).getByText('Applied')).toBeInTheDocument();
  });

  it('names the monitor as it was when the change was applied', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        source={sourceWith()}
        actionRequests={[
          InvestigationActionRequestFixture({
            state: 'applied',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            appliedDetails: {
              detectorId: '789',
              detectorName: 'Cart latency (renamed)',
              fields: ['timeWindowSeconds'],
            },
          }),
        ]}
      />
    );

    const card = getCard();
    expect(card).toHaveTextContent(
      'Monitor updated. Cart latency (renamed) was changed to the settings below.'
    );
    expect(within(card).queryByText('Cart p95 latency')).not.toBeInTheDocument();
  });

  it('reports an already applied request', async () => {
    mockApply({
      statusCode: 409,
      body: {detail: 'This action was already applied.', code: 'already_applied'},
    });
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    await userEvent.click(await findApplyButton());

    expect(await screen.findByText('This was already applied.')).toBeInTheDocument();
  });

  it('explains a suggestion that went stale', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[staleRequest]}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'The monitor changed since Seer suggested this. Ask Seer about this investigation for a new suggestion.'
    );
    expect(screen.getByText('When suggested: 5 minutes')).toBeInTheDocument();
    expect(screen.getByText('Now: 10 minutes')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Update monitor'})
    ).not.toBeInTheDocument();
  });

  it('renders nothing for a superseded request that did not go stale', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture({state: 'superseded'})]}
      />
    );

    expect(
      screen.queryByRole('region', {name: 'Recommended action'})
    ).not.toBeInTheDocument();
  });

  it('opens Seer from a stale suggestion', async () => {
    const openSeerExplorer = jest.fn();
    function WithSeerExplorer({children}: {children: React.ReactNode}) {
      const context = useSeerExplorerContext();
      return (
        <SeerExplorerContext.Provider value={{...context, openSeerExplorer}}>
          {children}
        </SeerExplorerContext.Provider>
      );
    }
    render(
      <WithSeerExplorer>
        <NextStepCard
          investigationId="investigation-1"
          orchestration={completedRun}
          actionRequests={[staleRequest]}
        />
      </WithSeerExplorer>,
      {
        organization: OrganizationFixture({
          features: ['seer-explorer'],
          openMembership: true,
          hideAiFeatures: false,
        }),
      }
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Ask Seer about this investigation'})
    );

    expect(openSeerExplorer).toHaveBeenCalled();
  });

  it('shows a suggestion that went stale before it is applied', async () => {
    mockDryRun({statusCode: 409, body: staleBody});
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    expect(await screen.findByText('Now: 10 minutes')).toBeInTheDocument();
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(
      'The monitor changed since Seer suggested this.'
    );
    expect(screen.getByRole('button', {name: 'Recheck suggestion'})).toBeEnabled();
    expect(
      screen.getAllByText(/The monitor changed since Seer suggested this/)
    ).toHaveLength(1);
  });

  it('rechecks a stale suggestion without applying it', async () => {
    mockDryRun({statusCode: 409, body: staleBody});
    const apply = mockApply({body: {actionRequest: staleRequest}});
    const recheck = MockApiClient.addMockResponse({
      url: recheckUrl,
      method: 'POST',
      body: {
        actionRequest: {
          ...staleRequest,
          followUp: {status: 'accepted', reason: null, rerun: null, retryable: false},
        },
      },
    });
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'Recheck suggestion'})
    );

    expect(recheck).toHaveBeenCalledWith(
      recheckUrl,
      expect.objectContaining({data: {action: staleRequest.action}})
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it('checks the change again when nothing changed after all', async () => {
    mockDryRun({statusCode: 409, body: staleBody});
    MockApiClient.addMockResponse({
      url: recheckUrl,
      method: 'POST',
      statusCode: 409,
      body: {detail: 'This still matches the monitor.', code: 'not_stale'},
    });
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );
    const recheck = await screen.findByRole('button', {name: 'Recheck suggestion'});
    await waitFor(() => expect(recheck).toBeEnabled());
    const check = mockDryRun();

    await userEvent.click(recheck);

    expect(
      await screen.findByText('Nothing changed since Seer suggested this.')
    ).toBeInTheDocument();
    await waitFor(() => expect(check).toHaveBeenCalled());
    expect(await findApplyButton()).toBeEnabled();
  });

  describe('when Seer re-checks a stale suggestion', () => {
    function recheckedRequest(followUp: ActionRequestFollowUp) {
      return InvestigationActionRequestFixture({...staleRequest, followUp});
    }

    it.each(['accepted', 'dispatched'] as const)(
      'waits while the re-check is %s',
      status => {
        render(
          <NextStepCard
            investigationId="investigation-1"
            orchestration={completedRun}
            actionRequests={[
              recheckedRequest({status, reason: null, rerun: null, retryable: false}),
            ]}
          />
        );

        const notice = screen.getByRole('status');
        expect(notice).toHaveTextContent(
          'The monitor changed since Seer suggested this. Seer is checking the suggestion again…'
        );
        expect(notice).not.toHaveTextContent('Ask Seer');
      }
    );

    it('points to Ask Seer once Seer has the re-check', () => {
      render(
        <NextStepCard
          investigationId="investigation-1"
          orchestration={completedRun}
          actionRequests={[
            recheckedRequest({
              status: 'acknowledged',
              reason: null,
              rerun: null,
              retryable: false,
            }),
          ]}
        />
      );

      expect(screen.getByRole('status')).toHaveTextContent(
        'The monitor changed since Seer suggested this. Ask Seer about this investigation for a new suggestion.'
      );
    });

    it.each(['pending', 'processing'] as const)(
      'says Seer is updating its suggestion while the run is %s',
      status => {
        render(
          <NextStepCard
            investigationId="investigation-1"
            orchestration={runWith(
              {status: 'generating', error: null},
              {phase: 'metadata', status}
            )}
            actionRequests={[
              recheckedRequest({
                status: 'acknowledged',
                reason: null,
                rerun: null,
                retryable: false,
              }),
            ]}
          />
        );

        const notice = screen.getByRole('status');
        expect(notice).toHaveTextContent(
          'The monitor changed since Seer suggested this. Seer is updating its suggestion…'
        );
        expect(notice).not.toHaveTextContent('Ask Seer');
      }
    );

    it('says the re-check failed when Seer gives no reason', () => {
      render(
        <NextStepCard
          investigationId="investigation-1"
          orchestration={completedRun}
          actionRequests={[
            recheckedRequest({
              status: 'failed',
              reason: null,
              rerun: null,
              retryable: false,
            }),
          ]}
        />
      );

      expect(screen.getByRole('status')).toHaveTextContent(
        "The monitor changed since Seer suggested this. Seer couldn't check it again."
      );
    });

    it('tries a failed re-check again', async () => {
      const recheck = MockApiClient.addMockResponse({
        url: recheckUrl,
        method: 'POST',
        body: {
          actionRequest: recheckedRequest({
            status: 'accepted',
            reason: null,
            rerun: null,
            retryable: false,
          }),
        },
      });
      const apply = mockApply({body: {actionRequest: staleRequest}});
      render(
        <NextStepCard
          investigationId="investigation-1"
          orchestration={completedRun}
          actionRequests={[
            recheckedRequest({
              status: 'failed',
              reason: null,
              rerun: null,
              retryable: false,
            }),
          ]}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Try again'}));

      expect(recheck).toHaveBeenCalledWith(
        recheckUrl,
        expect.objectContaining({data: {action: staleRequest.action}})
      );
      expect(apply).not.toHaveBeenCalled();
    });

    it('says why Seer could not check it again', () => {
      render(
        <NextStepCard
          investigationId="investigation-1"
          orchestration={completedRun}
          actionRequests={[
            recheckedRequest({
              status: 'failed',
              reason: 'action_requests_report_changed',
              rerun: null,
              retryable: false,
            }),
          ]}
        />
      );

      expect(screen.getByRole('status')).toHaveTextContent(
        "The monitor changed since Seer suggested this. Seer couldn't check it again because the report changed. Ask Seer about this investigation for a new suggestion."
      );
    });
  });

  it('shows only the settings that moved', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            ...staleRequest,
            action: changeOf(
              {timeWindowSeconds: 300, highThreshold: 500},
              {timeWindowSeconds: 900, highThreshold: 800}
            ),
            error: {code: 'stale', current: {highThreshold: null}},
          }),
        ]}
        source={sourceWith()}
      />
    );

    expect(screen.getByText('High threshold')).toBeInTheDocument();
    expect(screen.getByText('Now: —')).toBeInTheDocument();
    expect(screen.queryByText('Interval')).not.toBeInTheDocument();
  });

  it('shows a moved query only in its own row', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[
          InvestigationActionRequestFixture({
            ...staleRequest,
            action: changeOf(
              {timeWindowSeconds: 300, query: 'transaction:/api/cart'},
              {timeWindowSeconds: 900}
            ),
            error: {code: 'stale', current: {query: 'transaction:/api/checkout'}},
          }),
        ]}
        source={sourceWith()}
      />
    );

    expect(screen.getByText('When suggested: transaction:/api/cart')).toBeInTheDocument();
    expect(screen.getByText('Now: transaction:/api/checkout')).toBeInTheDocument();
    expect(screen.getAllByText(/transaction:\/api\/cart/)).toHaveLength(1);
  });

  it('holds the update while Seer finishes its suggestions', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={finishingRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    expect(screen.getByText('Seer is finishing its suggestions…')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Update monitor'})).toBeDisabled();
  });

  it('keeps a fresh suggestion applicable while the run finishes', async () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={runWith(
          {status: 'completed', error: null},
          {phase: 'metadata', status: 'processing'}
        )}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    expect(await findApplyButton()).toBeEnabled();
    expect(
      screen.queryByText('Seer is finishing its suggestions…')
    ).not.toBeInTheDocument();
  });

  it('notes that Seer is finishing only on cards it can apply', () => {
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={finishingRun}
        actionRequests={[InvestigationActionRequestFixture({state: 'applied'})]}
      />
    );

    expect(getCard()).toBeInTheDocument();
    expect(
      screen.queryByText('Seer is finishing its suggestions…')
    ).not.toBeInTheDocument();
  });
});
