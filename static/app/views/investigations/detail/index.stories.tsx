import {Fragment, useMemo} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {useOrganization} from 'sentry/utils/useOrganization';
import {InvestigationPageContent} from 'sentry/views/investigations/detail/index';
import {
  InvestigationBreachedMetricDetailFixture,
  InvestigationDetailFixture,
  InvestigationExecutionDetailFixture,
  InvestigationFailedDetailFixture,
  InvestigationRunningDetailFixture,
} from 'sentry/views/investigations/fixtures';
import {
  InvestigationsStoryProviders,
  seedInvestigationExecution,
  seedInvestigationTitleGeneration,
} from 'sentry/views/investigations/storyHelpers';
import type {
  InvestigationDetail,
  InvestigationExecutionDetail,
  InvestigationTitleGeneration,
} from 'sentry/views/investigations/types';

function DetailExample({
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

function DetailStory({
  investigation,
  seed,
  titleGeneration,
  executions = [],
}: {
  investigation: InvestigationDetail;
  executions?: Array<{
    blockId: string;
    execution: InvestigationExecutionDetail;
  }>;
  seed?: Parameters<typeof InvestigationsStoryProviders>[0]['seed'];
  titleGeneration?: InvestigationTitleGeneration;
}) {
  const organization = useOrganization();
  const detailUrl = `/organizations/${organization.slug}/investigations/${investigation.id}/`;
  const apiResponses = useMemo(() => {
    const responses = [{url: detailUrl, response: {body: investigation}}];
    if (titleGeneration) {
      responses.push({
        url: `/organizations/${organization.slug}/investigations/${investigation.id}/title-generation/`,
        response: {body: titleGeneration},
      });
    }
    for (const {blockId, execution} of executions) {
      responses.push({
        url: `/organizations/${organization.slug}/investigations/${investigation.id}/blocks/${blockId}/executions/${execution.id}/`,
        response: {body: execution},
      });
    }
    return responses;
  }, [detailUrl, executions, investigation, organization.slug, titleGeneration]);

  return (
    <InvestigationsStoryProviders
      apiResponses={apiResponses}
      seed={(queryClient, org) => {
        if (titleGeneration) {
          seedInvestigationTitleGeneration(
            queryClient,
            org.slug,
            investigation.id,
            titleGeneration
          );
        }
        for (const {blockId, execution} of executions) {
          seedInvestigationExecution(
            queryClient,
            org.slug,
            investigation.id,
            blockId,
            execution
          );
        }
        seed?.(queryClient, org);
      }}
    >
      <InvestigationPageContent investigation={investigation} />
    </InvestigationsStoryProviders>
  );
}

export default Storybook.story('Investigation Detail', story => {
  story('Completed notebook', () => {
    const investigation = InvestigationBreachedMetricDetailFixture();

    return (
      <Fragment>
        <p>
          Full detail chrome with summary card, completed text/query cells, and the add
          cell composer. Seeded fixtures keep this offline.
        </p>
        <DetailStory investigation={investigation} />
      </Fragment>
    );
  });

  story('Manual investigation without summary', () => {
    const investigation = InvestigationDetailFixture();

    return (
      <Fragment>
        <p>
          Manual investigations omit the breached-metric summary card and treat every
          block as a notebook cell.
        </p>
        <DetailStory investigation={investigation} />
      </Fragment>
    );
  });

  story('Running generation + auto-run cells', () => {
    const investigation = InvestigationRunningDetailFixture();
    const titleGeneration = {
      status: 'running' as const,
      preview: 'Checkout error rate spike',
    };
    const runningExecution = InvestigationExecutionDetailFixture({
      id: 'execution-1',
      status: 'running',
      blocks: [],
      partialMarkdown: 'Errors are concentrated in checkout…',
    });

    return (
      <Fragment>
        <p>
          Title generation streams a preview while auto-run cells show running / waiting
          progress.
        </p>
        <DetailStory
          investigation={investigation}
          titleGeneration={titleGeneration}
          executions={[{blockId: 'block-1', execution: runningExecution}]}
        />
      </Fragment>
    );
  });

  story('Failed auto-run branch', () => {
    const investigation = InvestigationFailedDetailFixture();

    return (
      <Fragment>
        <p>
          A failed upstream cell blocks dependent auto-run cells and surfaces the
          execution error.
        </p>
        <DetailStory investigation={investigation} />
      </Fragment>
    );
  });

  story('Non-active investigation hides add-cell composer', () => {
    const investigation = InvestigationDetailFixture({
      status: 'completed',
      title: 'Archived investigation',
    });

    return (
      <DetailExample label="status=completed">
        <DetailStory investigation={investigation} />
      </DetailExample>
    );
  });
});
