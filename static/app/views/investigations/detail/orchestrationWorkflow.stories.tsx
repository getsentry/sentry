import {Container} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import {InvestigationOrchestrationWorkflow} from 'sentry/views/investigations/detail/orchestrationWorkflow';
import type {InvestigationOrchestration} from 'sentry/views/investigations/types';

const STORY_NOW = Date.parse('2026-08-20T20:01:00Z');

const BASE_ORCHESTRATION: InvestigationOrchestration = {
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
    toolActivity: [
      {
        id: 'activity-1',
        kind: 'api',
        status: 'completed',
        title: 'Compared trace summaries',
      },
    ],
  },
  hypotheses: [
    {
      id: 'hypothesis-1',
      order: 0,
      statement: 'Database saturation caused the latency spike',
      rationale: 'Latency and connection-pool wait time rose in the same window.',
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
          evidence: [],
          error: null,
        },
      ],
      evidence: [],
      toolActivity: [
        {
          id: 'activity-2',
          kind: 'tool',
          status: 'running',
          title: 'Inspecting database spans',
        },
      ],
      error: null,
    },
  ],
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
  heartbeatAt: '2026-08-20T20:00:30Z',
  updatedAt: '2026-08-20T20:00:30Z',
};

const IDLE_COMMAND_STATE = {
  error: null,
  errorTarget: null,
  isPending: false,
  pendingTarget: null,
} as const;

function WorkflowStory({orchestration}: {orchestration: InvestigationOrchestration}) {
  return (
    <Container padding="xl" maxWidth="900px">
      <InvestigationOrchestrationWorkflow
        commandState={IDLE_COMMAND_STATE}
        onCommand={() => null}
        orchestration={orchestration}
        now={STORY_NOW}
      />
    </Container>
  );
}

export default Storybook.story('Investigation orchestration workflow', story => {
  story('Active verification', () => (
    <WorkflowStory orchestration={BASE_ORCHESTRATION} />
  ));

  story('Awaiting input', () => (
    <WorkflowStory
      orchestration={{
        ...BASE_ORCHESTRATION,
        runId: null,
        phase: 'intake',
        status: 'awaiting_input',
        broadScan: {status: 'blocked', summary: null, error: null},
        hypotheses: [],
        pendingInput: {
          missingFields: ['prompt', 'time_range'],
          prompt: 'Tell Seer what to investigate and choose a time range.',
        },
      }}
    />
  ));

  story('Stalled verification and partial report', () => (
    <WorkflowStory
      orchestration={{
        ...BASE_ORCHESTRATION,
        hypotheses: [
          {
            ...BASE_ORCHESTRATION.hypotheses[0]!,
            status: 'stalled',
            effectiveStatus: 'failed',
            error: {
              code: 'investigator_stalled',
              message: 'This investigator stopped reporting progress.',
              retryable: true,
            },
          },
        ],
        report: {
          ...BASE_ORCHESTRATION.report,
          status: 'partial_failed',
          error: {
            code: 'report_failed',
            message: 'Report generation stopped after producing some blocks.',
            retryable: true,
          },
        },
      }}
    />
  ));

  story('Completed without a supported cause', () => (
    <WorkflowStory
      orchestration={{
        ...BASE_ORCHESTRATION,
        phase: 'completed',
        status: 'completed',
        hypotheses: [
          {
            ...BASE_ORCHESTRATION.hypotheses[0]!,
            status: 'completed',
            effectiveStatus: 'refuted',
            decisionSource: 'agent',
            confidence: 0.84,
          },
        ],
        report: {
          ...BASE_ORCHESTRATION.report,
          status: 'completed',
          suggestedHypotheses: [
            {
              statement: 'An upstream dependency throttled requests',
              rationale: 'External dependency telemetry was unavailable.',
            },
          ],
        },
      }}
    />
  ));
});
