import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconBot,
  IconCheckmark,
  IconChevron,
  IconClose,
  IconFilter,
  IconOpen,
  IconRefresh,
  IconUser,
  IconWarning,
} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MOCK_FEEDBACK_SUMMARY_ROWS} from 'sentry/views/seerWorkflows/mockRows';
import type {
  RunStatus,
  SeerNightShiftRun,
  WorkflowKind,
  WorkflowRow,
} from 'sentry/views/seerWorkflows/types';

function SeerWorkflows() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(new Set<string>());

  const {data, isPending, isError, refetch} = useQuery(
    apiOptions.as<SeerNightShiftRun[]>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/',
      {
        path: {organizationIdOrSlug: organization.slug},
        staleTime: 0,
      }
    )
  );

  const showMocks = location.query.mock === '1';

  const rows = useMemo<WorkflowRow[]>(() => {
    const apiRows = (data ?? []).map(toWorkflowRow);
    return showMocks ? [...MOCK_FEEDBACK_SUMMARY_ROWS, ...apiRows] : apiRows;
  }, [data, showMocks]);

  const strategyFilter = decodeList(location.query.strategy) as WorkflowKind[];
  const statusFilter = decodeList(location.query.status) as RunStatus[];
  const sourceFilter = decodeList(location.query.source);
  const period = decodeScalar(location.query.period);

  const periodCutoffMs = useMemo(() => {
    const days = PERIOD_TO_DAYS[period ?? ''];
    return days === undefined ? null : Date.now() - days * 24 * 60 * 60 * 1000;
  }, [period]);

  const sourceOptions = useMemo(() => {
    const sources = new Set<string>();
    for (const row of rows) {
      if (row.source) sources.add(row.source);
    }
    return Array.from(sources)
      .map(value => {
        const Icon = SOURCE_ICONS[value];
        return {
          value,
          label: getSourceLabel(value),
          leadingItems: Icon ? <Icon size="xs" /> : undefined,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (strategyFilter.length && !strategyFilter.includes(row.kind)) return false;
      if (statusFilter.length && !statusFilter.includes(row.status)) return false;
      if (sourceFilter.length && (!row.source || !sourceFilter.includes(row.source))) {
        return false;
      }
      if (periodCutoffMs !== null && Date.parse(row.dateAdded) < periodCutoffMs) {
        return false;
      }
      return true;
    });
  }, [rows, strategyFilter, statusFilter, sourceFilter, periodCutoffMs]);

  const sortDirection = decodeScalar(location.query.sort) === 'asc' ? 'asc' : 'desc';

  const sortedRows = useMemo(() => {
    const cmp = (a: WorkflowRow, b: WorkflowRow) =>
      Date.parse(a.dateAdded) - Date.parse(b.dateAdded);
    const next = [...filteredRows].sort(cmp);
    return sortDirection === 'desc' ? next.reverse() : next;
  }, [filteredRows, sortDirection]);

  const hasActiveFilters =
    strategyFilter.length > 0 ||
    statusFilter.length > 0 ||
    sourceFilter.length > 0 ||
    period !== undefined;

  const updateQuery = (patch: Record<string, string | string[] | undefined>) => {
    const nextQuery: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(location.query)) {
      if (typeof v === 'string' || Array.isArray(v)) nextQuery[k] = v;
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || (Array.isArray(value) && value.length === 0)) {
        delete nextQuery[key];
      } else {
        nextQuery[key] = value;
      }
    }
    navigate({pathname: location.pathname, query: nextQuery}, {replace: true});
  };

  const clearAllFilters = () => {
    updateQuery({
      strategy: undefined,
      status: undefined,
      source: undefined,
      period: undefined,
    });
  };

  const toggleSortDirection = () => {
    updateQuery({sort: sortDirection === 'desc' ? 'asc' : undefined});
  };

  const toggleExpanded = (rowId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
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
          <Container width={{md: '100%', lg: '70%'}}>
            <Container
              background="secondary"
              border="muted"
              radius="md"
              padding="sm md"
              marginBottom="md"
            >
              <Flex justify="between" align="center" gap="md" wrap="wrap">
                <Flex gap="md" align="center" wrap="wrap">
                  <Text variant="muted" aria-hidden>
                    <IconFilter size="sm" />
                  </Text>
                  <CompactSelect
                    multiple
                    value={strategyFilter}
                    options={STRATEGY_FILTER_OPTIONS}
                    onChange={selected =>
                      updateQuery({strategy: selected.map(o => String(o.value))})
                    }
                    trigger={triggerProps => (
                      <OverlayTrigger.Button
                        {...triggerProps}
                        size="sm"
                        prefix={t('Strategy')}
                      />
                    )}
                  />
                  <CompactSelect
                    multiple
                    value={statusFilter}
                    options={STATUS_FILTER_OPTIONS}
                    onChange={selected =>
                      updateQuery({status: selected.map(o => String(o.value))})
                    }
                    trigger={triggerProps => (
                      <OverlayTrigger.Button
                        {...triggerProps}
                        size="sm"
                        prefix={t('Status')}
                      />
                    )}
                  />
                  <CompactSelect
                    multiple
                    value={sourceFilter}
                    options={sourceOptions}
                    disabled={sourceOptions.length === 0}
                    onChange={selected =>
                      updateQuery({source: selected.map(o => String(o.value))})
                    }
                    trigger={triggerProps => (
                      <OverlayTrigger.Button
                        {...triggerProps}
                        size="sm"
                        prefix={t('Source')}
                      />
                    )}
                  />
                  <CompactSelect
                    value={period ?? ''}
                    options={PERIOD_FILTER_OPTIONS}
                    onChange={selected =>
                      updateQuery({
                        period:
                          selected.value === '' ? undefined : String(selected.value),
                      })
                    }
                    trigger={triggerProps => (
                      <OverlayTrigger.Button
                        {...triggerProps}
                        size="sm"
                        prefix={t('Date')}
                      />
                    )}
                  />
                </Flex>
                {hasActiveFilters ? (
                  <Button size="xs" priority="link" onClick={clearAllFilters}>
                    {t('Clear all')}
                  </Button>
                ) : null}
              </Flex>
            </Container>
            <RunsTable>
              <SimpleTable.Header>
                <SimpleTable.HeaderCell />
                <SimpleTable.HeaderCell
                  sort={sortDirection}
                  handleSortClick={toggleSortDirection}
                >
                  {t('Date')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('Strategy')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('Result')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell />
              </SimpleTable.Header>

              {sortedRows.length === 0 ? (
                <SimpleTable.Empty>
                  {rows.length === 0
                    ? t('No workflow runs yet.')
                    : t('No runs match your filters.')}
                </SimpleTable.Empty>
              ) : (
                sortedRows.map(row => {
                  const isExpanded = expanded.has(row.id);
                  const explorerRunId = getExplorerRunId(row);
                  return (
                    <Fragment key={row.id}>
                      <SimpleTable.Row
                        aria-expanded={isExpanded}
                        onClick={() => toggleExpanded(row.id)}
                        style={{cursor: 'pointer'}}
                      >
                        <SimpleTable.RowCell>
                          <StatusIcon status={row.status} />
                        </SimpleTable.RowCell>
                        <SimpleTable.RowCell>
                          <Flex direction="column" gap="2xs">
                            <Text size="sm">
                              <DateTime date={row.dateAdded} />
                            </Text>
                            <Text size="xs" variant="muted">
                              <TimeSince date={row.dateAdded} />
                            </Text>
                          </Flex>
                        </SimpleTable.RowCell>
                        <SimpleTable.RowCell>
                          <Flex gap="sm" align="center">
                            <SourceIcon source={row.source} />
                            <Text size="sm">{KIND_LABELS[row.kind]}</Text>
                          </Flex>
                        </SimpleTable.RowCell>
                        <SimpleTable.RowCell>
                          <ResultCell
                            row={row}
                            explorerRunId={explorerRunId}
                            organizationSlug={organization.slug}
                          />
                        </SimpleTable.RowCell>
                        <SimpleTable.RowCell>
                          <Button
                            aria-label={isExpanded ? t('Collapse run') : t('Expand run')}
                            size="xs"
                            variant="transparent"
                            icon={
                              <IconChevron direction={isExpanded ? 'down' : 'right'} />
                            }
                            onClick={e => {
                              e.stopPropagation();
                              toggleExpanded(row.id);
                            }}
                          />
                        </SimpleTable.RowCell>
                      </SimpleTable.Row>

                      {isExpanded && (
                        <SimpleTable.Row variant="faded">
                          <Container
                            background="secondary"
                            padding="lg xl"
                            column="1 / -1"
                          >
                            <RunDetail row={row} organizationSlug={organization.slug} />
                          </Container>
                        </SimpleTable.Row>
                      )}
                    </Fragment>
                  );
                })
              )}
            </RunsTable>
          </Container>
        )}
      </Flex>
    </SentryDocumentTitle>
  );
}

const KIND_LABELS: Record<WorkflowKind, string> = {
  agentic_triage: 'Agentic triage',
  feedback_summary: 'Feedback summary',
};

const SOURCE_LABELS: Record<string, string> = {
  cron: 'Automated',
  manual: 'Manual',
};

const SOURCE_ICONS: Record<string, React.ComponentType<{size?: 'xs' | 'sm' | 'md'}>> = {
  cron: IconBot,
  manual: IconUser,
};

function getSourceLabel(source: string | undefined): string {
  if (!source) return '-';
  return SOURCE_LABELS[source] ?? source;
}

function SourceIcon({source}: {source: string | undefined}) {
  if (!source) return null;
  const Icon = SOURCE_ICONS[source];
  if (!Icon) return null;
  const label = getSourceLabel(source);
  return (
    <Tooltip title={label} skipWrapper>
      <Text variant="muted" aria-label={label}>
        <Icon size="xs" />
      </Text>
    </Tooltip>
  );
}

const STRATEGY_FILTER_OPTIONS: ReadonlyArray<{label: string; value: WorkflowKind}> = [
  {value: 'agentic_triage', label: KIND_LABELS.agentic_triage},
  {value: 'feedback_summary', label: KIND_LABELS.feedback_summary},
];

const STATUS_FILTER_OPTIONS: ReadonlyArray<{label: string; value: RunStatus}> = [
  {value: 'succeeded', label: 'Succeeded'},
  {value: 'failed', label: 'Failed'},
  {value: 'skipped', label: 'Skipped'},
  {value: 'running', label: 'Running'},
];

const PERIOD_FILTER_OPTIONS: ReadonlyArray<{label: string; value: string}> = [
  {value: '', label: 'All time'},
  {value: '24h', label: 'Last 24 hours'},
  {value: '7d', label: 'Last 7 days'},
  {value: '14d', label: 'Last 14 days'},
  {value: '30d', label: 'Last 30 days'},
];

const PERIOD_TO_DAYS: Record<string, number> = {
  '24h': 1,
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

const STATUS_VARIANT: Record<
  RunStatus,
  {
    Icon: React.ComponentType<{size?: 'xs' | 'sm' | 'md'}>;
    label: string;
    text: 'success' | 'danger' | 'muted' | 'warning';
  }
> = {
  succeeded: {Icon: IconCheckmark, label: 'Succeeded', text: 'success'},
  failed: {Icon: IconClose, label: 'Failed', text: 'danger'},
  skipped: {Icon: IconWarning, label: 'Skipped', text: 'muted'},
  running: {Icon: IconRefresh, label: 'Running', text: 'warning'},
};

function StatusIcon({status}: {status: RunStatus}) {
  const {Icon, label, text} = STATUS_VARIANT[status];
  return (
    <Tooltip title={label} skipWrapper>
      <Text variant={text} aria-label={label}>
        <Icon size="sm" />
      </Text>
    </Tooltip>
  );
}

function ResultCell({
  row,
  explorerRunId,
  organizationSlug,
}: {
  explorerRunId: number | string | null;
  organizationSlug: string;
  row: WorkflowRow;
}) {
  const content = getResultContent(row);
  if (explorerRunId === null) {
    return content;
  }
  return (
    <Link
      to={{
        pathname: `/organizations/${organizationSlug}/issues/autofix/`,
        query: {explorerRunId},
      }}
      onClick={e => e.stopPropagation()}
    >
      <Flex gap="sm" align="center">
        <IconOpen size="xs" variant="accent" aria-hidden />
        {content}
      </Flex>
    </Link>
  );
}

function getResultContent(row: WorkflowRow) {
  if (row.status === 'failed') {
    return (
      <Text variant="danger" size="sm">
        {t('Run failed')}
      </Text>
    );
  }
  if (row.kind === 'agentic_triage') {
    const triage = row.triage;
    if (triage?.dryRun) {
      return <Text variant="muted">{t('dry run')}</Text>;
    }
    const issueCount = triage?.issues.length ?? 0;
    if (issueCount === 0) {
      return (
        <Text variant="muted" size="sm">
          {t('No issues processed')}
        </Text>
      );
    }
    return <Text size="sm">{tn('%s issue', '%s issues', issueCount)}</Text>;
  }
  const feedback = row.feedback;
  if (row.status === 'skipped') {
    return (
      <Text variant="muted" size="sm">
        {feedback?.reason === 'insufficient_feedbacks'
          ? t('Skipped — too few feedbacks')
          : t('Skipped')}
      </Text>
    );
  }
  const themeCount = feedback?.themes.length ?? 0;
  const feedbackCount = feedback?.numFeedbacksAnalyzed ?? 0;
  return (
    <Text size="sm">
      {tn('%s theme', '%s themes', themeCount)}
      {' · '}
      {tn('%s feedback', '%s feedbacks', feedbackCount)}
    </Text>
  );
}

function RunDetail({
  row,
  organizationSlug,
}: {
  organizationSlug: string;
  row: WorkflowRow;
}) {
  const {
    reasoning_effort,
    intelligence_level,
    extra_triage_instructions,
    max_candidates,
  } = row.options ?? {};
  const hasSettings =
    reasoning_effort !== undefined ||
    intelligence_level !== undefined ||
    extra_triage_instructions !== undefined ||
    max_candidates !== undefined;

  return (
    <Flex direction="column" gap="lg">
      {row.errorMessage ? (
        <Text variant="danger" size="sm">
          {t('Error: ')}
          {row.errorMessage}
        </Text>
      ) : null}

      {hasSettings ? (
        <Grid columns="max-content 1fr" gap="sm xl" align="start">
          {max_candidates === undefined ? null : (
            <Fragment>
              <Text bold size="xs" variant="muted">
                {t('Max candidates')}
              </Text>
              <Text size="sm">{max_candidates}</Text>
            </Fragment>
          )}
          {reasoning_effort === undefined ? null : (
            <Fragment>
              <Text bold size="xs" variant="muted">
                {t('Reasoning effort')}
              </Text>
              <Text size="sm">{reasoning_effort}</Text>
            </Fragment>
          )}
          {intelligence_level === undefined ? null : (
            <Fragment>
              <Text bold size="xs" variant="muted">
                {t('Intelligence level')}
              </Text>
              <Text size="sm">{intelligence_level}</Text>
            </Fragment>
          )}
          {extra_triage_instructions === undefined ? null : (
            <Fragment>
              <Text bold size="xs" variant="muted">
                {t('Extra triage instructions')}
              </Text>
              <Text size="sm">{extra_triage_instructions}</Text>
            </Fragment>
          )}
        </Grid>
      ) : null}

      {row.kind === 'agentic_triage' ? (
        <TriageIssuesPanel row={row} organizationSlug={organizationSlug} />
      ) : (
        <FeedbackSummaryPanel row={row} organizationSlug={organizationSlug} />
      )}
    </Flex>
  );
}

function TriageIssuesPanel({
  row,
  organizationSlug,
}: {
  organizationSlug: string;
  row: WorkflowRow;
}) {
  const issues = row.triage?.issues ?? [];
  return (
    <Flex direction="column" gap="sm">
      <Text bold size="xs" variant="muted" uppercase>
        {t('Issues (%s)', issues.length)}
      </Text>

      {issues.length === 0 ? (
        <Text variant="muted" size="sm">
          {t('No issues processed in this run.')}
        </Text>
      ) : (
        <Grid
          columns="max-content max-content max-content max-content max-content"
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
          <span />
          {issues.flatMap(issue => [
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
                  pathname: `/organizations/${organizationSlug}/issues/autofix/`,
                  query: {explorerRunId: issue.seerRunId},
                }}
              >
                {t('Explorer')}
              </LinkButton>
            ),
            <LinkButton
              key={`${issue.id}-autofix`}
              size="xs"
              icon={<IconOpen />}
              to={{
                pathname: `/organizations/${organizationSlug}/issues/${issue.groupId}/`,
                query: {seerDrawer: true},
              }}
            >
              {t('Autofix')}
            </LinkButton>,
          ])}
        </Grid>
      )}
    </Flex>
  );
}

function FeedbackSummaryPanel({
  row,
  organizationSlug,
}: {
  organizationSlug: string;
  row: WorkflowRow;
}) {
  const feedback = row.feedback;

  if (row.status === 'skipped') {
    return (
      <Container background="primary" border="muted" radius="md" padding="md">
        <Text variant="muted" size="sm">
          {feedback?.reason === 'insufficient_feedbacks'
            ? t(
                'Skipped — fewer than 10 user feedbacks were received in the last 24 hours (saw %s).',
                feedback.numFeedbacksAnalyzed
              )
            : t('Skipped.')}
        </Text>
      </Container>
    );
  }

  if (row.status === 'failed' || !feedback) {
    // Error banner is already shown at the top of RunDetail; nothing else to show.
    return null;
  }

  return (
    <Flex direction="column" gap="md">
      <Text as="p" size="md">
        {feedback.summary}
      </Text>

      <Flex direction="column" gap="sm">
        <Text bold size="xs" variant="muted" uppercase>
          {t('Themes (%s)', feedback.themes.length)}
        </Text>
        <Grid columns={{xs: '1fr', md: 'repeat(2, 1fr)'}} gap="md">
          {feedback.themes.map((theme, idx) => (
            <Container
              key={idx}
              background="primary"
              border="muted"
              radius="md"
              padding="sm md"
            >
              <Flex direction="column" gap="xs">
                <Heading as="h4" size="sm">
                  {theme.title}
                </Heading>
                <Text variant="muted" size="sm">
                  {theme.description}
                </Text>
                {theme.feedbackGroupIds.length > 0 ? (
                  <Flex gap="xs" align="center" wrap="wrap">
                    <Text size="xs" variant="muted">
                      {t('Feedback:')}
                    </Text>
                    {theme.feedbackGroupIds.map(groupId => (
                      <Container
                        key={groupId}
                        display="inline-block"
                        border="muted"
                        radius="sm"
                        padding="2xs xs"
                      >
                        <Link
                          to={`/organizations/${organizationSlug}/issues/${groupId}/`}
                        >
                          <Text size="xs">{groupId}</Text>
                        </Link>
                      </Container>
                    ))}
                  </Flex>
                ) : null}
              </Flex>
            </Container>
          ))}
        </Grid>
      </Flex>

      <Text size="xs" variant="muted">
        {t('Analyzed %s feedback entries.', feedback.numFeedbacksAnalyzed)}
      </Text>
    </Flex>
  );
}

const RunsTable = styled(SimpleTable)`
  grid-template-columns: min-content max-content 1fr 2fr min-content;
`;

function toWorkflowRow(run: SeerNightShiftRun): WorkflowRow {
  const status: RunStatus = run.errorMessage ? 'failed' : 'succeeded';
  const agentRunId = run.extras.agent_run_id;
  return {
    id: `${run.id}:agentic_triage`,
    runId: run.id,
    dateAdded: run.dateAdded,
    kind: 'agentic_triage',
    status,
    source: run.extras.options?.source,
    errorMessage: run.errorMessage,
    options: run.extras.options,
    triage: {
      maxCandidates: run.extras.options?.max_candidates,
      dryRun: run.extras.options?.dry_run,
      issues: run.issues,
      agentRunId:
        typeof agentRunId === 'number' || typeof agentRunId === 'string'
          ? agentRunId
          : undefined,
    },
  };
}

function getExplorerRunId(row: WorkflowRow): number | string | null {
  const agentRunId =
    row.kind === 'agentic_triage' ? row.triage?.agentRunId : row.feedback?.agentRunId;
  if (typeof agentRunId === 'number' || typeof agentRunId === 'string') {
    return agentRunId;
  }
  return null;
}

export default SeerWorkflows;
