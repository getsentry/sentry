import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {InvestigationOrchestrationWorkflow} from 'sentry/views/investigations/detail/orchestrationWorkflow';
import type {
  InvestigationHypothesis,
  InvestigationOrchestration,
} from 'sentry/views/investigations/types';

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
        now={Date.parse('2026-08-20T20:03:00Z')}
      />
    );

    expect(screen.getByTestId('investigation-orchestration-failed')).toHaveTextContent(
      'The parent agent could not continue.'
    );
    expect(
      screen.queryByTestId('investigation-orchestration-stale')
    ).not.toBeInTheDocument();
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
});
