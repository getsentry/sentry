import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {
  InvestigationFixtureApi,
  investigationExecutionFixtureKey,
} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import {InvestigationCell} from 'sentry/views/investigations/detail/cell';
import {
  InvestigationBlockExecutionFixture,
  InvestigationBlockFixture,
  InvestigationDetailFixture,
  InvestigationExecutionDetailFixture,
  InvestigationTranscriptBlockFixture,
} from 'sentry/views/investigations/fixtures';

const completedDependency = InvestigationBlockFixture({
  id: 'completed-dependency',
  title: 'Collect baseline evidence',
  outputStatus: 'completed',
  output: {schemaVersion: 1, markdown: 'Baseline evidence collected.'},
  currentExecution: InvestigationBlockExecutionFixture({id: 'completed-dependency-run'}),
});
const notRunBlock = InvestigationBlockFixture({
  id: 'not-run-cell',
  position: 1,
  title: 'Not run',
  content: '',
  generationPrompt: 'Summarize the current evidence.',
});
const availableBlock = InvestigationBlockFixture({
  id: 'available-cell',
  position: 2,
  title: 'Available output',
  content: '',
  outputStatus: 'available',
  output: {
    schemaVersion: 1,
    markdown: 'The latest deploy is correlated with the start of the regression.',
  },
});
const restrictedBlock = InvestigationBlockFixture({
  id: 'restricted-cell',
  position: 3,
  title: 'Restricted output',
  content: '',
  outputStatus: 'restricted',
});
const waitingBlock = InvestigationBlockFixture({
  id: 'waiting-cell',
  position: 4,
  title: 'Waiting for dependencies',
  content: '',
  config: {autoRun: true},
  dependencies: [completedDependency.id],
});
const completedBlock = InvestigationBlockFixture({
  id: 'completed-cell',
  position: 5,
  title: 'Completed',
  content: '',
  outputStatus: 'completed',
  output: {
    schemaVersion: 1,
    markdown: 'Connection acquisition accounts for 71% of the added latency.',
  },
  currentExecution: InvestigationBlockExecutionFixture({id: 'completed-cell-run'}),
});
const preRunInvestigation = InvestigationDetailFixture({
  id: 'cell-pre-run-states',
  blocks: [
    completedDependency,
    notRunBlock,
    availableBlock,
    restrictedBlock,
    waitingBlock,
    completedBlock,
  ],
});

const pendingExecutionId = 'pending-cell-run';
const runningExecutionId = 'running-cell-run';
const stoppingExecutionId = 'stopping-cell-run';
const pendingBlock = InvestigationBlockFixture({
  id: 'pending-cell',
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
const runningBlock = InvestigationBlockFixture({
  id: 'running-cell',
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
const stoppingBlock = InvestigationBlockFixture({
  id: 'stopping-cell',
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
const activeInvestigation = InvestigationDetailFixture({
  id: 'cell-active-states',
  blocks: [pendingBlock, runningBlock, stoppingBlock],
});

const completedPanelExecutionId = 'completed-panel-run';
const failedPanelExecutionId = 'failed-panel-run';
const cancelledPanelExecutionId = 'cancelled-panel-run';
const completedPanelBlock = InvestigationBlockFixture({
  id: 'completed-panel-cell',
  title: 'Completed agent activity',
  content: '',
  outputStatus: 'running',
  currentExecution: InvestigationBlockExecutionFixture({
    id: completedPanelExecutionId,
    status: 'running',
    completedAt: null,
  }),
});
const failedPanelBlock = InvestigationBlockFixture({
  id: 'failed-panel-cell',
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
const cancelledPanelBlock = InvestigationBlockFixture({
  id: 'cancelled-panel-cell',
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
const terminalPanelInvestigation = InvestigationDetailFixture({
  id: 'cell-terminal-panels',
  blocks: [completedPanelBlock, failedPanelBlock, cancelledPanelBlock],
});

export default Storybook.story('Investigations — Cells', story => {
  story('Pre-run and terminal output states', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-cell-pre-run"
      details={[preRunInvestigation]}
    >
      <Stack gap="2xl">
        <Stack gap="sm" padding="lg" border="primary" radius="md">
          <Heading as="h3" size="md">
            Not run
          </Heading>
          <InvestigationCell
            block={notRunBlock}
            canRun
            investigation={preRunInvestigation}
          />
        </Stack>
        <Stack gap="sm" padding="lg" border="primary" radius="md">
          <Heading as="h3" size="md">
            Available
          </Heading>
          <InvestigationCell
            block={availableBlock}
            canRun
            investigation={preRunInvestigation}
          />
        </Stack>
        <Stack gap="sm" padding="lg" border="primary" radius="md">
          <Heading as="h3" size="md">
            Restricted
          </Heading>
          <InvestigationCell
            block={restrictedBlock}
            canRun={false}
            investigation={preRunInvestigation}
          />
        </Stack>
        <Stack gap="sm" padding="lg" border="primary" radius="md">
          <Heading as="h3" size="md">
            Waiting for an auto-run dependency
          </Heading>
          <InvestigationCell
            block={waitingBlock}
            canRun
            investigation={preRunInvestigation}
          />
        </Stack>
        <Stack gap="sm" padding="lg" border="primary" radius="md">
          <Heading as="h3" size="md">
            Completed
          </Heading>
          <InvestigationCell
            block={completedBlock}
            canRun
            investigation={preRunInvestigation}
          />
        </Stack>
      </Stack>
    </InvestigationFixtureApi>
  ));

  story('Pending, running, and stopping executions', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-cell-active"
      details={[activeInvestigation]}
      executions={{
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
                id: 'running-cell-step',
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
                id: 'stopping-cell-step',
                message: {
                  role: 'assistant',
                  content: 'Stopping after the current query finishes…',
                },
              }),
            ],
          }),
      }}
    >
      <Stack gap="2xl">
        <Stack gap="sm" padding="lg" border="primary" radius="md">
          <Heading as="h3" size="md">
            Pending
          </Heading>
          <InvestigationCell
            block={pendingBlock}
            canRun
            investigation={activeInvestigation}
          />
        </Stack>
        <Stack gap="sm" padding="lg" border="primary" radius="md">
          <Heading as="h3" size="md">
            Running
          </Heading>
          <InvestigationCell
            block={runningBlock}
            canRun
            investigation={activeInvestigation}
          />
        </Stack>
        <Stack gap="sm" padding="lg" border="primary" radius="md">
          <Heading as="h3" size="md">
            Stopping
          </Heading>
          <InvestigationCell
            block={stoppingBlock}
            canRun
            investigation={activeInvestigation}
          />
        </Stack>
      </Stack>
    </InvestigationFixtureApi>
  ));

  story('Completed, failed, and cancelled agent activity', () => (
    <InvestigationFixtureApi
      organizationSlug="storybook-investigation-cell-terminal-panels"
      details={[terminalPanelInvestigation]}
      executions={{
        [investigationExecutionFixtureKey(
          completedPanelBlock.id,
          completedPanelExecutionId
        )]: InvestigationExecutionDetailFixture({
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
        [investigationExecutionFixtureKey(
          cancelledPanelBlock.id,
          cancelledPanelExecutionId
        )]: InvestigationExecutionDetailFixture({
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
      }}
    >
      <Stack gap="2xl">
        <InvestigationCell
          block={completedPanelBlock}
          canRun
          investigation={terminalPanelInvestigation}
        />
        <InvestigationCell
          block={failedPanelBlock}
          canRun
          investigation={terminalPanelInvestigation}
        />
        <InvestigationCell
          block={cancelledPanelBlock}
          canRun
          investigation={terminalPanelInvestigation}
        />
      </Stack>
    </InvestigationFixtureApi>
  ));
});
