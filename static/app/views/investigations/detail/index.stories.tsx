import {Container} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';
import {
  InvestigationFixtureApi,
  investigationExecutionFixtureKey,
} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import {InvestigationBootstrapPage} from 'sentry/views/investigations/detail';
import {
  InvestigationBlockExecutionFixture,
  InvestigationBlockFixture,
  InvestigationBreachedMetricDetailFixture,
  InvestigationDetailFixture,
  InvestigationFailedDetailFixture,
  InvestigationHypothesisFixture,
  InvestigationOrchestrationFixture,
  InvestigationAwaitingInputExecutionFixture,
  InvestigationExecutionDetailFixture,
  InvestigationQueryOutputFixture,
  InvestigationRunningDetailFixture,
  InvestigationTitleGenerationFixture,
  InvestigationTranscriptBlockFixture,
} from 'sentry/views/investigations/fixtures';

// A completed agentic run. Seer marks the report's query cells `queryCollapsed`.
const agenticReportInvestigation = InvestigationDetailFixture({
  id: 'completed-agentic-report',
  title: 'Why does the cart latency monitor keep firing overnight?',
  status: 'active',
  sourceType: 'metric_open_period',
  dateCreated: '2026-10-07T16:22:00Z',
  dateUpdated: '2026-10-07T16:26:00Z',
  summary: 'Cart p95 latency fires on thin overnight traffic, not slow carts',
  summaryDescription:
    'In the last 30 days it opened 15 issues.\nThe 14 overnight ones resolved on their own within 4 minutes and needed no action, but each still started a Breached Metrics run and posted to #checkout-alerts.',
  template: {key: 'breached_metric', version: 1},
  orchestration: {
    phase: 'completed',
    status: 'completed',
    heartbeatAt: '2026-10-07T16:26:00Z',
    notebookRevision: 9,
  },
  source: {
    type: 'metric_open_period',
    ref: {groupId: 'cart-latency-issue', openPeriodId: 'open-period-231'},
    revision: 1,
    snapshot: {monitor: {id: '231', name: 'Cart p95 latency'}},
  },
  blocks: [
    InvestigationBlockFixture({
      id: 'what-happened',
      title: 'What happened',
      outputStatus: 'completed',
      output: {
        schemaVersion: 1,
        markdown:
          '## What happened\n\nCart p95 latency opened 15 metric issues in the last 30 days. Fourteen came overnight and resolved on their own within 4 minutes. Each one still started a Breached Metrics run and posted to #checkout-alerts, and none needed action. The fifteenth, on Sep 12, was a real slowdown.',
      },
      currentExecution: InvestigationBlockExecutionFixture({id: 'what-happened-run'}),
    }),
    InvestigationBlockFixture({
      id: 'monitor-issues',
      position: 1,
      kind: 'query',
      title: 'Issues this monitor opened',
      outputStatus: 'completed',
      output: InvestigationQueryOutputFixture({
        preferredView: 'table',
        tableMarkdown:
          '| Opened | Duration | Peak p95 |\n| --- | ---: | ---: |\n| Oct 6, 02:14 | 3m | 1.21s |\n| Oct 4, 03:41 | 2m | 980ms |\n| Sep 12, 14:05 | 47m | 1.62s |',
      }),
      currentExecution: InvestigationBlockExecutionFixture({id: 'monitor-issues-run'}),
      display: {type: 'table', queryCollapsed: true},
    }),
    InvestigationBlockFixture({
      id: 'why-it-fires',
      position: 2,
      title: 'Why it keeps firing',
      outputStatus: 'completed',
      output: {
        schemaVersion: 1,
        markdown:
          '## Why it keeps firing\n\nA p95 over a few requests is set by the slowest ones. At night, a 1-minute window holds 12–35 cart requests, so one or two slow requests decide it. Over 10 minutes, the same night stays near 450 ms.',
      },
      currentExecution: InvestigationBlockExecutionFixture({id: 'why-it-fires-run'}),
    }),
    InvestigationBlockFixture({
      id: 'overnight-windows',
      position: 3,
      kind: 'query',
      title: 'Cart p95 overnight, 1-minute and 10-minute windows',
      outputStatus: 'completed',
      output: InvestigationQueryOutputFixture({
        preferredView: 'chart',
        tableMarkdown:
          '| Time | 1-minute p95 | 10-minute p95 |\n| --- | ---: | ---: |\n| 02:00 | 430ms | 442ms |\n| 02:10 | 1.21s | 468ms |\n| 02:20 | 455ms | 451ms |',
        chart: {
          title: 'Cart p95 overnight, 1-minute and 10-minute windows',
          visualization: 'line',
          x_axis: 'time',
          y_axis_unit: 'duration',
          series: [
            {
              label: '1-minute p95',
              data: [
                {x: '2026-10-06T02:00:00Z', y: 430},
                {x: '2026-10-06T02:10:00Z', y: 1210},
                {x: '2026-10-06T02:20:00Z', y: 455},
                {x: '2026-10-06T02:30:00Z', y: 441},
              ],
            },
            {
              label: '10-minute p95',
              data: [
                {x: '2026-10-06T02:00:00Z', y: 442},
                {x: '2026-10-06T02:10:00Z', y: 468},
                {x: '2026-10-06T02:20:00Z', y: 451},
                {x: '2026-10-06T02:30:00Z', y: 447},
              ],
            },
          ],
        },
      }),
      currentExecution: InvestigationBlockExecutionFixture({id: 'overnight-windows-run'}),
      display: {type: 'chart', queryCollapsed: true},
    }),
    InvestigationBlockFixture({
      id: 'day-and-night',
      position: 4,
      kind: 'query',
      title: 'Cart requests, day and night',
      outputStatus: 'completed',
      output: InvestigationQueryOutputFixture({
        preferredView: 'table',
        tableMarkdown:
          '| Window | Requests per minute | p95 |\n| --- | ---: | ---: |\n| 09:00–21:00 | 1,840 | 412ms |\n| 01:00–05:00 | 12–35 | 446ms |',
      }),
      currentExecution: InvestigationBlockExecutionFixture({id: 'day-and-night-run'}),
      display: {type: 'table', queryCollapsed: true},
    }),
    InvestigationBlockFixture({
      id: 'how-it-works',
      position: 5,
      title: 'How this monitor works',
      outputStatus: 'completed',
      output: {
        schemaVersion: 1,
        markdown:
          "## How this monitor works\n\nSeer read the monitor's settings. Every minute, it computes the p95 of that minute's cart spans. When the value crosses 800 ms it opens a metric issue, and it resolves the issue when the value drops back. The interval decides how many requests each p95 covers, so it's the setting to change.",
      },
      currentExecution: InvestigationBlockExecutionFixture({id: 'how-it-works-run'}),
    }),
    InvestigationBlockFixture({
      id: 'monitor-settings',
      position: 6,
      kind: 'query',
      title: 'Cart p95 latency settings',
      outputStatus: 'completed',
      output: InvestigationQueryOutputFixture({
        preferredView: 'table',
        tableMarkdown:
          '| Setting | Value |\n| --- | --- |\n| Measures | p95(span.duration) · transaction:/api/cart |\n| Interval | 1 minute |\n| Opens an issue | Above 800 ms |',
      }),
      currentExecution: InvestigationBlockExecutionFixture({id: 'monitor-settings-run'}),
      display: {type: 'table', queryCollapsed: true},
    }),
  ],
});

const agenticReportOrchestration = InvestigationOrchestrationFixture({
  investigationId: agenticReportInvestigation.id,
  phase: 'completed',
  status: 'completed',
  startedAt: '2026-10-07T16:22:00Z',
  finishedAt: '2026-10-07T16:26:05Z',
  activeSince: null,
  activeTimeElapsedSeconds: 245,
  hypotheses: [
    InvestigationHypothesisFixture({
      id: 'thin-traffic',
      statement: 'Thin overnight traffic skews a 1-minute p95',
      rationale:
        'Overnight windows hold 12–35 requests, so one or two slow ones set the p95.',
    }),
    InvestigationHypothesisFixture({
      id: 'slow-carts',
      order: 1,
      statement: 'Cart requests got slower overnight',
      rationale: 'The 10-minute p95 stays near 450 ms through the same nights.',
      effectiveStatus: 'refuted',
    }),
    InvestigationHypothesisFixture({
      id: 'batch-jobs',
      order: 2,
      statement: 'Overnight batch jobs contend for the database',
      rationale: 'No database span slows during the breaches.',
      effectiveStatus: 'refuted',
    }),
  ],
  report: {
    ...InvestigationOrchestrationFixture().report,
    status: 'completed',
    primaryHypothesisId: 'thin-traffic',
  },
});

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
  template: {key: 'breached_metric', version: 1},
  source: {
    type: 'metric_open_period',
    ref: {groupId: 'metric-alert-42', openPeriodId: 'open-period-17'},
    revision: 1,
    snapshot: {monitor: {id: '42', name: 'Checkout p95 latency'}},
  },
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
  template: {key: 'breached_metric', version: 1},
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
      dependencies: ['running-summary'],
      currentExecution: InvestigationBlockExecutionFixture({
        id: runningQueryExecutionId,
        status: 'pending',
        startedAt: null,
        completedAt: null,
      }),
    }),
    InvestigationBlockFixture({
      id: 'waiting-synthesis',
      position: 2,
      title: 'Synthesize findings',
      content: '',
      generationPrompt: 'Summarize the likely cause and recommended next steps.',
      config: {autoRun: true},
      dependencies: ['running-summary', 'running-query'],
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
  template: {key: 'breached_metric', version: 1},
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
      dependencies: ['skeleton-summary'],
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
  template: {key: 'breached_metric', version: 1},
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
  template: {key: 'breached_metric', version: 1},
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
      id: 'awaiting-input-cell',
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
  position: 2,
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
  blocks: [
    failedBlock,
    InvestigationBlockFixture({
      id: 'blocked-by-failure',
      position: 1,
      title: 'Summarize the release regression',
      content: '',
      config: {autoRun: true},
      dependencies: [failedBlock.id],
    }),
    cancelledBlock,
    InvestigationBlockFixture({
      id: 'blocked-by-cancellation',
      position: 3,
      title: 'Recommend next steps',
      content: '',
      config: {autoRun: true},
      dependencies: [cancelledBlock.id],
    }),
  ],
});

const archivedInvestigation = InvestigationDetailFixture({
  id: 'archived-investigation',
  title: 'Elevated API error rate during certificate rotation',
  status: 'archived',
  sourceType: 'breached_metric',
  dateCreated: '2026-08-27T15:44:00Z',
  dateUpdated: '2026-08-27T15:44:00Z',
  blocks: [],
  template: {key: 'breached_metric', version: 1},
});

export default Storybook.story('Investigations — Detail', story => {
  story('Completed agentic report', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-agentic-report"
      details={[agenticReportInvestigation]}
      orchestration={{[agenticReportInvestigation.id]: agenticReportOrchestration}}
      groups={{
        'cart-latency-issue': {
          id: 'cart-latency-issue',
          shortId: 'CHECKOUT-231',
          title: 'Cart p95 latency',
        },
      }}
    >
      <Container minHeight="720px" border="primary" radius="md" overflow="hidden">
        <InvestigationBootstrapPage investigationId={agenticReportInvestigation.id} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Completed with every output type', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-completed"
      details={[completedInvestigation]}
    >
      <Container minHeight="720px" border="primary" radius="md" overflow="hidden">
        <InvestigationBootstrapPage investigationId={completedInvestigation.id} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Active manual notebook', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-manual"
      details={[manualInvestigation]}
    >
      <Container minHeight="680px" border="primary" radius="md" overflow="hidden">
        <InvestigationBootstrapPage investigationId={manualInvestigation.id} />
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
        <InvestigationBootstrapPage investigationId={runningInvestigation.id} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Cells Seer is still writing', () => (
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
        <InvestigationBootstrapPage investigationId={skeletonInvestigation.id} />
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
        <InvestigationBootstrapPage investigationId={reportingInvestigation.id} />
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
        <InvestigationBootstrapPage investigationId={awaitingInputRunInvestigation.id} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Awaiting user input', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-awaiting-input"
      details={[awaitingInputInvestigation]}
      executions={{
        [investigationExecutionFixtureKey(
          'awaiting-input-cell',
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
        <InvestigationBootstrapPage investigationId={awaitingInputInvestigation.id} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Failures, cancellations, and blocked dependencies', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-failures"
      details={[failureInvestigation]}
    >
      <Container minHeight="720px" border="primary" radius="md" overflow="hidden">
        <InvestigationBootstrapPage investigationId={failureInvestigation.id} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Archived and read-only', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-archived"
      details={[archivedInvestigation]}
    >
      <Container minHeight="360px" border="primary" radius="md" overflow="hidden">
        <InvestigationBootstrapPage investigationId={archivedInvestigation.id} />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Loading', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-detail-loading"
      mode="loading"
    >
      <Container minHeight="360px" border="primary" radius="md" overflow="hidden">
        <InvestigationBootstrapPage investigationId="loading-investigation" />
      </Container>
    </InvestigationFixtureApi>
  ));

  story('Error', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-detail-error"
      mode="error"
    >
      <Container minHeight="420px" border="primary" radius="md" overflow="hidden">
        <InvestigationBootstrapPage investigationId="error-investigation" />
      </Container>
    </InvestigationFixtureApi>
  ));
});
