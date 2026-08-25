import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {InvestigationOrchestrationWorkflow} from 'sentry/views/investigations/detail/orchestrationWorkflow';
import type {
  InvestigationHypothesis,
  InvestigationOrchestration,
} from 'sentry/views/investigations/types';

const idleCommandState = {
  error: null,
  errorTarget: null,
  isPending: false,
  pendingTarget: null,
} as const;

function HypothesisFixture(
  overrides: Partial<InvestigationHypothesis> = {}
): InvestigationHypothesis {
  return {
    id: 'hypothesis-1',
    order: 0,
    statement: 'Database connection saturation caused the latency spike',
    rationale: 'Latency and pool wait time increased in the same window.',
    status: 'running',
    effectiveStatus: 'investigating',
    decisionSource: 'none',
    confidence: null,
    verificationSteps: [
      {
        id: 'step-1',
        order: 0,
        title: 'Compare pool wait time',
        objective: 'Determine whether connection waits rose with latency.',
        method: 'Compare open-period spans with the preceding baseline.',
        status: 'running',
        result: null,
        evidence: [
          {
            id: 'evidence-1',
            kind: 'trace',
            title: 'Checkout trace',
            summary: 'Database spans account for most of the added duration.',
            reference: 'trace-123',
            url: '/organizations/org-slug/traces/trace-123/',
            data: {},
          },
        ],
        error: null,
      },
    ],
    evidence: [],
    error: null,
    ...overrides,
  };
}

function OrchestrationFixture(
  overrides: Partial<InvestigationOrchestration> = {}
): InvestigationOrchestration {
  return {
    runId: 'run-1',
    investigationId: 'investigation-1',
    sourceType: 'manual',
    workflowVersion: 3,
    generation: 1,
    notebookRevision: 0,
    phase: 'investigating',
    status: 'processing',
    broadScan: {
      status: 'completed',
      summary: 'The broad scan found latency concentrated in database spans.',
      error: null,
    },
    hypotheses: [HypothesisFixture()],
    report: {
      revision: 0,
      status: 'waiting',
      includedHypothesisIds: [],
      primaryHypothesisId: null,
      currentBlockKey: null,
      notebookRevision: 0,
      metadata: {
        status: 'not_started',
        title: null,
        summary: null,
        summaryDescription: null,
        error: null,
      },
      error: null,
    },
    pendingInput: null,
    errors: [],
    heartbeatAt: '2026-08-20T20:00:00Z',
    updatedAt: '2026-08-20T20:00:00Z',
    ...overrides,
  };
}

describe('InvestigationOrchestrationWorkflow', () => {
  it('renders the active graph and reveals authored hypothesis details in a modal', async () => {
    renderGlobalModal();
    render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture()}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(screen.getByLabelText('Investigation workflow')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Hypotheses'})).toBeInTheDocument();
    expect(
      screen.getByText('The broad scan found latency concentrated in database spans.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Database connection saturation caused the latency spike')
    ).toBeInTheDocument();

    expect(screen.queryByText('Why this is plausible')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {
        name: 'View hypothesis: Database connection saturation caused the latency spike',
      })
    );
    expect(screen.getByText('Why this is plausible')).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByText('Compare pool wait time')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Checkout trace'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/traces/trace-123/'
    );
  });

  it('keeps inactive hypotheses collapsed until the user opens them', async () => {
    renderGlobalModal();
    render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture({
          hypotheses: [HypothesisFixture({status: 'queued'})],
        })}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(screen.queryByText('Why this is plausible')).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {
        name: 'View hypothesis: Database connection saturation caused the latency spike',
      })
    );
    expect(screen.getByText('Why this is plausible')).toBeInTheDocument();
  });

  it('adds a new flow lane when another hypothesis arrives', () => {
    const {rerender} = render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture()}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(
      screen.queryByTestId('rf__node-hypothesis-hypothesis-2')
    ).not.toBeInTheDocument();

    rerender(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture({
          hypotheses: [
            HypothesisFixture(),
            HypothesisFixture({
              id: 'hypothesis-2',
              order: 1,
              statement: 'A release changed database query behavior',
            }),
          ],
        })}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(screen.getByTestId('investigation-hypothesis-graph')).toHaveAttribute(
      'data-hypothesis-count',
      '2'
    );
  });

  it('does not render a report status box after hypotheses settle', () => {
    render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture({
          phase: 'completed',
          status: 'completed',
          hypotheses: [
            HypothesisFixture({
              id: 'hypothesis-1',
              effectiveStatus: 'refuted',
              status: 'completed',
            }),
            HypothesisFixture({
              id: 'hypothesis-2',
              order: 1,
              statement: 'A release changed database query behavior',
              effectiveStatus: 'inconclusive',
              status: 'completed',
            }),
          ],
          report: {
            ...OrchestrationFixture().report,
            status: 'completed',
          },
        })}
        now={Date.parse('2026-08-20T20:10:00Z')}
      />
    );

    expect(screen.queryByText('Investigation report')).not.toBeInTheDocument();
    expect(screen.queryByText('What to test next')).not.toBeInTheDocument();
  });

  it('shows compact live updates while composing the notebook', () => {
    render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture({
          phase: 'reporting',
          report: {
            ...OrchestrationFixture().report,
            status: 'composing',
            currentBlockKey: 'error-volume-chart',
            currentBlockStatus: 'running',
            currentBlockToolActivity: [
              {
                id: 'report-query-1',
                kind: 'api',
                status: 'running',
                title: 'Querying error volume by minute',
              },
            ],
          },
        })}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(screen.getByTestId('report-composition-updates')).toBeInTheDocument();
    expect(screen.getByText('Error volume chart')).toBeInTheDocument();
    expect(screen.getAllByText('Querying error volume by minute')).toHaveLength(2);
    expect(screen.getByRole('button', {name: 'Seer updates'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByText('Investigation report')).not.toBeInTheDocument();
  });

  it('shows stale and durable failure states', () => {
    const {rerender} = render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture()}
        now={Date.parse('2026-08-20T20:03:00Z')}
      />
    );

    expect(screen.getByTestId('investigation-orchestration')).toHaveAttribute(
      'data-stale',
      'true'
    );

    rerender(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture({
          phase: 'failed',
          status: 'failed',
          errors: [
            {
              code: 'parent_failed',
              message: 'The parent agent could not continue.',
              retryable: true,
            },
          ],
        })}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(screen.getByTestId('investigation-orchestration-failed')).toHaveTextContent(
      'The parent agent could not continue.'
    );
    expect(screen.getByTestId('investigation-orchestration')).toHaveAttribute(
      'data-stale',
      'false'
    );
  });

  it('uses updatedAt for stale detection when no heartbeat has arrived', () => {
    render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture({
          heartbeatAt: null,
          updatedAt: '2026-08-20T20:00:00Z',
        })}
        now={Date.parse('2026-08-20T20:02:00Z')}
      />
    );

    expect(screen.getByTestId('investigation-orchestration')).toHaveAttribute(
      'data-stale',
      'true'
    );
  });

  it('keeps run and report controls out of the workflow canvas', () => {
    const onCommand = jest.fn();
    const {rerender} = render(
      <InvestigationOrchestrationWorkflow
        commandState={idleCommandState}
        onCommand={onCommand}
        orchestration={OrchestrationFixture({
          runId: null,
          phase: 'failed',
          status: 'failed',
          broadScan: {status: 'not_started', summary: null, error: null},
          errors: [
            {
              code: 'seer_dispatch_failed',
              message: 'Unable to start Seer.',
              retryable: true,
            },
          ],
        })}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(
      screen.queryByRole('button', {name: 'Retry investigation'})
    ).not.toBeInTheDocument();

    rerender(
      <InvestigationOrchestrationWorkflow
        commandState={idleCommandState}
        onCommand={onCommand}
        orchestration={OrchestrationFixture({
          phase: 'reporting',
          status: 'failed',
          broadScan: {status: 'completed', summary: null, error: null},
          report: {
            ...OrchestrationFixture().report,
            status: 'failed',
          },
        })}
        now={Date.parse('2026-08-20T20:03:00Z')}
      />
    );

    expect(
      screen.queryByRole('button', {name: 'Retry investigation'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Retry report'})).not.toBeInTheDocument();
  });

  it('renders unknown additive phases safely', () => {
    render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture({phase: 'collecting_context'})}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(screen.getByLabelText('Investigation workflow')).toBeInTheDocument();
  });

  it('submits missing intake context from an accessible form', async () => {
    const onCommand = jest.fn();
    render(
      <InvestigationOrchestrationWorkflow
        commandState={idleCommandState}
        onCommand={onCommand}
        orchestration={OrchestrationFixture({
          phase: 'intake',
          status: 'awaiting_input',
          broadScan: {status: 'blocked', summary: null, error: null},
          pendingInput: {
            missingFields: ['prompt'],
            prompt: 'Tell Seer what to investigate.',
          },
        })}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    await userEvent.type(
      screen.getByRole('textbox', {name: 'What should Seer investigate?'}),
      'Find the cause of checkout latency'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Start investigation'}));

    expect(onCommand).toHaveBeenCalledWith(
      {type: 'provide_input', prompt: 'Find the cause of checkout latency'},
      'input'
    );
  });

  it('uses a single prompt input to start an investigation', async () => {
    const onCommand = jest.fn();
    render(
      <InvestigationOrchestrationWorkflow
        commandState={idleCommandState}
        onCommand={onCommand}
        orchestration={OrchestrationFixture({
          phase: 'intake',
          status: 'awaiting_input',
          heartbeatAt: null,
          updatedAt: '2026-08-20T20:00:00Z',
          broadScan: {status: 'blocked', summary: null, error: null},
          pendingInput: {
            missingFields: ['prompt', 'time_range'],
            prompt: 'Provide investigation context.',
          },
        })}
        now={Date.parse('2026-08-20T20:10:00Z')}
      />
    );

    expect(
      screen.queryByTestId('investigation-orchestration-stale')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Retry investigation'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Cancel investigation'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Hypotheses'})).not.toBeInTheDocument();
    expect(screen.queryByText('Investigation report')).not.toBeInTheDocument();

    const startButton = screen.getByRole('button', {name: 'Start investigation'});
    expect(startButton).toBeDisabled();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'What should Seer investigate?'}),
      'Find the cause of checkout latency'
    );
    await userEvent.click(startButton);

    expect(onCommand).toHaveBeenCalledWith(
      {
        type: 'provide_input',
        prompt: 'Find the cause of checkout latency',
      },
      'input'
    );
  });

  it('shows broad-scan Code Mode todos as live investigation steps', () => {
    render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture({
          broadScan: {
            status: 'running',
            summary: null,
            error: null,
            toolActivity: [
              {
                id: 'step-1',
                kind: 'step',
                status: 'running',
                title: 'Inspect the error spike',
              },
              {
                id: 'call-1',
                kind: 'api',
                status: 'completed',
                title: 'Queried issue groups',
              },
            ],
          },
        })}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(screen.getAllByText('Inspect the error spike')).toHaveLength(2);
    expect(screen.getByRole('button', {name: 'Seer updates'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByText('Queried issue groups')).toBeInTheDocument();
  });

  it('lets the user decide hypotheses and steer from the single composer', async () => {
    renderGlobalModal();
    const onCommand = jest.fn();
    render(
      <InvestigationOrchestrationWorkflow
        commandState={idleCommandState}
        onCommand={onCommand}
        orchestration={OrchestrationFixture()}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Accept hypothesis: Database connection saturation caused the latency spike',
      })
    );
    expect(onCommand).toHaveBeenCalledWith(
      {
        type: 'set_hypothesis_disposition',
        hypothesisId: 'hypothesis-1',
        disposition: 'accepted',
      },
      'hypothesis-decision:hypothesis-1'
    );

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Steer the investigation'}),
      'Focus the broad scan on checkout failures'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Send instructions'}));
    expect(onCommand).toHaveBeenCalledWith(
      {
        type: 'steer',
        target: 'workflow',
        instruction: 'Focus the broad scan on checkout failures',
      },
      'workflow'
    );
  });

  it('reveals only bounded tool activity in expanded nodes and marks the primary cause', async () => {
    renderGlobalModal();
    render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture({
          hypotheses: [
            HypothesisFixture({
              status: 'queued',
              attempt: 1,
              automaticRetryCount: 1,
              toolActivity: [
                {
                  id: 'activity-1',
                  kind: 'api',
                  status: 'running',
                  title: 'Querying trace summaries',
                  arguments: 'secret query body',
                } as NonNullable<InvestigationHypothesis['toolActivity']>[number],
                {
                  id: 'activity-2',
                  kind: 'api',
                  status: 'completed',
                  title: 'Loaded historical traces',
                },
              ],
            }),
          ],
          report: {
            ...OrchestrationFixture().report,
            primaryHypothesisId: 'hypothesis-1',
          },
        })}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Querying trace summaries')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'View Seer updates for: Database connection saturation caused the latency spike',
      })
    ).toBeInTheDocument();
    expect(screen.queryByText('secret query body')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'View hypothesis: Database connection saturation caused the latency spike',
      })
    );

    expect(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Seer updates'})
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByText('Querying trace summaries').length).toBeGreaterThan(0);
    expect(screen.getByText('Loaded historical traces')).toBeInTheDocument();
    expect(screen.getByText('Attempt 2')).toBeInTheDocument();
    expect(screen.getByText('Automatically retried once')).toBeInTheDocument();
    expect(
      screen.getAllByRole('status').some(status => status.textContent === 'Running')
    ).toBe(true);
    expect(screen.queryByText('secret query body')).not.toBeInTheDocument();
  });

  it('does not render report suggestions alongside the ranked hypotheses', () => {
    render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture({
          phase: 'completed',
          status: 'completed',
          hypotheses: [
            HypothesisFixture({
              effectiveStatus: 'refuted',
              status: 'completed',
            }),
          ],
          report: {
            ...OrchestrationFixture().report,
            status: 'completed',
            suggestedHypotheses: [
              {
                statement: 'An upstream dependency throttled requests',
                rationale: 'External latency remains a data gap.',
              },
            ],
          },
        })}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(screen.queryByText('What to test next')).not.toBeInTheDocument();
    expect(
      screen.queryByText('An upstream dependency throttled requests')
    ).not.toBeInTheDocument();
  });

  it('only makes safe relative and HTTP evidence URLs clickable', async () => {
    renderGlobalModal();
    render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture({
          hypotheses: [
            HypothesisFixture({
              evidence: [
                {
                  id: 'safe-relative',
                  kind: 'issue',
                  title: 'Safe relative evidence',
                  url: '/organizations/org-slug/issues/1/',
                  data: {},
                },
                {
                  id: 'safe-external',
                  kind: 'external',
                  title: 'Safe external evidence',
                  url: 'https://example.com/evidence',
                  data: {},
                },
                {
                  id: 'protocol-relative',
                  kind: 'external',
                  title: 'Protocol-relative evidence',
                  url: '//evil.example/evidence',
                  data: {},
                },
                {
                  id: 'javascript',
                  kind: 'external',
                  title: 'Script evidence',
                  url: ['javascript', 'alert(1)'].join(':'),
                  data: {},
                },
                {
                  id: 'backslash-protocol-relative',
                  kind: 'external',
                  title: 'Backslash protocol-relative evidence',
                  url: '/\\evil.example/evidence',
                  data: {},
                },
              ],
            }),
          ],
        })}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: 'View hypothesis: Database connection saturation caused the latency spike',
      })
    );

    expect(screen.getByRole('link', {name: 'Safe relative evidence'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/1/'
    );
    expect(screen.getByRole('link', {name: 'Safe external evidence'})).toHaveAttribute(
      'href',
      'https://example.com/evidence'
    );
    expect(screen.getByText('Protocol-relative evidence')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'Protocol-relative evidence'})
    ).not.toBeInTheDocument();
    expect(screen.getByText('Script evidence')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Script evidence'})).not.toBeInTheDocument();
    expect(screen.getByText('Backslash protocol-relative evidence')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {name: 'Backslash protocol-relative evidence'})
    ).not.toBeInTheDocument();
  });

  it('keeps an agent verdict visible under an unverified user acceptance', async () => {
    renderGlobalModal();
    const onCommand = jest.fn();
    render(
      <InvestigationOrchestrationWorkflow
        commandState={idleCommandState}
        onCommand={onCommand}
        orchestration={OrchestrationFixture({
          hypotheses: [
            HypothesisFixture({
              status: 'completed',
              effectiveStatus: 'accepted',
              decisionSource: 'user',
              confidence: 0.2,
              agentVerdict: {
                verdict: 'refuted',
                confidence: 0.2,
                rationale: 'Database waits remained flat.',
                supportingEvidenceIds: [],
                refutingEvidenceIds: ['evidence-1'],
                remainingGaps: [],
              },
            }),
          ],
        })}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(screen.getAllByText('Accepted by you').length).toBeGreaterThan(0);
    await userEvent.click(
      screen.getByRole('button', {
        name: 'View hypothesis: Database connection saturation caused the latency spike',
      })
    );
    expect(screen.getByText(/Seer has not verified this hypothesis/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByText('Agent verdict')
    ).toBeInTheDocument();
    expect(screen.getByText('Database waits remained flat.')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Accept hypothesis: Database connection saturation caused the latency spike',
      })
    );
    expect(onCommand).toHaveBeenCalledWith(
      {
        type: 'set_hypothesis_disposition',
        hypothesisId: 'hypothesis-1',
        disposition: null,
      },
      'hypothesis-decision:hypothesis-1'
    );
  });

  it('offers retries for failed hypotheses without rendering a report panel', async () => {
    renderGlobalModal();
    const onCommand = jest.fn();
    render(
      <InvestigationOrchestrationWorkflow
        commandState={idleCommandState}
        onCommand={onCommand}
        orchestration={OrchestrationFixture({
          hypotheses: [
            HypothesisFixture({
              status: 'stalled',
              effectiveStatus: 'failed',
            }),
          ],
          report: {
            ...OrchestrationFixture().report,
            status: 'partial_failed',
          },
        })}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: 'View hypothesis: Database connection saturation caused the latency spike',
      })
    );
    await userEvent.click(screen.getByRole('button', {name: 'Retry hypothesis'}));
    expect(onCommand).toHaveBeenCalledWith(
      {type: 'retry', target: 'hypothesis', targetId: 'hypothesis-1'},
      'hypothesis-decision:hypothesis-1'
    );
    expect(screen.queryByRole('button', {name: 'Retry report'})).not.toBeInTheDocument();
  });
});
