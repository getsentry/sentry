import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconChevron} from 'sentry/icons';
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
      <Container>
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
            </SimpleTable.Header>

            {data?.length === 0 ? (
              <SimpleTable.Empty>{t('No workflow runs yet.')}</SimpleTable.Empty>
            ) : (
              (data ?? []).map(run => {
                const isExpanded = expanded.has(run.id);
                const status = run.errorMessage ? t('Error') : t('Completed');
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
                    </SimpleTable.Row>

                    {isExpanded && (
                      <SimpleTable.Row variant="faded">
                        <FullWidthCell>
                          <RunDetail run={run} organizationSlug={organization.slug} />
                        </FullWidthCell>
                      </SimpleTable.Row>
                    )}
                  </Fragment>
                );
              })
            )}
          </RunsTable>
        )}
      </Container>
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
    <Flex direction="column" gap="sm" padding="md lg">
      {run.errorMessage ? (
        <Text variant="danger" size="sm">
          {t('Error: ')}
          {run.errorMessage}
        </Text>
      ) : null}

      {Object.keys(run.extras).length > 0 ? (
        <Fragment>
          <Text bold size="xs" variant="muted" uppercase>
            {t('Extras')}
          </Text>
          <ExtrasPre>{JSON.stringify(run.extras, null, 2)}</ExtrasPre>
        </Fragment>
      ) : null}

      <Text bold size="xs" variant="muted" uppercase>
        {t('Issues (%s)', run.issues.length)}
      </Text>

      {run.issues.length === 0 ? (
        <Text variant="muted" size="sm">
          {t('No issues processed in this run.')}
        </Text>
      ) : (
        <IssuesTable>
          <colgroup>
            <col style={{width: '120px'}} />
            <col style={{width: '200px'}} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>{t('Group')}</th>
              <th>{t('Action')}</th>
              <th>{t('Seer Run ID')}</th>
            </tr>
          </thead>
          <tbody>
            {run.issues.map(issue => (
              <tr key={issue.id}>
                <td>
                  <Link
                    to={`/organizations/${organizationSlug}/issues/${issue.groupId}/`}
                  >
                    {issue.groupId}
                  </Link>
                </td>
                <td>{issue.action}</td>
                <td>{issue.seerRunId ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </IssuesTable>
      )}
    </Flex>
  );
}

const Container = styled('div')`
  padding: ${p => p.theme.space.xl};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};
`;

const RunsTable = styled(SimpleTable)`
  grid-template-columns: min-content 1fr 1fr 1fr 1fr min-content;
`;

const FullWidthCell = styled('div')`
  grid-column: 1 / -1;
  background: ${p => p.theme.backgroundSecondary};
`;

const ExtrasPre = styled('pre')`
  margin: 0;
  padding: ${p => p.theme.space.md};
  background: ${p => p.theme.surface100};
  border-radius: ${p => p.theme.radius.md};
  font-size: ${p => p.theme.font.size.sm};
  white-space: pre-wrap;
`;

const IssuesTable = styled('table')`
  width: auto;
  border-collapse: collapse;
  font-size: ${p => p.theme.font.size.sm};
  table-layout: fixed;

  th,
  td {
    padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
    text-align: left;
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
    vertical-align: middle;
    white-space: nowrap;
  }

  th {
    font-weight: ${p => p.theme.font.weight.sans.medium};
    color: ${p => p.theme.tokens.content.secondary};
  }

  tr:last-child td {
    border-bottom: none;
  }
`;

export default SeerWorkflows;
