import {investigationExecutionFixtureKey} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import {
  InvestigationBlockExecutionFixture,
  InvestigationBlockFixture,
  InvestigationDetailFixture,
  InvestigationExecutionDetailFixture,
  InvestigationQueryOutputFixture,
  InvestigationTranscriptBlockFixture,
} from 'sentry/views/investigations/fixtures';

const completedDependency = InvestigationBlockFixture({
  id: 'completed-dependency',
  title: 'Collect baseline evidence',
  outputStatus: 'completed',
  output: {schemaVersion: 1, markdown: 'Baseline evidence collected.'},
  currentExecution: InvestigationBlockExecutionFixture({
    id: 'completed-dependency-run',
  }),
});
export const notRunBlock = InvestigationBlockFixture({
  id: 'not-run-block',
  position: 1,
  title: 'Not run',
  content: '',
  generationPrompt: 'Summarize the current evidence.',
});
export const availableBlock = InvestigationBlockFixture({
  id: 'available-block',
  position: 2,
  title: 'Available output',
  content: '',
  outputStatus: 'available',
  output: {
    schemaVersion: 1,
    markdown: 'The latest deploy is correlated with the start of the regression.',
  },
});
export const restrictedBlock = InvestigationBlockFixture({
  id: 'restricted-block',
  position: 3,
  title: 'Restricted output',
  content: '',
  outputStatus: 'restricted',
});
export const waitingBlock = InvestigationBlockFixture({
  id: 'waiting-block',
  position: 4,
  title: 'Waiting for dependencies',
  content: '',
  config: {autoRun: true},
  dependencies: [completedDependency.id],
});
export const completedBlock = InvestigationBlockFixture({
  id: 'completed-block',
  position: 5,
  title: 'Completed',
  content: '',
  outputStatus: 'completed',
  output: {
    schemaVersion: 1,
    markdown: 'Connection acquisition accounts for 71% of the added latency.',
  },
  currentExecution: InvestigationBlockExecutionFixture({
    id: 'completed-block-run',
  }),
});
export const preRunInvestigation = InvestigationDetailFixture({
  id: 'block-pre-run-states',
  blocks: [
    completedDependency,
    notRunBlock,
    availableBlock,
    restrictedBlock,
    waitingBlock,
    completedBlock,
  ],
});

const pendingExecutionId = 'pending-block-run';
const runningExecutionId = 'running-block-run';
const stoppingExecutionId = 'stopping-block-run';
export const pendingBlock = InvestigationBlockFixture({
  id: 'pending-block',
  title: 'Pending execution',
  content: '',
  outputStatus: 'pending',
  currentExecution: InvestigationBlockExecutionFixture({
    id: pendingExecutionId,
    status: 'pending',
    startedAt: null,
    completedAt: null,
  }),
});
export const runningBlock = InvestigationBlockFixture({
  id: 'running-block',
  position: 1,
  title: 'Running execution',
  content: '',
  outputStatus: 'running',
  currentExecution: InvestigationBlockExecutionFixture({
    id: runningExecutionId,
    status: 'running',
    completedAt: null,
  }),
});
export const stoppingBlock = InvestigationBlockFixture({
  id: 'stopping-block',
  position: 2,
  title: 'Stopping execution',
  content: '',
  outputStatus: 'stopping',
  currentExecution: InvestigationBlockExecutionFixture({
    id: stoppingExecutionId,
    status: 'stopping',
    completedAt: null,
  }),
});
export const activeInvestigation = InvestigationDetailFixture({
  id: 'block-active-states',
  blocks: [pendingBlock, runningBlock, stoppingBlock],
});

const completedPanelExecutionId = 'completed-panel-run';
const failedPanelExecutionId = 'failed-panel-run';
const cancelledPanelExecutionId = 'cancelled-panel-run';
export const completedPanelBlock = InvestigationBlockFixture({
  id: 'completed-panel-block',
  title: 'Completed agent activity',
  content: '',
  outputStatus: 'running',
  currentExecution: InvestigationBlockExecutionFixture({
    id: completedPanelExecutionId,
    status: 'running',
    completedAt: null,
  }),
});
export const failedPanelBlock = InvestigationBlockFixture({
  id: 'failed-panel-block',
  position: 1,
  title: 'Failed agent activity',
  content: '',
  outputStatus: 'running',
  currentExecution: InvestigationBlockExecutionFixture({
    id: failedPanelExecutionId,
    status: 'running',
    completedAt: null,
  }),
});
export const cancelledPanelBlock = InvestigationBlockFixture({
  id: 'cancelled-panel-block',
  position: 2,
  title: 'Cancelled agent activity',
  content: '',
  outputStatus: 'running',
  currentExecution: InvestigationBlockExecutionFixture({
    id: cancelledPanelExecutionId,
    status: 'running',
    completedAt: null,
  }),
});
export const terminalPanelInvestigation = InvestigationDetailFixture({
  id: 'block-terminal-panels',
  blocks: [completedPanelBlock, failedPanelBlock, cancelledPanelBlock],
});

const QUERY_TABLE =
  '| Span id | Duration (ms) |\n| --- | ---: |\n| 8e8dfa084777de00 | 1490.45 |\n| be478bc8e2a904ae | 1414.67 |';
export const queryResultBlocks = [
  {id: 'bare-table-query', title: 'Bare table', tableMarkdown: QUERY_TABLE},
  {
    id: 'prose-table-query',
    title: 'Prose above the table',
    tableMarkdown: `Slowest **checkout** transactions in the breach window, sorted by duration.\n\n${QUERY_TABLE}`,
  },
  {
    id: 'surrounded-table-query',
    title: 'Prose around the table',
    tableMarkdown: `Top spans by duration.\n\n${QUERY_TABLE}\n\nNo sampled row has a profile attached.`,
  },
].map(({id, title, tableMarkdown}, position) =>
  InvestigationBlockFixture({
    id,
    position,
    kind: 'query',
    title,
    content: '',
    display: {type: 'table'},
    outputStatus: 'completed',
    output: InvestigationQueryOutputFixture({tableMarkdown}),
    currentExecution: InvestigationBlockExecutionFixture({id: `${id}-run`}),
  })
);
export const queryResultInvestigation = InvestigationDetailFixture({
  id: 'block-query-results',
  blocks: queryResultBlocks,
});

export const uncommentedTextBlock = InvestigationBlockFixture({
  id: 'uncommented-text-block',
  title: 'Working theory',
  content: '',
  outputStatus: 'completed',
  output: {
    schemaVersion: 1,
    markdown:
      'The eu-west-1 PDF workers scaled down at 13:38, so exports queue behind the remaining workers until they time out.',
  },
  currentExecution: InvestigationBlockExecutionFixture({
    id: 'uncommented-text-run',
  }),
});
export const commentedTextBlock = InvestigationBlockFixture({
  ...uncommentedTextBlock,
  id: 'commented-text-block',
  position: 1,
  currentExecution: InvestigationBlockExecutionFixture({
    id: 'commented-text-run',
  }),
});
export const commentedQueryBlock = InvestigationBlockFixture({
  ...queryResultBlocks[0]!,
  id: 'commented-query-block',
  position: 2,
  title: 'Slowest checkout spans',
  currentExecution: InvestigationBlockExecutionFixture({
    id: 'commented-query-run',
  }),
});
export const commentButtonInvestigation = InvestigationDetailFixture({
  id: 'block-comment-button',
  blocks: [uncommentedTextBlock, commentedTextBlock, commentedQueryBlock],
});

export const activeExecutions = {
  [investigationExecutionFixtureKey(pendingBlock.id, pendingExecutionId)]:
    InvestigationExecutionDetailFixture({
      id: pendingExecutionId,
      status: 'pending',
      blocks: [],
    }),
  [investigationExecutionFixtureKey(runningBlock.id, runningExecutionId)]:
    InvestigationExecutionDetailFixture({
      id: runningExecutionId,
      status: 'running',
      partialMarkdown:
        'The query is scanning checkout transactions from the breach window…',
      blocks: [
        InvestigationTranscriptBlockFixture({
          id: 'running-block-step',
          loading: true,
          message: {
            role: 'assistant',
            content: 'Comparing checkout spans before and after the deploy…',
          },
        }),
      ],
    }),
  [investigationExecutionFixtureKey(stoppingBlock.id, stoppingExecutionId)]:
    InvestigationExecutionDetailFixture({
      id: stoppingExecutionId,
      status: 'stopping',
      partialMarkdown: 'Preserving the evidence collected before the stop request.',
      blocks: [
        InvestigationTranscriptBlockFixture({
          id: 'stopping-block-step',
          message: {
            role: 'assistant',
            content: 'Stopping after the current query finishes…',
          },
        }),
      ],
    }),
};

export const terminalPanelExecutions = {
  [investigationExecutionFixtureKey(completedPanelBlock.id, completedPanelExecutionId)]:
    InvestigationExecutionDetailFixture({
      id: completedPanelExecutionId,
      status: 'completed',
      partialMarkdown:
        'The checkout regression begins four minutes after the deploy and is isolated to database connection acquisition.',
      transcriptTruncated: true,
      blocks: [
        InvestigationTranscriptBlockFixture({
          id: 'hidden-investigation-context',
          message: {
            role: 'user',
            content:
              '<investigation_context>Internal notebook context</investigation_context>',
          },
        }),
        InvestigationTranscriptBlockFixture({
          id: 'completed-tool-step',
          timestamp: '2026-08-17T10:00:03Z',
          message: {
            role: 'tool_use',
            content: null,
            tool_calls: [
              {
                id: 'checkout-span-search',
                function: 'telemetry_live_search',
                args: '{"query":"transaction:POST /api/checkout"}',
              },
            ],
          },
          toolResults: [
            {
              tool_call_id: 'checkout-span-search',
              tool_call_function: 'telemetry_live_search',
              content: '{"event_count":18402,"p95_ms":1840}',
            },
          ],
        }),
        InvestigationTranscriptBlockFixture({
          id: 'completed-conclusion',
          timestamp: '2026-08-17T10:00:07Z',
          message: {
            role: 'assistant',
            content:
              'Connection acquisition accounts for 71% of the added checkout latency.',
          },
        }),
      ],
    }),
  [investigationExecutionFixtureKey(failedPanelBlock.id, failedPanelExecutionId)]:
    InvestigationExecutionDetailFixture({
      id: failedPanelExecutionId,
      status: 'failed',
      blocks: [],
      error: {
        code: 'query_timeout',
        message: 'The span comparison exceeded the 90 second query limit.',
      },
    }),
  [investigationExecutionFixtureKey(cancelledPanelBlock.id, cancelledPanelExecutionId)]:
    InvestigationExecutionDetailFixture({
      id: cancelledPanelExecutionId,
      status: 'cancelled',
      partialMarkdown: 'Preserved evidence from the completed regional query.',
      blocks: [
        InvestigationTranscriptBlockFixture({
          id: 'cancelled-panel-step',
          message: {
            role: 'assistant',
            content: 'The run stopped before the release comparison completed.',
          },
        }),
      ],
    }),
};
