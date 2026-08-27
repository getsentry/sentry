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
