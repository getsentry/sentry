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
  InvestigationAwaitingInputExecutionFixture,
  InvestigationExecutionDetailFixture,
  InvestigationQueryOutputFixture,
  InvestigationRunningDetailFixture,
  InvestigationTitleGenerationFixture,
  InvestigationTranscriptBlockFixture,
} from 'sentry/views/investigations/fixtures';

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
