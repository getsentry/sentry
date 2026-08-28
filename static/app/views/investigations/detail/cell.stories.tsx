import {Fragment, useMemo} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {useOrganization} from 'sentry/utils/useOrganization';
import {InvestigationCell} from 'sentry/views/investigations/detail/cell';
import {
  InvestigationAwaitingInputExecutionFixture,
  InvestigationBlockFixture,
  InvestigationBreachedMetricDetailFixture,
  InvestigationChartOutputFixture,
  InvestigationDetailFixture,
  InvestigationExecutionDetailFixture,
  InvestigationFailedDetailFixture,
  InvestigationRunningDetailFixture,
  InvestigationTableOutputFixture,
} from 'sentry/views/investigations/fixtures';
import {
  InvestigationsStoryProviders,
  seedInvestigationExecution,
} from 'sentry/views/investigations/storyHelpers';
import type {
  InvestigationDetail,
  InvestigationExecutionDetail,
} from 'sentry/views/investigations/types';

function CellExample({
  label,
  children,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Stack gap="sm">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

function CellStory({
  investigation,
  executions = [],
  children,
}: {
  children: React.ReactNode;
  investigation: InvestigationDetail;
  executions?: Array<{
    blockId: string;
    execution: InvestigationExecutionDetail;
  }>;
}) {
  const organization = useOrganization();
  const apiResponses = useMemo(
    () =>
      executions.map(({blockId, execution}) => ({
        url: `/organizations/${organization.slug}/investigations/${investigation.id}/blocks/${blockId}/executions/${execution.id}/`,
        response: {body: execution},
      })),
    [executions, investigation.id, organization.slug]
  );

  return (
    <InvestigationsStoryProviders
      apiResponses={apiResponses}
      seed={(queryClient, org) => {
        for (const {blockId, execution} of executions) {
          seedInvestigationExecution(
            queryClient,
            org.slug,
            investigation.id,
            blockId,
            execution
          );
        }
      }}
    >
      {children}
    </InvestigationsStoryProviders>
  );
}

export default Storybook.story('InvestigationCell', story => {
  story('Completed text and query outputs', () => {
    const investigation = InvestigationBreachedMetricDetailFixture();
    const [textBlock, chartBlock, tableBlock] = investigation.blocks ?? [];

    return (
      <Fragment>
        <p>
          Cells render persisted Seer output. Query cells support chart and table
          preferred views without calling the backend.
        </p>
        <CellStory investigation={investigation}>
          <Stack gap="xl">
            <CellExample label="Text markdown">
              <InvestigationCell
                block={textBlock!}
                canRun
                investigation={investigation}
              />
            </CellExample>
            <CellExample label="Query chart">
              <InvestigationCell
                block={chartBlock!}
                canRun
                investigation={investigation}
              />
            </CellExample>
            <CellExample label="Query table">
              <InvestigationCell
                block={tableBlock!}
                canRun
                investigation={investigation}
              />
            </CellExample>
            <CellExample label="Chart preferred view with invalid chart falls back to table">
              <InvestigationCell
                block={InvestigationBlockFixture({
                  id: 'fallback-block',
                  kind: 'query',
                  title: 'Unavailable chart',
                  output: InvestigationChartOutputFixture({
                    preferredView: 'chart',
                    chart: null,
                    chartUnavailableReason: 'No numeric columns',
                    tableMarkdown: '| fallback |\n| --- |\n| shown |',
                  }),
                  outputStatus: 'completed',
                })}
                canRun
                investigation={investigation}
              />
            </CellExample>
          </Stack>
        </CellStory>
      </Fragment>
    );
  });

  story('Progress and dependency states', () => {
    const running = InvestigationRunningDetailFixture();
    const failed = InvestigationFailedDetailFixture();
    const runningExecution = InvestigationExecutionDetailFixture({
      id: 'execution-1',
      status: 'running',
      blocks: [],
      partialMarkdown: null,
    });

    return (
      <Fragment>
        <p>
          Auto-run notebooks show running, waiting, failed, and blocked-by-failure states
          before output lands.
        </p>
        <CellStory
          investigation={running}
          executions={[{blockId: 'block-1', execution: runningExecution}]}
        >
          <Stack gap="xl">
            <CellExample label="Running text cell">
              <InvestigationCell
                block={running.blocks[0]!}
                canRun
                investigation={running}
              />
            </CellExample>
            <CellExample label="Pending / running query cell">
              <InvestigationCell
                block={running.blocks[1]!}
                canRun
                investigation={running}
              />
            </CellExample>
            <CellExample label="Waiting on dependencies">
              <InvestigationCell
                block={running.blocks[2]!}
                canRun
                investigation={running}
              />
            </CellExample>
            <CellExample label="Failed execution">
              <InvestigationCell
                block={failed.blocks[0]!}
                canRun
                investigation={failed}
              />
            </CellExample>
            <CellExample label="Blocked because a previous cell failed">
              <InvestigationCell
                block={failed.blocks[1]!}
                canRun
                investigation={failed}
              />
            </CellExample>
            <CellExample label="Empty text cell with no output">
              <InvestigationCell
                block={InvestigationBlockFixture({
                  id: 'empty-text',
                  kind: 'text',
                  title: 'Notes',
                  content: '',
                  generationPrompt: '',
                  output: null,
                  outputStatus: 'notRun',
                })}
                canRun
                investigation={InvestigationDetailFixture()}
              />
            </CellExample>
          </Stack>
        </CellStory>
      </Fragment>
    );
  });

  story('Refinement panel paths', () => {
    const completed = InvestigationDetailFixture({
      blocks: [
        InvestigationBlockFixture({
          id: 'refine-text',
          kind: 'text',
          title: 'Summary',
          content: '',
          generationPrompt: 'Summarize the breach',
          output: {schemaVersion: 1, markdown: 'Checkout errors spiked.'},
          outputStatus: 'completed',
          currentExecution: {
            id: 'execution-complete',
            status: 'completed',
            startedAt: '2026-08-17T10:00:00Z',
            completedAt: '2026-08-17T10:01:00Z',
            error: null,
          },
        }),
        InvestigationBlockFixture({
          id: 'refine-running',
          kind: 'query',
          title: 'Error volume',
          content: '',
          generationPrompt: 'Chart errors',
          output: InvestigationTableOutputFixture(),
          outputStatus: 'running',
          currentExecution: {
            id: 'execution-running',
            status: 'running',
            startedAt: '2026-08-17T10:00:00Z',
            completedAt: null,
            error: null,
          },
        }),
        InvestigationBlockFixture({
          id: 'refine-awaiting',
          kind: 'text',
          title: 'Needs input',
          content: '',
          generationPrompt: 'Continue analysis',
          output: null,
          outputStatus: 'awaiting_input',
          currentExecution: {
            id: 'execution-awaiting-input',
            status: 'awaiting_input',
            startedAt: '2026-08-17T10:00:00Z',
            completedAt: null,
            error: null,
          },
        }),
      ],
      blockCount: 3,
    });

    return (
      <Fragment>
        <p>
          Open a cell&apos;s Seer button to review refinement prompt, live transcript,
          stop/resume, and ask-again paths. Fixtures seed execution detail so the panel
          works offline.
        </p>
        <CellStory
          investigation={completed}
          executions={[
            {
              blockId: 'refine-text',
              execution: InvestigationExecutionDetailFixture({
                id: 'execution-complete',
                status: 'completed',
              }),
            },
            {
              blockId: 'refine-running',
              execution: InvestigationExecutionDetailFixture({
                id: 'execution-running',
                status: 'running',
                blocks: [
                  {
                    id: 't1',
                    loading: true,
                    timestamp: '2026-08-17T10:00:05Z',
                    message: {
                      role: 'assistant',
                      content: 'Gathering checkout error samples…',
                    },
                    artifacts: [],
                    toolLinks: null,
                    toolResults: null,
                  },
                ],
                partialMarkdown: null,
              }),
            },
            {
              blockId: 'refine-awaiting',
              execution: InvestigationAwaitingInputExecutionFixture(),
            },
          ]}
        >
          <Stack gap="xl">
            <CellExample label="Completed cell — open Ask Seer for prompt / prior transcript">
              <InvestigationCell
                block={completed.blocks[0]!}
                canRun
                investigation={completed}
              />
            </CellExample>
            <CellExample label="Running cell — open Ask Seer for live transcript + Stop">
              <InvestigationCell
                block={completed.blocks[1]!}
                canRun
                investigation={completed}
              />
            </CellExample>
            <CellExample label="Awaiting input — open Ask Seer to answer the question">
              <InvestigationCell
                block={completed.blocks[2]!}
                canRun
                investigation={completed}
              />
            </CellExample>
            <CellExample label="Read-only (canRun=false) disables run actions">
              <InvestigationCell
                block={completed.blocks[0]!}
                canRun={false}
                investigation={{...completed, status: 'completed'}}
              />
            </CellExample>
          </Stack>
        </CellStory>
      </Fragment>
    );
  });
});
