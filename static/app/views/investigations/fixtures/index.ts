import type {
  InvestigationBlock,
  InvestigationDetail,
  InvestigationExecutionDetail,
  InvestigationListItem,
  InvestigationQueryOutput,
  InvestigationTitleGeneration,
  InvestigationTranscriptBlock,
} from 'sentry/views/investigations/types';

export function InvestigationListItemFixture(
  overrides: Partial<InvestigationListItem> = {}
): InvestigationListItem {
  return {
    id: '1',
    title: 'Database latency investigation',
    status: 'active',
    sourceType: 'manual',
    createdBy: '1',
    dateCreated: '2026-08-13T20:00:00Z',
    dateUpdated: '2026-08-13T21:00:00Z',
    version: 3,
    blockCount: 4,
    isFavorited: false,
    summary: null,
    summaryDescription: null,
    titleGeneration: {status: null},
    ...overrides,
  };
}

export function InvestigationBlockFixture(
  overrides: Partial<InvestigationBlock> = {}
): InvestigationBlock {
  return {
    id: 'block-1',
    position: 0,
    kind: 'text',
    title: 'Summary',
    content: 'Initial notes',
    generationPrompt: '',
    generatedContent: '',
    output: null,
    outputStatus: 'notRun',
    currentExecution: null,
    config: {},
    display: {type: 'markdown'},
    dependencies: [],
    parameterKeys: [],
    version: 1,
    staleAt: null,
    createdBy: '1',
    lastEditedBy: '1',
    ...overrides,
  };
}

export function InvestigationBlockExecutionFixture(
  overrides: Partial<NonNullable<InvestigationBlock['currentExecution']>> = {}
): NonNullable<InvestigationBlock['currentExecution']> {
  return {
    id: 'execution-1',
    status: 'completed',
    startedAt: '2026-08-17T10:00:00Z',
    completedAt: '2026-08-17T10:00:10Z',
    error: null,
    executor: 'code_mode',
    schemaVersion: 1,
    ...overrides,
  };
}

export function InvestigationQueryOutputFixture(
  overrides: Partial<InvestigationQueryOutput> = {}
): InvestigationQueryOutput {
  return {
    schemaVersion: 1,
    preferredView: 'table',
    tableMarkdown:
      '| Transaction | p95 | Events |\n| --- | ---: | ---: |\n| /api/checkout | 1.84s | 18,402 |',
    chart: null,
    chartUnavailableReason: null,
    isEmpty: false,
    queryLinks: [],
    ...overrides,
  };
}

export function InvestigationDetailFixture(
  overrides: Partial<InvestigationDetail> = {}
): InvestigationDetail & {blocks: InvestigationBlock[]} {
  const {blockCount, blocks: blockOverrides, ...detailOverrides} = overrides;
  const defaultBlocks = [
    InvestigationBlockFixture(),
    InvestigationBlockFixture({
      id: 'block-2',
      position: 1,
      kind: 'query',
      title: 'Latency query',
      content: '',
      generationPrompt: 'Find slow spans',
      display: {type: 'table'},
    }),
  ];
  const blocks = blockOverrides ?? defaultBlocks;

  return {
    id: 'investigation-1',
    title: 'Investigate database latency',
    status: 'active',
    sourceType: 'manual',
    createdBy: '1',
    dateCreated: '2026-08-13T20:00:00Z',
    dateUpdated: '2026-08-13T21:00:00Z',
    version: 1,
    blockCount: blockCount ?? blocks.length,
    isFavorited: false,
    summary: null,
    summaryDescription: null,
    filters: {},
    parameters: [],
    projectIds: [],
    source: {type: 'manual', ref: {}, revision: null},
    template: null,
    titleGeneration: {status: null},
    ...detailOverrides,
    blocks,
  };
}

export function InvestigationTranscriptBlockFixture(
  overrides: Partial<InvestigationTranscriptBlock> = {}
): InvestigationTranscriptBlock {
  return {
    id: 'transcript-block-1',
    timestamp: '2026-08-17T10:00:00Z',
    loading: false,
    message: {
      role: 'assistant',
      content: 'The latency increase begins immediately after the payments-api deploy.',
    },
    artifacts: [],
    toolLinks: null,
    toolResults: null,
    ...overrides,
  };
}

export function InvestigationExecutionDetailFixture(
  overrides: Partial<InvestigationExecutionDetail> = {}
): InvestigationExecutionDetail {
  return {
    id: 'execution-1',
    status: 'completed',
    blocks: [InvestigationTranscriptBlockFixture()],
    transcriptTruncated: false,
    pendingUserInput: null,
    partialMarkdown: null,
    error: null,
    ...overrides,
  };
}

export function InvestigationTitleGenerationFixture(
  overrides: Partial<InvestigationTitleGeneration> = {}
): InvestigationTitleGeneration {
  return {
    status: 'completed',
    preview: null,
    ...overrides,
  };
}

export function InvestigationBreachedMetricDetailFixture(
  overrides: Partial<InvestigationDetail> = {}
): InvestigationDetail & {blocks: InvestigationBlock[]} {
  return InvestigationDetailFixture({
    title: 'Checkout error rate spike',
    sourceType: 'metric_open_period',
    summary: 'Errors rose across releases',
    summaryDescription:
      'All active releases increased together.\nCheck shared infrastructure and dependencies.',
    template: {key: 'breached_metric', version: 1},
    source: {
      type: 'metric_open_period',
      ref: {groupId: '123', openPeriodId: '456'},
      revision: null,
    },
    blocks: [
      InvestigationBlockFixture({
        id: 'summary-block',
        position: 0,
        kind: 'text',
        title: 'What happened',
        content: '',
        generationPrompt: 'Explain the breach',
        output: {
          schemaVersion: 1,
          markdown:
            'The monitor breached because checkout errors spiked across every active release.',
        },
        outputStatus: 'completed',
        config: {autoRun: true},
      }),
      InvestigationBlockFixture({
        id: 'chart-block',
        position: 1,
        kind: 'query',
        title: 'Error volume',
        content: '',
        generationPrompt: 'Chart error volume during the open period',
        display: {
          type: 'chart',
          title: 'Top Issues in spike window',
          subtitle: '3:57pm\u20134:12pm PST  |  363 Total Events',
        },
        output: InvestigationQueryOutputFixture({
          preferredView: 'chart',
          tableMarkdown: '| total |\n| ---: |\n| 363 |',
          chart: {
            title: 'Top Issues in spike window',
            subtitle: '3:57pm\u20134:12pm PST  |  363 Total Events',
            visualization: 'line',
            x_axis: 'time',
            y_axis_unit: 'number',
            series: [
              {
                label: 'Events',
                data: [
                  {x: '2026-08-17T10:00:00Z', y: 120},
                  {x: '2026-08-17T10:05:00Z', y: 243},
                ],
              },
            ],
          },
        }),
        outputStatus: 'completed',
        config: {autoRun: true},
        dependencies: ['summary-block'],
      }),
      InvestigationBlockFixture({
        id: 'table-block',
        position: 2,
        kind: 'query',
        title: 'Slow endpoints',
        content: '',
        generationPrompt: 'List slow endpoints',
        display: {type: 'table'},
        output: InvestigationQueryOutputFixture(),
        outputStatus: 'completed',
        config: {autoRun: true},
        dependencies: ['chart-block'],
      }),
    ],
    ...overrides,
  });
}

export function InvestigationRunningDetailFixture(
  overrides: Partial<InvestigationDetail> = {}
): InvestigationDetail & {blocks: InvestigationBlock[]} {
  return InvestigationDetailFixture({
    title: 'Untitled investigation',
    titleGeneration: {status: 'running'},
    template: {key: 'breached_metric', version: 1},
    sourceType: 'metric_open_period',
    summary: null,
    summaryDescription: null,
    blocks: [
      InvestigationBlockFixture({
        id: 'block-1',
        position: 0,
        kind: 'text',
        title: 'What happened',
        content: '',
        generationPrompt: 'Explain the breach',
        output: null,
        outputStatus: 'running',
        currentExecution: {
          id: 'execution-1',
          status: 'running',
          startedAt: '2026-08-17T10:00:00Z',
          completedAt: null,
          error: null,
        },
        config: {autoRun: true},
      }),
      InvestigationBlockFixture({
        id: 'block-2',
        position: 1,
        kind: 'query',
        title: 'Error volume',
        content: '',
        generationPrompt: 'Chart errors',
        output: null,
        outputStatus: 'pending',
        currentExecution: {
          id: 'execution-2',
          status: 'pending',
          startedAt: null,
          completedAt: null,
          error: null,
        },
        config: {autoRun: true},
        dependencies: ['block-1'],
      }),
      InvestigationBlockFixture({
        id: 'block-3',
        position: 2,
        kind: 'text',
        title: 'Synthesis',
        content: '',
        generationPrompt: 'Synthesize findings',
        output: null,
        outputStatus: 'notRun',
        currentExecution: null,
        config: {autoRun: true},
        dependencies: ['block-1', 'block-2'],
      }),
    ],
    ...overrides,
  });
}

export function InvestigationFailedDetailFixture(
  overrides: Partial<InvestigationDetail> = {}
): InvestigationDetail & {blocks: InvestigationBlock[]} {
  return InvestigationDetailFixture({
    blocks: [
      InvestigationBlockFixture({
        id: 'block-1',
        position: 0,
        kind: 'text',
        title: 'What happened',
        content: '',
        output: null,
        outputStatus: 'failed',
        currentExecution: {
          id: 'execution-failed',
          status: 'failed',
          startedAt: '2026-08-17T10:00:00Z',
          completedAt: '2026-08-17T10:01:00Z',
          error: {code: 'seer_error', message: 'Seer could not finish this analysis.'},
        },
        config: {autoRun: true},
      }),
      InvestigationBlockFixture({
        id: 'block-2',
        position: 1,
        kind: 'query',
        title: 'Follow-up query',
        content: '',
        output: null,
        outputStatus: 'notRun',
        currentExecution: null,
        config: {autoRun: true},
        dependencies: ['block-1'],
      }),
    ],
    ...overrides,
  });
}

export function InvestigationAwaitingInputExecutionFixture(
  overrides: Partial<InvestigationExecutionDetail> = {}
): InvestigationExecutionDetail {
  return InvestigationExecutionDetailFixture({
    id: 'execution-awaiting-input',
    status: 'awaiting_input',
    blocks: [
      InvestigationTranscriptBlockFixture({
        message: {
          role: 'assistant',
          content: 'I need one more detail before finishing.',
        },
      }),
    ],
    pendingUserInput: {
      id: 'input-1',
      input_type: 'ask_user_question',
      data: {
        questions: [
          {
            question: 'Which environment should I inspect?',
            options: [
              {label: 'Production', description: 'Use production events'},
              {label: 'Staging', description: 'Use staging events'},
            ],
          },
        ],
      },
    },
    ...overrides,
  });
}
