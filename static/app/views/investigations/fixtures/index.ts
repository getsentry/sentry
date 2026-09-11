import type {
  InvestigationBlock,
  InvestigationDetail,
  InvestigationExecutionDetail,
  InvestigationHypothesis,
  InvestigationListItem,
  InvestigationOrchestration,
  InvestigationQueryOutput,
  InvestigationTitleGeneration,
  InvestigationTranscriptBlock,
  InvestigationVerificationStep,
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

export function InvestigationVerificationStepFixture(
  overrides: Partial<InvestigationVerificationStep> = {}
): InvestigationVerificationStep {
  return {
    id: 'step-1',
    order: 0,
    title: 'Compare FCP with server response time',
    objective: 'Establish whether the delay starts on the server or in the browser.',
    method: 'Compare FCP and TTFB percentiles over the incident window.',
    status: 'completed',
    result: 'The delay begins before the document reaches the browser.',
    evidence: [],
    error: null,
    ...overrides,
  };
}

export function InvestigationHypothesisFixture(
  overrides: Partial<InvestigationHypothesis> = {}
): InvestigationHypothesis {
  return {
    id: 'hypothesis-1',
    order: 0,
    statement: 'Database or cache degradation delayed the response',
    rationale:
      'FCP and TTFB rose together as cache misses exposed a much slower organization lookup.',
    status: 'completed',
    effectiveStatus: 'supported',
    decisionSource: 'agent',
    confidence: 0.86,
    attempt: 0,
    verificationSteps: [
      InvestigationVerificationStepFixture(),
      InvestigationVerificationStepFixture({
        id: 'step-2',
        order: 1,
        title: 'Compare organization lookup spans',
        objective: 'Isolate the slow span.',
        method: 'Break lookup duration down by cache outcome.',
        result: 'The lookup slowed sharply during the incident window.',
      }),
      InvestigationVerificationStepFixture({
        id: 'step-3',
        order: 2,
        title: 'Inspect cache and Redis behavior',
        objective: 'Confirm the cache is the source.',
        method: 'Chart hit rate against response time.',
        result: 'Cache misses increased at the same time as the slowdown.',
      }),
    ],
    agentVerdict: {
      verdict: 'supported',
      confidence: 0.86,
      rationale: 'Every check points at the same cache regression.',
      supportingEvidenceIds: [],
      refutingEvidenceIds: [],
      remainingGaps: [],
    },
    evidence: [],
    toolActivity: [],
    error: null,
    ...overrides,
  };
}

/**
 * The three-hypothesis shape the hypothesis row is designed around: one
 * supported conclusion alongside a refuted and an inconclusive alternative.
 */
export function InvestigationHypothesesFixture(): InvestigationHypothesis[] {
  return [
    InvestigationHypothesisFixture(),
    InvestigationHypothesisFixture({
      id: 'hypothesis-2',
      order: 1,
      statement: 'An external SSO provider slowed the response',
      rationale:
        'SSO and non-SSO organizations slowed together: provider spans stayed near baseline.',
      effectiveStatus: 'refuted',
      confidence: 0.91,
      agentVerdict: {
        verdict: 'refuted',
        confidence: 0.91,
        rationale: 'The shared delay contradicts an SSO-only explanation.',
        supportingEvidenceIds: [],
        refutingEvidenceIds: [],
        remainingGaps: [],
      },
      verificationSteps: [
        InvestigationVerificationStepFixture({
          id: 'step-2-1',
          order: 0,
          title: 'Compare identity-provider spans',
          objective: 'Check the provider call.',
          method: 'Chart provider span duration over the window.',
          result: 'No shared provider slowdown appears in the affected traces.',
        }),
        InvestigationVerificationStepFixture({
          id: 'step-2-2',
          order: 1,
          title: 'Compare SSO and non-SSO organizations',
          objective: 'Separate the two populations.',
          method: 'Group response time by authentication method.',
          result: 'Both groups show the same server-side delay.',
        }),
      ],
    }),
    InvestigationHypothesisFixture({
      id: 'hypothesis-3',
      order: 2,
      statement: 'Session validation created a shared bottleneck',
      rationale:
        'Available traces do not separate session-validation time from the cache and database delay.',
      effectiveStatus: 'inconclusive',
      confidence: 0.34,
      agentVerdict: {
        verdict: 'inconclusive',
        confidence: 0.34,
        rationale: 'Span coverage is too incomplete to isolate this contribution.',
        supportingEvidenceIds: [],
        refutingEvidenceIds: [],
        remainingGaps: ['Session middleware spans are not instrumented.'],
      },
      verificationSteps: [
        InvestigationVerificationStepFixture({
          id: 'step-3-1',
          order: 0,
          title: 'Inspect session and middleware spans',
          objective: 'Measure validation time.',
          method: 'Break the request down by middleware span.',
          result: 'Span coverage is incomplete in the affected trace sample.',
        }),
        InvestigationVerificationStepFixture({
          id: 'step-3-2',
          order: 1,
          title: 'Check shared Redis pressure',
          objective: 'Separate session load from cache load.',
          method: 'Compare Redis command latency by key prefix.',
          result:
            'Redis contention overlaps the slowdown but does not isolate session validation.',
        }),
      ],
    }),
  ];
}

export function InvestigationOrchestrationFixture(
  overrides: Partial<InvestigationOrchestration> = {}
): InvestigationOrchestration {
  return {
    runId: '9001',
    investigationId: 'investigation-1',
    workflowVersion: 4,
    generation: 1,
    notebookRevision: 5,
    phase: 'reporting',
    status: 'processing',
    sourceType: 'breached_metric',
    broadScan: {
      status: 'completed',
      summary: 'FCP regressed on organization login pages across every active release.',
      toolActivity: [],
      error: null,
    },
    hypotheses: InvestigationHypothesesFixture(),
    report: {
      status: 'composing',
      revision: 2,
      notebookRevision: 5,
      currentBlockKey: null,
      includedHypothesisIds: ['hypothesis-1', 'hypothesis-3'],
      primaryHypothesisId: 'hypothesis-1',
      error: null,
      metadata: {
        status: 'completed',
        title: 'Why did FCP spike on organization login pages?',
        summary: 'A cache regression slowed organization lookups',
        summaryDescription:
          'Cache misses exposed a much slower organization lookup, delaying the server response.',
        error: null,
      },
    },
    pendingInput: null,
    errors: [],
    heartbeatAt: '2026-08-27T11:06:30Z',
    updatedAt: '2026-08-27T11:06:30Z',
    ...overrides,
  };
}
