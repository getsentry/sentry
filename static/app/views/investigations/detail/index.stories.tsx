import {Container, Stack} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import {CrashReportPreviewButton} from 'sentry/views/investigations/__stories__/crashReportPreviewButton';
import {
  InvestigationFixtureApi,
  investigationExecutionFixtureKey,
} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import {StoryTopBar} from 'sentry/views/investigations/__stories__/storyTopBar';
import {InvestigationBootstrapPage} from 'sentry/views/investigations/detail';
import {
  InvestigationActionRequestFixture,
  InvestigationBlockExecutionFixture,
  InvestigationBlockFixture,
  InvestigationBreachedMetricDetailFixture,
  InvestigationDetailFixture,
  InvestigationFailedDetailFixture,
  InvestigationOrchestrationFixture,
  InvestigationAwaitingInputExecutionFixture,
  InvestigationExecutionDetailFixture,
  InvestigationMetricSourceFixture,
  InvestigationQueryOutputFixture,
  InvestigationRunningDetailFixture,
  InvestigationTitleGenerationFixture,
  InvestigationTranscriptBlockFixture,
} from 'sentry/views/investigations/fixtures';
import {RouteError} from 'sentry/views/routeError';

const completedInvestigation = InvestigationBreachedMetricDetailFixture({
  id: 'completed-checkout-regression',
  title: 'Checkout latency after payments-api 2026.08.18 deploy',
  status: 'archived',
  sourceType: 'metric_open_period',
  dateCreated: '2026-08-18T16:02:14Z',
  dateUpdated: '2026-08-18T16:19:42Z',
  version: 8,
  isFavorited: true,
  summary: 'Connection acquisition is delaying checkout requests',
  summaryDescription:
    'The p95 increase begins four minutes after the deploy and appears in every production region.\nThe strongest signal is exhausted database connections in payments-api.',
  source: {
    ...InvestigationMetricSourceFixture({
      id: '42',
      name: 'Checkout p95 latency',
      aggregate: 'p95(span.duration)',
      environment: 'production',
      conditions: [
        {type: 'gt', comparison: 800, result: 75},
        {type: 'lte', comparison: 800, result: 0},
      ],
    }),
    ref: {groupId: 'metric-alert-42', openPeriodId: 'open-period-17'},
    revision: 1,
  },
  actionRequests: [
    InvestigationActionRequestFixture({
      action: {
        kind: 'update_detector',
        detectorId: '42',
        before: {timeWindowSeconds: 300},
        changes: {timeWindowSeconds: 900},
      },
    }),
  ],
  blocks: [
    InvestigationBlockFixture({
      id: 'completed-summary',
      title: 'Current understanding',
      outputStatus: 'completed',
      output: {
        schemaVersion: 1,
        markdown:
          'Checkout latency rose from **420 ms to 1.84 s** immediately after the `payments-api` deploy. The increase is concentrated in time spent acquiring a database connection.',
      },
      currentExecution: InvestigationBlockExecutionFixture({id: 'summary-execution'}),
    }),
    InvestigationBlockFixture({
      id: 'latency-chart',
      position: 1,
      kind: 'query',
      title: 'Checkout p95 over the breach window',
      generationPrompt:
        'Chart checkout p95 for the hour around the alert and compare it with the previous hour.',
      outputStatus: 'completed',
      output: InvestigationQueryOutputFixture({
        preferredView: 'chart',
        queryLinks: [
          {
            kind: 'telemetry',
            params: {
              dataset: 'spans',
              query: 'transaction:/api/checkout environment:production',
            },
          },
        ],
        tableMarkdown:
          '| Time | p95 |\n| --- | ---: |\n| 15:55 | 421ms |\n| 16:10 | 1.84s |',
        chart: {
          title: 'Checkout p95 over the breach window',
          subtitle: 'Production · payments-api · 60 minute window',
          visualization: 'line',
          x_axis: 'time',
          y_axis_unit: 'duration',
          series: [
            {
              label: 'Current period',
              data: [
                {x: '2026-08-18T15:45:00Z', y: 398},
                {x: '2026-08-18T16:00:00Z', y: 421},
                {x: '2026-08-18T16:15:00Z', y: 1840},
                {x: '2026-08-18T16:30:00Z', y: 1762},
              ],
            },
            {
              label: 'Previous period',
              data: [
                {x: '2026-08-18T15:45:00Z', y: 405},
                {x: '2026-08-18T16:00:00Z', y: 417},
                {x: '2026-08-18T16:15:00Z', y: 433},
                {x: '2026-08-18T16:30:00Z', y: 428},
              ],
            },
          ],
        },
      }),
      currentExecution: InvestigationBlockExecutionFixture({id: 'chart-execution'}),
      display: {
        type: 'chart',
        title: 'Checkout p95 over the breach window',
        subtitle: 'Production · payments-api · 60 minute window',
      },
    }),
    InvestigationBlockFixture({
      id: 'slow-transactions',
      position: 2,
      kind: 'query',
      title: 'Slowest checkout transactions',
      generationPrompt: 'List the slowest checkout transactions during the breach.',
      outputStatus: 'completed',
      output: InvestigationQueryOutputFixture({
        preferredView: 'table',
        tableMarkdown:
          '| Transaction | p95 | Events | Failure rate |\n| --- | ---: | ---: | ---: |\n| `POST /api/checkout` | 1.84s | 18,402 | 4.8% |\n| `POST /api/payment-intents` | 1.31s | 9,117 | 2.1% |\n| `GET /api/cart` | 612ms | 32,845 | 0.3% |',
      }),
      currentExecution: InvestigationBlockExecutionFixture({id: 'table-execution'}),
      display: {type: 'table', subtitle: 'Production · 16:00–16:30 UTC'},
    }),
    InvestigationBlockFixture({
      id: 'regional-breakdown',
      position: 3,
      kind: 'query',
      title: 'Regional breakdown',
      generationPrompt: 'Compare checkout latency by region.',
      outputStatus: 'completed',
      output: InvestigationQueryOutputFixture({
        preferredView: 'chart',
        chart: null,
        chartUnavailableReason: 'No numeric time-series columns',
        tableMarkdown:
          '| Region | p95 before | p95 after | Change |\n| --- | ---: | ---: | ---: |\n| us-east-1 | 418ms | 1.79s | +328% |\n| eu-west-1 | 436ms | 1.91s | +338% |\n| ap-southeast-2 | 447ms | 1.86s | +316% |',
      }),
      currentExecution: InvestigationBlockExecutionFixture({id: 'fallback-execution'}),
    }),
    InvestigationBlockFixture({
      id: 'completed-synthesis',
      position: 4,
      title: 'Conclusion',
      outputStatus: 'completed',
      output: {
        schemaVersion: 1,
        markdown:
          '### Recommended next steps\n\n1. Roll back the connection-pool change in `payments-api`.\n2. Restore the previous pool size while reviewing the new timeout policy.\n3. Watch checkout p95 and connection acquisition time for 30 minutes.',
      },
      currentExecution: InvestigationBlockExecutionFixture({id: 'synthesis-execution'}),
    }),
  ],
});

// The completed investigation above, with a finished agentic run behind it.
const agenticReportInvestigation = {
  ...completedInvestigation,
  id: 'completed-agentic-report',
  status: 'active',
  orchestration: {
    phase: 'completed',
    status: 'completed',
    heartbeatAt: '2026-08-18T16:19:42Z',
    notebookRevision: 8,
  },
};

const agenticReportOrchestration = InvestigationOrchestrationFixture({
  investigationId: agenticReportInvestigation.id,
  phase: 'completed',
  status: 'completed',
  startedAt: '2026-08-18T16:02:14Z',
  finishedAt: '2026-08-18T16:06:19Z',
  activeSince: null,
  activeTimeElapsedSeconds: 245,
  report: {...InvestigationOrchestrationFixture().report, status: 'completed'},
});

function reportTextBlock(id: string, position: number, title: string, markdown: string) {
  return InvestigationBlockFixture({
    id,
    position,
    title,
    outputStatus: 'completed',
    output: {schemaVersion: 1, markdown},
    currentExecution: InvestigationBlockExecutionFixture({id: `${id}-execution`}),
  });
}

// The agentic report as Seer writes one: each text block opens with a level-two
// heading, some with level-three ones under it, which is what the outline beside
// it lists.
const outlinedReportInvestigation = {
  ...agenticReportInvestigation,
  id: 'completed-outlined-report',
  blocks: [
    reportTextBlock(
      'outline-what-happened',
      0,
      'What happened',
      '## What happened\n\nCheckout p95 rose from **420 ms to 1.84 s** after the `payments-api` deploy, in every production region.'
    ),
    {...completedInvestigation.blocks[1]!, position: 1},
    reportTextBlock(
      'outline-how-we-know',
      2,
      'Evidence analysis',
      '## How we know\n\n### Connection waits\n\nThe slowest checkout transactions spend their extra time waiting for a database connection.\n\n### Query time\n\nQuery execution time is unchanged.'
    ),
    {...completedInvestigation.blocks[2]!, position: 3},
    reportTextBlock(
      'outline-when',
      4,
      'Deploy timing',
      '## When it happened\n\nThe first slow requests arrived four minutes after the deploy finished, once the new connection-pool settings reached every host.'
    ),
    {...completedInvestigation.blocks[3]!, position: 5},
    reportTextBlock(
      'outline-unknowns',
      6,
      "What we don't know",
      "## What we don't know\n\nWhether the smaller pool or the shorter acquire timeout matters more. Both changed in the same deploy."
    ),
    reportTextBlock(
      'outline-next',
      7,
      'What to do next',
      '## What to do next\n\n- Roll back the connection-pool change in `payments-api`.\n- Watch connection acquisition time for 30 minutes.'
    ),
  ],
};

const manualInvestigation = InvestigationDetailFixture({
  id: 'manual-invoice-timeouts',
  title: 'Invoice PDF timeouts in eu-west-1',
  status: 'active',
  sourceType: 'manual',
  dateCreated: '2026-08-27T14:08:00Z',
  dateUpdated: '2026-08-27T14:22:15Z',
  version: 3,
  blocks: [
    InvestigationBlockFixture({
      id: 'manual-notes',
      title: 'Initial notes',
      content:
        'Support reports that invoice exports began timing out after 13:40 UTC. So far the reports are limited to eu-west-1.',
    }),
    InvestigationBlockFixture({
      id: 'manual-query',
      position: 1,
      kind: 'query',
      title: 'Invoice generation duration',
      generationPrompt:
        'Show p50, p95, and failure rate for invoice PDF generation in eu-west-1.',
      display: {type: 'table'},
    }),
    InvestigationBlockFixture({
      id: 'manual-empty-text',
      position: 2,
      title: 'Working theory',
      content: '',
      generationPrompt: 'Summarize the strongest working theory.',
    }),
  ],
});

const runningSummaryExecutionId = 'running-summary-execution';
const runningQueryExecutionId = 'running-query-execution';
const runningInvestigation = InvestigationRunningDetailFixture({
  id: 'running-checkout-investigation',
  title: 'Untitled investigation',
  status: 'active',
  sourceType: 'metric_open_period',
  dateCreated: '2026-08-27T15:31:00Z',
  dateUpdated: '2026-08-27T15:31:22Z',
  titleGeneration: {status: 'running'},
  blocks: [
    InvestigationBlockFixture({
      id: 'running-summary',
      title: 'Analyze the breach',
      content: '',
      outputStatus: 'running',
      config: {autoRun: true},
      currentExecution: InvestigationBlockExecutionFixture({
        id: runningSummaryExecutionId,
        status: 'running',
        completedAt: null,
      }),
    }),
    InvestigationBlockFixture({
      id: 'running-query',
      position: 1,
      kind: 'query',
      title: 'Compare affected releases',
      content: '',
      generationPrompt: 'Compare event volume and users across active releases.',
      outputStatus: 'pending',
      config: {autoRun: true},
      currentExecution: InvestigationBlockExecutionFixture({
        id: runningQueryExecutionId,
        status: 'pending',
        startedAt: null,
        completedAt: null,
      }),
    }),
  ],
});

const skeletonSummaryExecutionId = 'skeleton-summary-execution';
const skeletonQueryExecutionId = 'skeleton-query-execution';
const skeletonInvestigation = InvestigationDetailFixture({
  id: 'skeleton-investigation',
  title: 'Checkout latency after the payments-api deploy',
  status: 'active',
  sourceType: 'metric_open_period',
  blocks: [
    InvestigationBlockFixture({
      id: 'skeleton-summary',
      title: 'Analyze the breach',
      content: '',
      outputStatus: 'running',
      config: {autoRun: true},
      currentExecution: InvestigationBlockExecutionFixture({
        id: skeletonSummaryExecutionId,
        status: 'running',
        completedAt: null,
      }),
    }),
    InvestigationBlockFixture({
      id: 'skeleton-query',
      position: 1,
      kind: 'query',
      title: 'Compare affected releases',
      content: '',
      generationPrompt: 'Compare event volume and users across active releases.',
      outputStatus: 'running',
      config: {autoRun: true},
      currentExecution: InvestigationBlockExecutionFixture({
        id: skeletonQueryExecutionId,
        status: 'running',
        completedAt: null,
      }),
    }),
  ],
});

const reportingInvestigation = InvestigationDetailFixture({
  id: 'reporting-investigation',
  title: 'Checkout latency after the payments-api deploy',
  status: 'active',
  sourceType: 'metric_open_period',
  orchestration: {
    phase: 'reporting',
    status: 'processing',
    heartbeatAt: '2026-08-27T15:31:22Z',
    notebookRevision: 5,
  },
  blocks: [
    InvestigationBlockFixture({
      id: 'reporting-summary',
      title: 'What happened',
      outputStatus: 'available',
      output: {
        schemaVersion: 1,
        markdown:
          'Checkout latency rose from **420 ms to 1.84 s** immediately after the `payments-api` deploy.',
      },
      currentExecution: InvestigationBlockExecutionFixture({
        id: 'reporting-summary-execution',
      }),
    }),
  ],
});

// A run waiting on a person makes no hypotheses until they answer, so the
// hypotheses row stays hidden instead of holding placeholders open.
const awaitingInputRunInvestigation = InvestigationDetailFixture({
  id: 'awaiting-input-run-investigation',
  title: 'Checkout latency after the payments-api deploy',
  status: 'active',
  sourceType: 'metric_open_period',
  orchestration: {
    phase: 'intake',
    status: 'awaiting_input',
    heartbeatAt: '2026-08-27T15:31:22Z',
    notebookRevision: 1,
  },
  blocks: [],
});

const awaitingInputExecutionId = 'awaiting-input-execution';
const awaitingInputInvestigation = InvestigationDetailFixture({
  id: 'awaiting-input-investigation',
  title: 'Billing consumer lag during reconciliation',
  status: 'active',
  sourceType: 'manual',
  blocks: [
    InvestigationBlockFixture({
      id: 'awaiting-input-block',
      title: 'Compare the lag spike',
      content: '',
      outputStatus: 'awaiting_input',
      config: {autoRun: true},
      currentExecution: InvestigationBlockExecutionFixture({
        id: awaitingInputExecutionId,
        status: 'awaiting_input',
        completedAt: null,
      }),
    }),
  ],
});

const failedBlock = InvestigationBlockFixture({
  id: 'failed-query',
  kind: 'query',
  title: 'Release comparison',
  content: '',
  generationPrompt: 'Compare event counts across releases.',
  outputStatus: 'failed',
  currentExecution: InvestigationBlockExecutionFixture({
    id: 'failed-execution',
    status: 'failed',
    error: {
      code: 'query_timeout',
      message: 'The release comparison exceeded the 90 second query limit.',
    },
  }),
});
const cancelledBlock = InvestigationBlockFixture({
  id: 'cancelled-query',
  position: 1,
  kind: 'query',
  title: 'Regional error breakdown',
  content: '',
  generationPrompt: 'Break down the errors by region.',
  outputStatus: 'cancelled',
  currentExecution: InvestigationBlockExecutionFixture({
    id: 'cancelled-execution',
    status: 'cancelled',
    error: {message: 'Stopped after the release query failed.'},
  }),
});
const failureInvestigation = InvestigationFailedDetailFixture({
  id: 'failed-investigation',
  title: 'Release health regression after 8.42.0',
  status: 'active',
  sourceType: 'metric_open_period',
  blocks: [failedBlock, cancelledBlock],
});

const archivedInvestigation = InvestigationDetailFixture({
  id: 'archived-investigation',
  title: 'Elevated API error rate during certificate rotation',
  status: 'archived',
  sourceType: 'breached_metric',
  dateCreated: '2026-08-27T15:44:00Z',
  dateUpdated: '2026-08-27T15:44:00Z',
  blocks: [],
});

// An agentic run that has only just started: Seer is still scanning, so there
// are no hypotheses yet and the status block shows the calls behind the scan.
// The activity feed stays hidden until the run stops.
const gatheringContextInvestigation = InvestigationDetailFixture({
  id: 'gathering-context-investigation',
  title: 'New breached metrics investigation',
  status: 'active',
  sourceType: 'metric_open_period',
  orchestration: {
    phase: 'broad_scan',
    status: 'processing',
    heartbeatAt: '2026-10-19T22:34:00Z',
    notebookRevision: 1,
  },
  blocks: [],
});

const gatheringContextOrchestration = InvestigationOrchestrationFixture({
  investigationId: gatheringContextInvestigation.id,
  phase: 'broad_scan',
  status: 'processing',
  broadScan: {
    status: 'running',
    summary: null,
    toolActivity: [
      {
        id: 'gathering-releases',
        kind: 'tool',
        status: 'completed',
        title: 'Listing project releases',
      },
      {
        id: 'gathering-spans',
        kind: 'tool',
        status: 'running',
        title: 'Querying spans for transaction:sentry.tasks.relay.build_project_config',
      },
    ],
    error: null,
  },
  hypotheses: [],
});

export default Storybook.story('Investigations — Detail', story => {
  story('Completed report with an outline', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-outlined-report"
      details={[outlinedReportInvestigation]}
      orchestration={{
        [outlinedReportInvestigation.id]: {
          ...agenticReportOrchestration,
          investigationId: outlinedReportInvestigation.id,
        },
      }}
    >
      {/*
       * Measured the way the app's main column is, so the outline only shows
       * once this is at least 1152px wide. Nothing clips it, so it sticks as the
       * story scrolls.
       */}
      <Container containerType="inline-size" border="primary" radius="md">
        <InvestigationBootstrapPage investigationId={outlinedReportInvestigation.id} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Completed agentic report', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-agentic-report"
      details={[agenticReportInvestigation]}
      orchestration={{[agenticReportInvestigation.id]: agenticReportOrchestration}}
    >
      <Container minHeight="720px" border="primary" radius="md" overflow="hidden">
        <StoryTopBar>
          <InvestigationBootstrapPage investigationId={agenticReportInvestigation.id} />
        </StoryTopBar>
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Completed with every output type', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-completed"
      details={[completedInvestigation]}
    >
      <Container minHeight="720px" border="primary" radius="md" overflow="hidden">
        <StoryTopBar>
          <InvestigationBootstrapPage investigationId={completedInvestigation.id} />
        </StoryTopBar>
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Active manual notebook', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-manual"
      details={[manualInvestigation]}
    >
      <Container minHeight="680px" border="primary" radius="md" overflow="hidden">
        <StoryTopBar>
          <InvestigationBootstrapPage investigationId={manualInvestigation.id} />
        </StoryTopBar>
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Running with generated title and agent activity', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-running"
      details={[runningInvestigation]}
      titleGenerations={{
        [runningInvestigation.id]: InvestigationTitleGenerationFixture({
          status: 'running',
          preview: 'Checkout failures after payments-api deploy',
        }),
      }}
      executions={{
        [investigationExecutionFixtureKey('running-summary', runningSummaryExecutionId)]:
          InvestigationExecutionDetailFixture({
            id: runningSummaryExecutionId,
            status: 'running',
            partialMarkdown:
              'The breach begins immediately after the latest `payments-api` deploy. Seer is comparing database spans across regions…',
            blocks: [
              InvestigationTranscriptBlockFixture({
                id: 'running-request',
                message: {
                  role: 'user',
                  content:
                    'Explain the checkout latency breach and find the likely cause.',
                },
              }),
              InvestigationTranscriptBlockFixture({
                id: 'running-analysis',
                timestamp: '2026-08-27T15:31:09Z',
                loading: true,
                message: {
                  role: 'assistant',
                  content: 'Comparing transaction spans before and after the deploy…',
                  thinking_content:
                    'The database connection span is the clearest change in the critical path.',
                },
              }),
            ],
          }),
        [investigationExecutionFixtureKey('running-query', runningQueryExecutionId)]:
          InvestigationExecutionDetailFixture({
            id: runningQueryExecutionId,
            status: 'pending',
            blocks: [],
          }),
      }}
    >
      <Container minHeight="760px" border="primary" radius="md" overflow="hidden">
        <StoryTopBar>
          <InvestigationBootstrapPage investigationId={runningInvestigation.id} />
        </StoryTopBar>
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Blocks Seer is still writing', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-skeleton"
      details={[skeletonInvestigation]}
      executions={{
        [investigationExecutionFixtureKey(
          'skeleton-summary',
          skeletonSummaryExecutionId
        )]: InvestigationExecutionDetailFixture({
          id: skeletonSummaryExecutionId,
          status: 'running',
          partialMarkdown: null,
          blocks: [],
        }),
        [investigationExecutionFixtureKey('skeleton-query', skeletonQueryExecutionId)]:
          InvestigationExecutionDetailFixture({
            id: skeletonQueryExecutionId,
            status: 'running',
            blocks: [],
          }),
      }}
    >
      <Container minHeight="520px" border="primary" radius="md" overflow="hidden">
        <StoryTopBar>
          <InvestigationBootstrapPage investigationId={skeletonInvestigation.id} />
        </StoryTopBar>
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Report pending while the run is still reporting', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-reporting"
      details={[reportingInvestigation]}
      orchestration={{
        [reportingInvestigation.id]: InvestigationOrchestrationFixture({
          investigationId: reportingInvestigation.id,
          phase: 'reporting',
          status: 'processing',
        }),
      }}
    >
      <Container minHeight="720px" border="primary" radius="md" overflow="hidden">
        <StoryTopBar>
          <InvestigationBootstrapPage investigationId={reportingInvestigation.id} />
        </StoryTopBar>
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Agentic run gathering context', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-gathering-context"
      details={[gatheringContextInvestigation]}
      orchestration={{[gatheringContextInvestigation.id]: gatheringContextOrchestration}}
    >
      <Container minHeight="720px" border="primary" radius="md" overflow="hidden">
        <StoryTopBar>
          <InvestigationBootstrapPage
            investigationId={gatheringContextInvestigation.id}
          />
        </StoryTopBar>
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Agentic run awaiting input before any hypotheses', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-awaiting-input-run"
      details={[awaitingInputRunInvestigation]}
      orchestration={{
        [awaitingInputRunInvestigation.id]: InvestigationOrchestrationFixture({
          investigationId: awaitingInputRunInvestigation.id,
          phase: 'intake',
          status: 'awaiting_input',
          hypotheses: [],
        }),
      }}
    >
      <Container minHeight="720px" border="primary" radius="md" overflow="hidden">
        <StoryTopBar>
          <InvestigationBootstrapPage
            investigationId={awaitingInputRunInvestigation.id}
          />
        </StoryTopBar>
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Awaiting user input', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-awaiting-input"
      details={[awaitingInputInvestigation]}
      executions={{
        [investigationExecutionFixtureKey(
          'awaiting-input-block',
          awaitingInputExecutionId
        )]: InvestigationAwaitingInputExecutionFixture({
          id: awaitingInputExecutionId,
          status: 'awaiting_input',
          partialMarkdown:
            'The lag spike appears in two environments with different traffic profiles.',
          blocks: [
            InvestigationTranscriptBlockFixture({
              id: 'awaiting-input-analysis',
              message: {
                role: 'assistant',
                content:
                  'I found separate lag spikes in production and staging. Choose the environment to analyze in depth.',
              },
            }),
          ],
          pendingUserInput: {
            id: 'environment-question',
            input_type: 'ask_user_question',
            data: {
              questions: [
                {
                  question: 'Which environment should I inspect?',
                  options: [
                    {
                      label: 'Production',
                      description: 'Analyze the customer-facing traffic spike.',
                    },
                    {
                      label: 'Staging',
                      description: 'Analyze the smaller pre-release traffic spike.',
                    },
                  ],
                },
              ],
            },
          },
        }),
      }}
    >
      <Container minHeight="700px" border="primary" radius="md" overflow="hidden">
        <StoryTopBar>
          <InvestigationBootstrapPage investigationId={awaitingInputInvestigation.id} />
        </StoryTopBar>
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Failures and cancellations', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-failures"
      details={[failureInvestigation]}
    >
      <Container minHeight="720px" border="primary" radius="md" overflow="hidden">
        <StoryTopBar>
          <InvestigationBootstrapPage investigationId={failureInvestigation.id} />
        </StoryTopBar>
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Archived and read-only', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-archived"
      details={[archivedInvestigation]}
    >
      <Container minHeight="360px" border="primary" radius="md" overflow="hidden">
        {/* The top bar shows the disabled Comment button. */}
        <StoryTopBar>
          <InvestigationBootstrapPage investigationId={archivedInvestigation.id} />
        </StoryTopBar>
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Loading', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-detail-loading"
      mode="loading"
    >
      <Container minHeight="360px" border="primary" radius="md" overflow="hidden">
        <StoryTopBar>
          <InvestigationBootstrapPage investigationId="loading-investigation" />
        </StoryTopBar>
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Error', () => (
    <Stack gap="md" align="start">
      <CrashReportPreviewButton />
      <Stack
        minHeight="420px"
        width="100%"
        padding="2xl 3xl"
        border="primary"
        radius="md"
      >
        <RouteError />
      </Stack>
    </Stack>
  ));
});
