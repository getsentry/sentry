import {buildInvestigationCurrentState} from 'sentry/views/investigations/detail/presentationModel';
import type {
  InvestigationBlock,
  InvestigationDetail,
  InvestigationExecutionStatus,
} from 'sentry/views/investigations/types';

function makeInvestigation(
  overrides: Partial<InvestigationDetail> = {}
): InvestigationDetail {
  return {
    id: 'investigation-1',
    title: 'Investigate checkout errors',
    status: 'active',
    sourceType: 'manual',
    createdBy: '1',
    dateCreated: '2026-08-20T10:00:00Z',
    dateUpdated: '2026-08-20T10:01:00Z',
    version: 1,
    blockCount: 0,
    isFavorited: false,
    summary: null,
    summaryDescription: null,
    blocks: [],
    ...overrides,
  };
}

function makeBlock(
  id: string,
  position: number,
  kind: InvestigationBlock['kind'],
  overrides: Partial<InvestigationBlock> = {}
): InvestigationBlock {
  return {
    id,
    position,
    kind,
    title: `Step ${position + 1}`,
    content: '',
    generationPrompt: '',
    generatedContent: '',
    output: null,
    outputStatus: 'notRun',
    currentExecution: null,
    config: {},
    display: {},
    dependencies: [],
    parameterKeys: [],
    version: 1,
    staleAt: null,
    createdBy: '1',
    lastEditedBy: '1',
    ...overrides,
  };
}

function makeExecution(
  status: InvestigationExecutionStatus,
  overrides: Partial<NonNullable<InvestigationBlock['currentExecution']>> = {}
): NonNullable<InvestigationBlock['currentExecution']> {
  return {
    id: `execution-${status}`,
    status,
    startedAt: '2026-08-20T10:00:00Z',
    completedAt: status === 'running' ? null : '2026-08-20T10:00:10Z',
    error: null,
    ...overrides,
  };
}

describe('buildInvestigationCurrentState', () => {
  it('shows an honest starting state before the investigation has a finding', () => {
    const state = buildInvestigationCurrentState(
      makeInvestigation({
        blocks: [makeBlock('query-1', 0, 'query', {title: 'Review error trend'})],
      })
    );

    expect(state).toMatchObject({
      activeStepTitle: 'Review error trend',
      description: 'Seer is reviewing the investigation source and available evidence.',
      hasCurrentUnderstanding: false,
      phase: 'starting',
      title: null,
    });
  });

  it('groups each text finding with its following evidence blocks', () => {
    const state = buildInvestigationCurrentState(
      makeInvestigation({
        blocks: [
          makeBlock('text-1', 0, 'text', {
            title: 'Review error trend',
            content: 'Errors rose after the deploy.',
          }),
          makeBlock('query-1', 1, 'query'),
          makeBlock('query-2', 2, 'query'),
          makeBlock('text-2', 3, 'text', {
            title: 'Check contributing issues',
          }),
          makeBlock('query-3', 4, 'query'),
        ],
      })
    );

    expect(state.steps).toHaveLength(2);
    expect(state.steps.map(step => step.title)).toEqual([
      'Review error trend',
      'Check contributing issues',
    ]);
  });

  it('uses the latest completed text finding as the current understanding', () => {
    const state = buildInvestigationCurrentState(
      makeInvestigation({
        blocks: [
          makeBlock('text-1', 0, 'text', {
            title: 'Earlier finding',
            content: 'The issue began after a deploy.',
            currentExecution: makeExecution('completed', {
              completedAt: '2026-08-20T10:00:10Z',
            }),
          }),
          makeBlock('text-2', 1, 'text', {
            title: 'Current finding',
            content: 'A shared dependency is timing out.',
            currentExecution: makeExecution('completed', {
              completedAt: '2026-08-20T10:01:10Z',
            }),
          }),
          makeBlock('query-1', 2, 'query', {
            currentExecution: makeExecution('running'),
          }),
        ],
      })
    );

    expect(state).toMatchObject({
      description: 'A shared dependency is timing out.',
      hasCurrentUnderstanding: true,
      phase: 'investigating',
      title: 'Current finding',
    });
  });

  it('folds a failed block and its cancelled evidence into one stopped step', () => {
    const state = buildInvestigationCurrentState(
      makeInvestigation({
        blocks: [
          makeBlock('text-1', 0, 'text', {
            title: 'Review error trend',
            content: 'Errors increased.',
          }),
          makeBlock('query-1', 1, 'query', {
            currentExecution: makeExecution('failed', {
              error: {message: 'Query timed out'},
            }),
          }),
          makeBlock('query-2', 2, 'query', {
            dependencies: ['query-1'],
            currentExecution: makeExecution('cancelled', {
              error: {
                code: 'investigation_execution_failed',
                message: 'An earlier step failed',
              },
            }),
          }),
        ],
      })
    );

    expect(state.phase).toBe('stopped');
    expect(state.steps).toEqual([
      expect.objectContaining({
        error: 'Query timed out',
        status: 'failed',
        title: 'Review error trend',
      }),
    ]);
  });

  it('uses the server summary as the completed understanding', () => {
    const state = buildInvestigationCurrentState(
      makeInvestigation({
        summary: 'Checkout errors came from a dependency timeout',
        summaryDescription:
          'The timeout began immediately after the latest deploy.\nRoll back the latest release.\nConfirm the dependency recovered.',
      })
    );

    expect(state).toMatchObject({
      activeStepTitle: null,
      description: 'The timeout began immediately after the latest deploy.',
      hasCurrentUnderstanding: true,
      phase: 'completed',
      suggestedNextSteps:
        'Roll back the latest release. · Confirm the dependency recovered.',
      title: 'Checkout errors came from a dependency timeout',
    });
  });

  it('does not invent next steps when the server summary has one line', () => {
    const state = buildInvestigationCurrentState(
      makeInvestigation({
        summary: 'Checkout errors came from a dependency timeout',
        summaryDescription: 'The timeout began immediately after the latest deploy.',
      })
    );

    expect(state.suggestedNextSteps).toBeNull();
  });

  it('separates an inline imperative next step from completed evidence', () => {
    const state = buildInvestigationCurrentState(
      makeInvestigation({
        summary: 'New frontend release caused 71% of metric spike',
        summaryDescription:
          'The new release drove most of the spike. Release correlation is strong but causation is not established. Investigate the issue and compare the two releases; consider rollback if a fix is not available.',
      })
    );

    expect(state).toMatchObject({
      description:
        'The new release drove most of the spike. Release correlation is strong but causation is not established.',
      suggestedNextSteps:
        'Investigate the issue and compare the two releases; consider rollback if a fix is not available.',
    });
  });

  it('does not mistake an evidence sentence beginning with a similar word for a next step', () => {
    const state = buildInvestigationCurrentState(
      makeInvestigation({
        summary: 'Checkout failures increased',
        summaryDescription:
          'Checkout failures increased immediately after the latest deploy.',
      })
    );

    expect(state.suggestedNextSteps).toBeNull();
  });
});
