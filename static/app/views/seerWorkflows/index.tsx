import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconChevron, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

type SeerNightShiftRunIssue = {
  action: string;
  dateAdded: string;
  groupId: string;
  id: string;
  seerRunId: string | null;
};

type SeerNightShiftRun = {
  dateAdded: string;
  errorMessage: string | null;
  extras: Record<string, unknown>;
  id: string;
  issues: SeerNightShiftRunIssue[];
  triageStrategy: string;
};

function SeerWorkflows() {
  const organization = useOrganization();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const {data, isPending, isError, refetch} = useQuery(
    apiOptions.as<SeerNightShiftRun[]>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/',
      {
        path: {organizationIdOrSlug: organization.slug},
        staleTime: 0,
      }
    )
  );

  const toggleExpanded = (runId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  return (
    <SentryDocumentTitle title={t('Seer Workflows')} orgSlug={organization.slug}>
      <Flex direction="column" gap="lg" padding="xl">
        <Heading as="h1">{t('Seer Workflows')}</Heading>
        <Text as="p" variant="muted">
          {t('Historical runs of Seer workflows for this organization.')}
        </Text>

        {isError ? (
          <LoadingError onRetry={refetch} />
        ) : isPending ? (
          <LoadingIndicator />
        ) : (
          <RunsTable>
            <SimpleTable.Header>
              <SimpleTable.HeaderCell />
              <SimpleTable.HeaderCell>{t('Date')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Workflow')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Strategy')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Issues')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell />
            </SimpleTable.Header>

            {data?.length === 0 ? (
              <SimpleTable.Empty>{t('No workflow runs yet.')}</SimpleTable.Empty>
            ) : (
              (data ?? []).map(run => {
                const isExpanded = expanded.has(run.id);
                const status = run.errorMessage ? t('Error') : t('Completed');
                const explorerRunId = getExplorerRunId(run);
                return (
                  <Fragment key={run.id}>
                    <SimpleTable.Row>
                      <SimpleTable.RowCell>
                        <Button
                          aria-label={isExpanded ? t('Collapse run') : t('Expand run')}
                          size="xs"
                          priority="transparent"
                          icon={<IconChevron direction={isExpanded ? 'down' : 'right'} />}
                          onClick={() => toggleExpanded(run.id)}
                        />
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <DateTime date={run.dateAdded} />
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>{t('Night Shift')}</SimpleTable.RowCell>
                      <SimpleTable.RowCell>{run.triageStrategy}</SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <Text variant={run.errorMessage ? 'danger' : undefined}>
                          {status}
                        </Text>
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>{run.issues.length}</SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        {explorerRunId === null ? null : (
                          <LinkButton
                            size="xs"
                            icon={<IconOpen />}
                            to={{
                              pathname: `/organizations/${organization.slug}/issues/`,
                              query: {explorerRunId},
                            }}
                          >
                            {t('Explorer')}
                          </LinkButton>
                        )}
                      </SimpleTable.RowCell>
                    </SimpleTable.Row>

                    {isExpanded && (
                      <SimpleTable.Row variant="faded">
                        <Container
                          background="secondary"
                          padding="lg xl"
                          style={{gridColumn: '1 / -1'}}
                        >
                          <RunDetail run={run} organizationSlug={organization.slug} />
                        </Container>
                      </SimpleTable.Row>
                    )}
                  </Fragment>
                );
              })
            )}
          </RunsTable>
        )}
      </Flex>
    </SentryDocumentTitle>
  );
}

function RunDetail({
  run,
  organizationSlug,
}: {
  organizationSlug: string;
  run: SeerNightShiftRun;
}) {
  return (
    <Flex direction="column" gap="lg">
      {run.errorMessage ? (
        <Text variant="danger" size="sm">
          {t('Error: ')}
          {run.errorMessage}
        </Text>
      ) : null}

      <Flex direction="column" gap="sm">
        <Text bold size="xs" variant="muted" uppercase>
          {t('Issues (%s)', run.issues.length)}
        </Text>

        {run.issues.length === 0 ? (
          <Text variant="muted" size="sm">
            {t('No issues processed in this run.')}
          </Text>
        ) : (
          <Grid
            columns="max-content max-content max-content max-content"
            gap="sm xl"
            align="center"
          >
            <Text bold size="xs" variant="muted">
              {t('Group')}
            </Text>
            <Text bold size="xs" variant="muted">
              {t('Action')}
            </Text>
            <Text bold size="xs" variant="muted">
              {t('Seer Run ID')}
            </Text>
            <span />
            {run.issues.flatMap(issue => [
              <Link
                key={`${issue.id}-group`}
                to={`/organizations/${organizationSlug}/issues/${issue.groupId}/`}
              >
                {issue.groupId}
              </Link>,
              <Text key={`${issue.id}-action`} size="sm">
                {issue.action}
              </Text>,
              <Text key={`${issue.id}-seer`} size="sm" variant="muted">
                {issue.seerRunId ?? '-'}
              </Text>,
              issue.seerRunId === null ? (
                <span key={`${issue.id}-explorer`} />
              ) : (
                <LinkButton
                  key={`${issue.id}-explorer`}
                  size="xs"
                  icon={<IconOpen />}
                  to={{
                    pathname: `/organizations/${organizationSlug}/issues/`,
                    query: {explorerRunId: issue.seerRunId},
                  }}
                >
                  {t('Explorer')}
                </LinkButton>
              ),
            ])}
          </Grid>
        )}
      </Flex>
    </Flex>
  );
}

const RunsTable = styled(SimpleTable)`
  grid-template-columns: min-content 1fr 1fr 1fr 1fr min-content min-content;
`;

function getExplorerRunId(run: SeerNightShiftRun): number | string | null {
  const value = run.extras.agent_run_id;
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  return null;
}

export default SeerWorkflows;
