import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

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
  it('renders the active graph and reveals authored hypothesis details', () => {
    render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture()}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(screen.getByRole('heading', {name: 'Investigation plan'})).toBeInTheDocument();
    expect(screen.getByText('Broad investigation')).toBeInTheDocument();
    expect(
      screen.getByText('The broad scan found latency concentrated in database spans.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Database connection saturation caused the latency spike')
    ).toBeInTheDocument();

    expect(screen.getByText('Why this is plausible')).toBeInTheDocument();
    expect(screen.getByText('Compare pool wait time')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Checkout trace'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/traces/trace-123/'
    );
  });

  it('keeps inactive hypotheses collapsed until the user opens them', async () => {
    render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture({
          hypotheses: [HypothesisFixture({status: 'queued'})],
        })}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(screen.getByText('Why this is plausible')).not.toBeVisible();
    await userEvent.click(
      screen.getByRole('button', {
        name: /Database connection saturation caused the latency spike/,
      })
    );
    expect(screen.getByText('Why this is plausible')).toBeVisible();
  });

  it('describes an inconclusive report when all hypotheses are rejected or unresolved', () => {
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

    expect(
      screen.getByText(
        'No hypothesis was supported. The report explains rejected theories, remaining gaps, and what to test next.'
      )
    ).toBeInTheDocument();
  });

  it('shows stale and durable failure states', () => {
    const {rerender} = render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture()}
        now={Date.parse('2026-08-20T20:03:00Z')}
      />
    );

    expect(screen.getByTestId('investigation-orchestration-stale')).toBeInTheDocument();

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
    expect(
      screen.queryByTestId('investigation-orchestration-stale')
    ).not.toBeInTheDocument();
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

    expect(screen.getByTestId('investigation-orchestration-stale')).toBeInTheDocument();
  });

  it('only offers a run retry for retryable broad-scan or startup states', async () => {
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

    await userEvent.click(screen.getByRole('button', {name: 'Retry investigation'}));
    expect(onCommand).toHaveBeenCalledWith({type: 'retry', target: 'run'}, 'run');

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
    expect(screen.getByRole('button', {name: 'Retry report'})).toBeInTheDocument();

    rerender(
      <InvestigationOrchestrationWorkflow
        commandState={idleCommandState}
        onCommand={onCommand}
        orchestration={OrchestrationFixture()}
        now={Date.parse('2026-08-20T20:03:00Z')}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Retry investigation'}));
    expect(onCommand).toHaveBeenLastCalledWith({type: 'retry', target: 'run'}, 'run');
  });

  it('renders unknown additive phases safely', () => {
    render(
      <InvestigationOrchestrationWorkflow
        orchestration={OrchestrationFixture({phase: 'collecting_context'})}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    expect(screen.getByText('Collecting context')).toBeInTheDocument();
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

  it('lets the user add, decide, undo, and steer hypotheses', async () => {
    const onCommand = jest.fn();
    render(
      <InvestigationOrchestrationWorkflow
        commandState={idleCommandState}
        onCommand={onCommand}
        orchestration={OrchestrationFixture()}
        now={Date.parse('2026-08-20T20:01:00Z')}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Add a hypothesis'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Hypothesis'}),
      'A deploy exhausted the connection pool'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Test hypothesis'}));
    expect(onCommand).toHaveBeenCalledWith(
      {
        type: 'add_hypothesis',
        statement: 'A deploy exhausted the connection pool',
        rationale: null,
      },
      'add-hypothesis'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Accept'}));
    expect(onCommand).toHaveBeenCalledWith(
      {
        type: 'set_hypothesis_disposition',
        hypothesisId: 'hypothesis-1',
        disposition: 'accepted',
      },
      'hypothesis-decision:hypothesis-1'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Steer this hypothesis'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Instructions'}),
      'Compare only production traces'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Send instructions'}));
    expect(onCommand).toHaveBeenCalledWith(
      {
        type: 'steer',
        target: 'hypothesis',
        targetId: 'hypothesis-1',
        instruction: 'Compare only production traces',
      },
      'hypothesis:hypothesis-1'
    );

    const workflowSteeringButton = screen.getByRole('button', {
      name: 'Steer the investigation',
    });
    await userEvent.click(workflowSteeringButton);
    const workflowSteering = workflowSteeringButton.closest<HTMLElement>(
      '[data-disclosure="true"]'
    );
    if (!workflowSteering) {
      throw new Error('Expected workflow steering disclosure.');
    }
    await userEvent.type(
      within(workflowSteering).getByRole('textbox', {name: 'Instructions'}),
      'Focus the broad scan on checkout failures'
    );
    await userEvent.click(
      within(workflowSteering).getByRole('button', {
        name: 'Send instructions',
      })
    );
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
    expect(screen.getByText('Querying trace summaries')).not.toBeVisible();
    expect(screen.queryByText('secret query body')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {
        name: /Database connection saturation caused the latency spike/,
      })
    );

    expect(screen.getByText('Querying trace summaries')).toBeVisible();
    expect(screen.getByText('Attempt 2')).toBeVisible();
    expect(screen.getByText('Automatically retried once')).toBeVisible();
    expect(
      screen.getAllByRole('status').some(status => status.textContent === 'Running')
    ).toBe(true);
    expect(screen.queryByText('secret query body')).not.toBeInTheDocument();
  });

  it('offers suggested inconclusive hypotheses as existing add commands', async () => {
    const onCommand = jest.fn();
    render(
      <InvestigationOrchestrationWorkflow
        commandState={idleCommandState}
        onCommand={onCommand}
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

    expect(screen.getByText('What to test next')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Test hypothesis: An upstream dependency throttled requests',
      })
    );
    expect(onCommand).toHaveBeenCalledWith(
      {
        type: 'add_hypothesis',
        statement: 'An upstream dependency throttled requests',
        rationale: 'External latency remains a data gap.',
      },
      'add-hypothesis'
    );
  });

  it('only makes safe relative and HTTP evidence URLs clickable', () => {
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

    expect(screen.getByText('Accepted by you')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {
        name: /Database connection saturation caused the latency spike/,
      })
    );
    expect(screen.getByText(/Seer has not verified this hypothesis/)).toBeInTheDocument();
    expect(screen.getByText('Agent verdict')).toBeInTheDocument();
    expect(screen.getByText('Database waits remained flat.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Undo decision'}));
    expect(onCommand).toHaveBeenCalledWith(
      {
        type: 'set_hypothesis_disposition',
        hypothesisId: 'hypothesis-1',
        disposition: null,
      },
      'hypothesis-decision:hypothesis-1'
    );
  });

  it('offers retries for failed hypothesis and report states', async () => {
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
        name: /Database connection saturation caused the latency spike/,
      })
    );
    await userEvent.click(screen.getByRole('button', {name: 'Retry hypothesis'}));
    expect(onCommand).toHaveBeenCalledWith(
      {type: 'retry', target: 'hypothesis', targetId: 'hypothesis-1'},
      'hypothesis-decision:hypothesis-1'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Retry report'}));
    expect(onCommand).toHaveBeenCalledWith(
      {type: 'retry', target: 'report'},
      'report-action'
    );
  });
});
