import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {NextStepCard} from 'sentry/views/investigations/actionRequests/nextStepCard';
import {
  InvestigationActionRequestFixture,
  InvestigationOrchestrationFixture,
} from 'sentry/views/investigations/fixtures';
import type {
  InvestigationDetail,
  InvestigationOrchestration,
  InvestigationUpdateDetectorAction,
} from 'sentry/views/investigations/types';

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

const applyUrl =
  '/organizations/org-slug/investigations/investigation-1/action-requests/312/apply/';

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

describe('NextStepCard', () => {
  beforeEach(() => {
    mockDryRun();
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

  it('applies the change', async () => {
    const apply = mockApply({
      body: {actionRequest: InvestigationActionRequestFixture({state: 'applied'})},
    });
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Update monitor'}));

    expect(apply).toHaveBeenCalledWith(
      applyUrl,
      expect.objectContaining({method: 'POST', data: {}})
    );
    expect(await screen.findByText('Monitor updated.')).toBeInTheDocument();
  });

  it('shows the updating state while the change is applied', async () => {
    mockApply({body: {}, asyncDelay: 1_000_000});
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Update monitor'}));

    expect(await screen.findByRole('button', {name: 'Updating monitor…'})).toBeDisabled();
  });

  it.each([
    {status: 500, body: {}, message: 'Unable to apply this change.'},
    {
      status: 403,
      body: {
        code: 'permission_denied',
        detail: 'You do not have permission to edit this monitor.',
      },
      message: 'You do not have permission to edit this monitor.',
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

    await userEvent.click(screen.getByRole('button', {name: 'Update monitor'}));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it.each([
    ['permission_denied', "You don't have permission to edit this monitor."],
    ['detector_not_found', 'This monitor is no longer available.'],
    [
      'not_target_detector',
      'This change targets a different monitor than this investigation.',
    ],
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

    expect(
      within(getCard()).getByRole('button', {name: 'Update monitor'})
    ).toBeDisabled();
    expect(getCard()).toHaveTextContent(message);
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

    await waitFor(() => expect(dryRun).toHaveBeenCalled());
    expect(screen.getByRole('button', {name: 'Update monitor'})).toBeEnabled();
  });

  it('holds the update when the check finds a problem', async () => {
    mockDryRun({
      statusCode: 400,
      body: {
        code: 'unsupported_action',
        detail: "Seer can't change dynamic monitors yet.",
      },
    });
    render(
      <NextStepCard
        investigationId="investigation-1"
        orchestration={completedRun}
        actionRequests={[InvestigationActionRequestFixture()]}
      />
    );

    expect(
      await screen.findByText("Seer can't change dynamic monitors yet.")
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Update monitor'})).toBeDisabled();
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
});
