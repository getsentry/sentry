import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {getPullRequestStatusLabel} from 'sentry/components/group/externalIssuesList/pullRequestStatusBadge';
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
  IconMerge,
  IconOpen,
  IconPullRequest,
  IconPullRequestClosed,
  IconRefresh,
  IconUser,
  IconWarning,
} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {PullRequestStatus} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import type {TagVariant} from 'sentry/utils/theme';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {getRelativeExplorerUrl} from 'sentry/views/seerExplorer/utils';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getActionLabel,
  STRATEGY_META,
} from 'sentry/views/seerWorkflows/strategies';
import type {
  RunStatus,
  SeerNightShiftRun,
  SeerNightShiftRunIssue,
  SeerNightShiftRunPullRequest,
  WorkflowKind,
  WorkflowRow,
} from 'sentry/views/seerWorkflows/types';

function SeerWorkflows() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const isSentryEmployee = useIsSentryEmployee();
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

  const rows = useMemo<WorkflowRow[]>(() => {
    const apiRows = (data ?? []).map(toWorkflowRow);
    return isSentryEmployee
      ? apiRows
      : apiRows.filter(row => STRATEGY_META[row.kind]?.visibility !== 'internal');
  }, [data, isSentryEmployee]);

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
      if (row.source) {
        sources.add(row.source);
      }
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

  const strategySections = useMemo(() => {
    const present = new Set<WorkflowKind>();
    for (const row of rows) {
      present.add(row.kind);
    }
    return CATEGORY_ORDER.map(category => ({
      key: category,
      label: CATEGORY_LABELS[category],
      options: Array.from(present)
        .filter(kind => STRATEGY_META[kind]?.category === category)
        .map(kind => ({value: kind, label: STRATEGY_META[kind].label})),
    })).filter(section => section.options.length > 0);
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (strategyFilter.length && !strategyFilter.includes(row.kind)) {
        return false;
      }
      if (statusFilter.length && !statusFilter.includes(row.status)) {
        return false;
      }
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
      if (typeof v === 'string' || Array.isArray(v)) {
        nextQuery[k] = v;
      }
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

  const expandLatest = decodeScalar(location.query.expandLatest) as
    | WorkflowKind
    | undefined;
  const autoExpandedForRef = useRef<WorkflowKind | null>(null);
  useEffect(() => {
    if (
      !expandLatest ||
      autoExpandedForRef.current === expandLatest ||
      filteredRows.length === 0
    ) {
      return;
    }
    // Only auto-expand a run that's actually visible under the current filters,
    // otherwise we'd set expansion state on a row hidden by status/period/etc.
    const candidates = filteredRows.filter(row => row.kind === expandLatest);
    if (candidates.length === 0) {
      return;
    }
    const latest = candidates.reduce((acc, row) =>
      Date.parse(row.dateAdded) > Date.parse(acc.dateAdded) ? row : acc
    );
    setExpanded(prev => {
      const next = new Set(prev);
      next.add(latest.id);
      return next;
    });
    autoExpandedForRef.current = expandLatest;
  }, [expandLatest, filteredRows]);

  return (
    <SentryDocumentTitle title={t('Sentry Workflows')} orgSlug={organization.slug}>
      <Stack gap="lg" padding="xl">
        <Stack gap="2xs">
          <TopBar.Slot name="title">{t('Sentry Workflows')}</TopBar.Slot>
          <Text as="p" variant="muted">
            {t('Historical runs of Sentry workflows for this organization.')}
          </Text>
        </Stack>

        {isError ? (
          <LoadingError onRetry={refetch} />
        ) : isPending ? (
          <LoadingIndicator />
        ) : (
          <Container width={{'screen:md': '100%', 'screen:lg': '70%'}}>
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
                    options={strategySections}
                    disabled={strategySections.length === 0}
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
                  <Button size="xs" variant="link" onClick={clearAllFilters}>
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
                          <Stack gap="2xs">
                            <Text size="sm">
                              <DateTime date={row.dateAdded} />
                            </Text>
                            <Text size="xs" variant="muted">
                              <TimeSince date={row.dateAdded} />
                            </Text>
                          </Stack>
                        </SimpleTable.RowCell>
                        <SimpleTable.RowCell>
                          <Flex gap="sm" align="center" wrap="wrap">
                            <SourceIcon source={row.source} />
                            <Text size="sm">{STRATEGY_META[row.kind].label}</Text>
                            {STRATEGY_META[row.kind]?.visibility === 'internal' ? (
                              <Container
                                display="inline-block"
                                border="muted"
                                radius="sm"
                                padding="2xs xs"
                              >
                                <Text size="xs" variant="muted" uppercase>
                                  {t('Internal')}
                                </Text>
                              </Container>
                            ) : null}
                          </Flex>
                        </SimpleTable.RowCell>
                        <SimpleTable.RowCell>{getResultContent(row)}</SimpleTable.RowCell>
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
      </Stack>
    </SentryDocumentTitle>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  cron: 'Automated',
  manual: 'Manual',
};

const SOURCE_ICONS: Record<
  string,
  React.ComponentType<{size?: 'xs' | 'sm' | 'md'; variant?: 'muted'}>
> = {
  cron: IconBot,
  manual: IconUser,
};

function getSourceLabel(source: string | undefined): string {
  if (!source) {
    return '-';
  }
  return SOURCE_LABELS[source] ?? source;
}

function SourceIcon({source}: {source: string | undefined}) {
  if (!source) {
    return null;
  }
  const Icon = SOURCE_ICONS[source];
  if (!Icon) {
    return null;
  }
  const label = getSourceLabel(source);
  return (
    <Tooltip title={label} skipWrapper>
      <Flex as="span" align="center" aria-label={label}>
        <Icon size="xs" variant="muted" />
      </Flex>
    </Tooltip>
  );
}

// toWorkflowRow only ever derives 'succeeded' or 'failed' from a run, so only
// offer those as filter choices — 'skipped'/'running' would never match.
const STATUS_FILTER_OPTIONS: Array<{label: string; value: RunStatus}> = [
  {value: 'succeeded', label: 'Succeeded'},
  {value: 'failed', label: 'Failed'},
];

const PERIOD_FILTER_OPTIONS: Array<{label: string; value: string}> = [
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

function getResultContent(row: WorkflowRow) {
  if (row.status === 'failed') {
    return (
      <Text variant="danger" size="sm">
        {t('Run failed')}
      </Text>
    );
  }
  // Caller-supplied result text wins, for strategies that don't have
  // specialized count rendering yet (everything except triage).
  if (row.resultText) {
    return <Text size="sm">{row.resultText}</Text>;
  }
  const triage = row.triage;
  if (triage?.dryRun) {
    return (
      <Text variant="muted" size="sm">
        {t('dry run')}
      </Text>
    );
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

function RunDetail({
  row,
  organizationSlug,
}: {
  organizationSlug: string;
  row: WorkflowRow;
}) {
  const isSentryEmployee = useIsSentryEmployee();
  return (
    <Stack gap="lg">
      <UserSection row={row} organizationSlug={organizationSlug} />
      {isSentryEmployee ? (
        <Disclosure>
          <Disclosure.Title>
            <Flex gap="sm" align="center">
              <Text bold>{t('Debug')}</Text>
              <Container
                display="inline-block"
                border="warning"
                radius="sm"
                padding="2xs xs"
              >
                <Text size="xs" variant="warning" uppercase bold>
                  {t('Employee only')}
                </Text>
              </Container>
            </Flex>
          </Disclosure.Title>
          <Disclosure.Content>
            <DebugSection row={row} organizationSlug={organizationSlug} />
          </Disclosure.Content>
        </Disclosure>
      ) : null}
    </Stack>
  );
}

function UserSection({
  row,
  organizationSlug,
}: {
  organizationSlug: string;
  row: WorkflowRow;
}) {
  return (
    <Stack gap="lg">
      {row.summary ? (
        <Text as="p" size="md">
          {row.summary}
        </Text>
      ) : null}
      <TriageDispatchesPanel row={row} />
      <IssueList issues={row.triage?.issues ?? []} organizationSlug={organizationSlug} />
    </Stack>
  );
}

function TriageDispatchesPanel({row}: {row: WorkflowRow}) {
  const explorerRunIds = getExplorerRunIds(row);
  return (
    <Stack gap="sm">
      <Text bold size="xs" variant="muted" uppercase>
        {t('Triage batches (%s)', explorerRunIds.length)}
      </Text>
      {explorerRunIds.length === 0 ? (
        <Text variant="muted" size="sm">
          {t('No triage batches recorded for this run.')}
        </Text>
      ) : (
        <Flex gap="sm" wrap="wrap">
          {explorerRunIds.map((runId, index) => (
            <LinkButton
              key={`${runId}-${index}`}
              size="xs"
              icon={<IconOpen />}
              to={getRelativeExplorerUrl(runId)}
            >
              {t('Batch %s', index + 1)}
            </LinkButton>
          ))}
        </Flex>
      )}
    </Stack>
  );
}

function DebugSection({
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
    <Stack gap="md">
      <Grid columns="max-content 1fr" gap="sm xl" align="start">
        <Text bold size="xs" variant="muted">
          {t('Run ID')}
        </Text>
        <Text size="sm" monospace>
          {row.runId}
        </Text>
        {hasSettings ? (
          <Fragment>
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
          </Fragment>
        ) : null}
      </Grid>
      {row.errorMessage ? (
        <Text variant="danger" size="sm" monospace>
          {t('Error: ')}
          {row.errorMessage}
        </Text>
      ) : null}
      <TriageIssuesDebugAddendum row={row} organizationSlug={organizationSlug} />
    </Stack>
  );
}

function IssueList({
  issues,
  organizationSlug,
}: {
  issues: SeerNightShiftRunIssue[];
  organizationSlug: string;
}) {
  return (
    <Stack gap="sm">
      <Text bold size="xs" variant="muted" uppercase>
        {t('Issues (%s)', issues.length)}
      </Text>

      {issues.length === 0 ? (
        <Text variant="muted" size="sm">
          {t('No issues processed in this run.')}
        </Text>
      ) : (
        <Stack gap="xs">
          {issues.map(issue => (
            <IssueRow key={issue.id} issue={issue} organizationSlug={organizationSlug} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function IssueRow({
  issue,
  organizationSlug,
}: {
  issue: SeerNightShiftRunIssue;
  organizationSlug: string;
}) {
  const title = issue.groupTitle ?? issue.groupId;
  return (
    <Container background="primary" border="muted" radius="md" padding="sm md">
      <Stack gap="xs">
        <Flex justify="between" align="center" gap="md">
          <Container flex="1" minWidth="0">
            <Link to={`/organizations/${organizationSlug}/issues/${issue.groupId}/`}>
              <Text size="sm" ellipsis>
                {issue.groupShortId ? (
                  <Text bold as="span">
                    {issue.groupShortId}{' '}
                  </Text>
                ) : null}
                {title}
              </Text>
            </Link>
          </Container>
          <Stack gap="xs" align="end" flexShrink={0}>
            {(issue.pullRequests ?? []).length > 0 ? (
              (issue.pullRequests ?? []).map(pullRequest => (
                <IssuePullRequestChip
                  key={`${pullRequest.repository.id}:${pullRequest.id}`}
                  pullRequest={pullRequest}
                />
              ))
            ) : (
              <IssueStatusTag issue={issue} />
            )}
          </Stack>
        </Flex>
        {issue.reason ? (
          <Text size="sm" variant="muted">
            {issue.reason}
          </Text>
        ) : null}
      </Stack>
    </Container>
  );
}

const ACTION_TAG_VARIANT: Record<string, TagVariant> = {
  autofix: 'info',
  autofix_triggered: 'info',
  root_cause_only: 'muted',
  skip: 'muted',
};

function IssueStatusTag({issue}: {issue: SeerNightShiftRunIssue}) {
  const actionLabel = getActionLabel(issue.action);
  const label =
    issue.action === 'skip' && issue.skipReason
      ? `${actionLabel}: ${issue.skipReason.replaceAll('_', ' ')}`
      : actionLabel;
  const variant = ACTION_TAG_VARIANT[issue.action] ?? 'muted';
  if (!issue.seerRunId) {
    return <Tag variant={variant}>{label}</Tag>;
  }
  // The icon marks this tag as clickable, since most aren't.
  return (
    <Link to={getRelativeExplorerUrl(issue.seerRunId)}>
      <Tag variant={variant} icon={<IconOpen />}>
        {label}
      </Tag>
    </Link>
  );
}

// Matches the icon choices in pullRequestStatusBadge.tsx -- draft, open, and
// unknown fall back to the default IconPullRequest there too.
const PR_STATUS_ICON: Partial<Record<PullRequestStatus, typeof IconPullRequest>> = {
  merged: IconMerge,
  closed: IconPullRequestClosed,
};

// Only call out the status when it deviates from an ordinary open PR.
const PR_STATUS_PREFIXED = new Set<PullRequestStatus>(['merged', 'closed', 'draft']);

function IssuePullRequestChip({
  pullRequest,
}: {
  pullRequest: SeerNightShiftRunPullRequest;
}) {
  const status = pullRequest.status ?? 'unknown';
  const Icon = PR_STATUS_ICON[status] ?? IconPullRequest;
  // The chip stays compact -- just the PR number (and its status when notable);
  // the full title would blow out the row, so it lives on hover instead.
  const number = `#${pullRequest.id}`;
  const label = PR_STATUS_PREFIXED.has(status)
    ? `${getPullRequestStatusLabel(status)} ${number}`
    : number;
  const tooltipTitle = pullRequest.title ?? t('Pull request #%s', pullRequest.id);
  const chip = pullRequest.externalUrl ? (
    <LinkButton size="xs" icon={<Icon />} href={pullRequest.externalUrl} external>
      {label}
    </LinkButton>
  ) : (
    <Tag variant="muted" icon={<Icon />}>
      {label}
    </Tag>
  );
  return (
    <Tooltip title={tooltipTitle} skipWrapper>
      {chip}
    </Tooltip>
  );
}

function TriageIssuesDebugAddendum({
  row,
  organizationSlug,
}: {
  organizationSlug: string;
  row: WorkflowRow;
}) {
  const issues = row.triage?.issues ?? [];
  if (issues.length === 0) {
    return null;
  }
  return (
    <Stack gap="sm">
      <Text bold size="xs" variant="muted" uppercase>
        {t('Per-issue internals')}
      </Text>
      <Grid
        columns="max-content max-content max-content max-content max-content"
        gap="sm xl"
        align="center"
      >
        <Text bold size="xs" variant="muted">
          {t('Group')}
        </Text>
        <Text bold size="xs" variant="muted">
          {t('Raw action')}
        </Text>
        <Text bold size="xs" variant="muted">
          {t('Skip reason')}
        </Text>
        <Text bold size="xs" variant="muted">
          {t('Seer Run ID')}
        </Text>
        <span />
        {issues.flatMap(issue => [
          <Text key={`${issue.id}-group`} size="sm" monospace>
            {issue.groupId}
          </Text>,
          <Text key={`${issue.id}-action`} size="sm" monospace>
            {issue.action}
          </Text>,
          <Text key={`${issue.id}-skip-reason`} size="sm" variant="muted" monospace>
            {issue.skipReason ?? '-'}
          </Text>,
          <Text key={`${issue.id}-seer`} size="sm" variant="muted" monospace>
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
        ])}
      </Grid>
    </Stack>
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
      seerRuns: run.seerRuns ?? [],
      agentRunId:
        typeof agentRunId === 'number' || typeof agentRunId === 'string'
          ? agentRunId
          : undefined,
    },
  };
}

function getExplorerRunIds(row: WorkflowRow): Array<number | string> {
  const seerRunIds = (row.triage?.seerRuns ?? [])
    .map(seerRun => seerRun.seerRunId)
    .filter((id): id is string => id !== null);
  if (seerRunIds.length > 0) {
    return seerRunIds;
  }
  // Fallback for pre-shard runs, which recorded a single id on the run extras.
  const agentRunId = row.triage?.agentRunId;
  if (typeof agentRunId === 'number' || typeof agentRunId === 'string') {
    return [agentRunId];
  }
  return [];
}

export default SeerWorkflows;
