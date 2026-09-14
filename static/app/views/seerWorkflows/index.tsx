import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Spinner} from '@sentry/scraps/chat';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {DateTime} from 'sentry/components/dateTime';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
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
  IconUser,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {getRelativeExplorerUrl} from 'sentry/views/seerExplorer/utils';
import {toWorkflowRow} from 'sentry/views/seerWorkflows/runs';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getWorkflowRunActions,
  STRATEGY_META,
} from 'sentry/views/seerWorkflows/strategies';
import type {
  SeerWorkflowRun,
  WorkflowRow,
  WorkflowRowStatus,
  WorkflowRunCreateRequest,
  WorkflowStrategy,
} from 'sentry/views/seerWorkflows/types';

const RUNS_COLUMNS: TableColumnConfig[] = [
  {key: 'select', width: 'min-content'},
  {key: 'date', width: 'max-content'},
  {key: 'strategy', width: '1fr'},
  {key: 'result', width: '2fr'},
  {key: 'actions', width: 'min-content'},
];

function SeerWorkflows() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const isSentryEmployee = useIsSentryEmployee();
  const runActions = getWorkflowRunActions(organization.features);
  const [expanded, setExpanded] = useState(new Set<string>());
  const {mutate: startWorkflowRun, isPending: isStartingWorkflowRun} = useMutation({
    mutationFn: (data: WorkflowRunCreateRequest) =>
      fetchMutation<{runId: string}>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/seer/workflows/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        data,
      }),
    onSuccess: async (result, {strategy}) => {
      clearAllFilters();
      setExpanded(previous => new Set(previous).add(`${result.runId}:${strategy}`));
      await refetch();
    },
    onError: error => {
      addErrorMessage(
        error instanceof RequestError && typeof error.responseJSON?.detail === 'string'
          ? error.responseJSON.detail
          : t('Could not start the workflow. Try again.')
      );
    },
  });

  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<SeerWorkflowRun[]>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/',
      {
        path: {organizationIdOrSlug: organization.slug},
        staleTime: 0,
      }
    ),
    refetchInterval: query =>
      query.state.data?.json.some(run => run.extras.status === 'running') ? 5000 : false,
  });

  const rows = useMemo<WorkflowRow[]>(() => {
    const apiRows = (data ?? []).map(toWorkflowRow);
    return isSentryEmployee
      ? apiRows
      : apiRows.filter(row => STRATEGY_META[row.strategy]?.visibility !== 'internal');
  }, [data, isSentryEmployee]);

  const strategyFilter = decodeList(location.query.strategy) as WorkflowStrategy[];
  const statusFilter = decodeList(location.query.status) as WorkflowRowStatus[];
  const sourceFilter = decodeList(location.query.source);
  const period = decodeScalar(location.query.period);

  const [now] = useState(() => Date.now());
  const periodCutoffMs = useMemo(() => {
    const days = PERIOD_TO_DAYS[period ?? ''];
    return days === undefined ? null : now - days * 24 * 60 * 60 * 1000;
  }, [period, now]);

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
    const present = new Set<WorkflowStrategy>();
    for (const row of rows) {
      present.add(row.strategy);
    }
    return CATEGORY_ORDER.map(category => ({
      key: category,
      label: CATEGORY_LABELS[category],
      options: Array.from(present)
        .filter(strategy => STRATEGY_META[strategy]?.category === category)
        .map(strategy => ({
          value: strategy,
          label: STRATEGY_META[strategy].label,
        })),
    })).filter(section => section.options.length > 0);
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (strategyFilter.length && !strategyFilter.includes(row.strategy)) {
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
    const next = filteredRows.toSorted(cmp);
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
    | WorkflowStrategy
    | undefined;
  const autoExpandedForRef = useRef<WorkflowStrategy | null>(null);
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
    const candidates = filteredRows.filter(row => row.strategy === expandLatest);
    if (candidates.length === 0) {
      return;
    }
    const latest = candidates.reduce((acc, row) =>
      Date.parse(row.dateAdded) > Date.parse(acc.dateAdded) ? row : acc
    );
    // oxlint-disable-next-line react/set-state-in-effect
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
          <Flex justify="between" align="center" gap="md" wrap="wrap">
            <Text as="p" variant="muted">
              {t('Historical runs of Sentry workflows for this organization.')}
            </Text>
            {runActions.length > 0 && (
              <DropdownMenu
                size="sm"
                triggerLabel={t('Run…')}
                triggerProps={{busy: isStartingWorkflowRun}}
                isDisabled={isStartingWorkflowRun}
                items={runActions.map(({strategy, label}) => ({
                  key: strategy,
                  label,
                  onAction: () => startWorkflowRun({strategy}),
                }))}
              />
            )}
          </Flex>
        </Stack>

        {isError && data === undefined ? (
          <LoadingError onRetry={refetch} />
        ) : isPending ? (
          <LoadingIndicator />
        ) : (
          <Fragment>
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
                      updateQuery({
                        strategy: selected.map(o => String(o.value)),
                      })
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
                      updateQuery({
                        status: selected.map(o => String(o.value)),
                      })
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
                      updateQuery({
                        source: selected.map(o => String(o.value)),
                      })
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
            <SimpleTable
              columns={RUNS_COLUMNS}
              header={
                <SimpleTable.HeaderRow>
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
                </SimpleTable.HeaderRow>
              }
            >
              {sortedRows.length === 0 ? (
                <SimpleTable.Empty>
                  {rows.length === 0
                    ? t('No workflow runs yet.')
                    : t('No runs match your filters.')}
                </SimpleTable.Empty>
              ) : (
                sortedRows.map(row => {
                  const isExpanded = expanded.has(row.id);
                  const {Summary} = STRATEGY_META[row.strategy];
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
                            <Text size="sm">{STRATEGY_META[row.strategy].label}</Text>
                            {STRATEGY_META[row.strategy]?.visibility === 'internal' ? (
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
                        <SimpleTable.RowCell>
                          <Summary row={row} />
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
                          <SimpleTable.RowCell
                            align="stretch"
                            background="secondary"
                            column="1 / -1"
                            direction="column"
                          >
                            <RunDetail row={row} organizationSlug={organization.slug} />
                          </SimpleTable.RowCell>
                        </SimpleTable.Row>
                      )}
                    </Fragment>
                  );
                })
              )}
            </SimpleTable>
          </Fragment>
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

const STATUS_FILTER_OPTIONS: Array<{
  label: string;
  value: WorkflowRowStatus;
}> = [
  {value: 'succeeded', label: 'Succeeded'},
  {value: 'failed', label: 'Failed'},
  {value: 'skipped', label: 'Skipped'},
  {value: 'running', label: 'Running'},
  {value: 'partial', label: 'Incomplete'},
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

const STATUS_VARIANT = {
  succeeded: {Icon: IconCheckmark, label: 'Succeeded', text: 'success'},
  failed: {Icon: IconClose, label: 'Failed', text: 'danger'},
  skipped: {Icon: IconWarning, label: 'Skipped', text: 'muted'},
  partial: {Icon: IconWarning, label: 'Incomplete', text: 'warning'},
} as const satisfies Record<
  Exclude<WorkflowRowStatus, 'running'>,
  {
    Icon: React.ComponentType<{size?: 'xs' | 'sm' | 'md'}>;
    label: string;
    text: 'success' | 'danger' | 'muted' | 'warning';
  }
>;

function StatusIcon({status}: {status: WorkflowRowStatus}) {
  if (status === 'running') {
    return (
      <Tooltip title={t('Running')} skipWrapper>
        <Spinner role="status" aria-label={t('Running')} />
      </Tooltip>
    );
  }

  const {Icon, label, text} = STATUS_VARIANT[status];
  return (
    <Tooltip title={label} skipWrapper>
      <Icon aria-label={label} variant={text} size="sm" />
    </Tooltip>
  );
}

function RunDetail({
  row,
  organizationSlug,
}: {
  organizationSlug: string;
  row: WorkflowRow;
}) {
  const isSentryEmployee = useIsSentryEmployee();
  const {Results, Debug} = STRATEGY_META[row.strategy];
  return (
    <Stack gap="lg">
      <Results row={row} organizationSlug={organizationSlug} />
      {row.seerRunId || (isSentryEmployee && Debug) ? (
        <Disclosure>
          <Disclosure.Title>
            <Flex gap="sm" align="center">
              <Text bold>{t('Debug')}</Text>
              {!row.seerRunId && isSentryEmployee && (
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
              )}
            </Flex>
          </Disclosure.Title>
          <Disclosure.Content>
            <Stack gap="sm">
              {row.seerRunId && (
                <Fragment>
                  <Text size="xs" variant="muted">
                    {t('Run %s', row.runId)}
                  </Text>
                  <Link to={getRelativeExplorerUrl(row.seerRunId)}>
                    {t('View prompt and agent run %s', row.seerRunId)}
                  </Link>
                </Fragment>
              )}
              {isSentryEmployee && Debug && <Debug row={row} />}
            </Stack>
          </Disclosure.Content>
        </Disclosure>
      ) : null}
    </Stack>
  );
}

export default SeerWorkflows;
