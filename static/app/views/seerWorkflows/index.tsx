import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Spinner} from '@sentry/scraps/chat';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Disclosure} from '@sentry/scraps/disclosure';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
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
  IconUser,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {apiFetch} from 'sentry/utils/api/apiFetch';
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
import {AgenticTriageDebug} from 'sentry/views/seerWorkflows/agenticTriage';
import {
  getWorkflowRunActions,
  getWorkflowStatus,
  getWorkflowSummary,
  WorkflowResults,
  STRATEGY_META,
} from 'sentry/views/seerWorkflows/strategies';
import type {
  SeerWorkflowRun,
  WorkflowDisplayStatus,
  WorkflowRunCreateRequest,
  WorkflowRunSource,
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
    onSuccess: async result => {
      clearAllFilters();
      setExpanded(previous => new Set(previous).add(result.runId));
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

  const reportedStrategies = useRef(new Set<string>());
  const {data, isPending, isError, refetch} = useQuery({
    ...apiOptions.as<SeerWorkflowRun[]>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/',
      {
        path: {organizationIdOrSlug: organization.slug},
        staleTime: 0,
      }
    ),
    queryFn: async context => {
      const response = await apiFetch<SeerWorkflowRun[]>(context);
      for (const {strategy} of response.json) {
        if (isSupportedStrategy(strategy) || reportedStrategies.current.has(strategy)) {
          continue;
        }
        reportedStrategies.current.add(strategy);
        Sentry.captureMessage('Unsupported Seer workflow strategy', {
          level: 'warning',
          extra: {strategy},
        });
      }
      return response;
    },
    refetchInterval: query =>
      query.state.data?.json.some(
        run => isSupportedStrategy(run.strategy) && run.extras.status === 'running'
      )
        ? 5000
        : false,
  });

  const runs = useMemo(
    () => data?.filter(run => isSupportedStrategy(run.strategy)) ?? [],
    [data]
  );

  const strategyFilter = decodeList(location.query.strategy) as WorkflowStrategy[];
  const statusFilter = decodeList(location.query.status) as WorkflowDisplayStatus[];
  const sourceFilter = decodeList(location.query.source);
  const period = decodeScalar(location.query.period);

  const [now] = useState(() => Date.now());
  const periodCutoffMs = useMemo(() => {
    const days = PERIOD_TO_DAYS[period ?? ''];
    return days === undefined ? null : now - days * 24 * 60 * 60 * 1000;
  }, [period, now]);

  const sourceOptions = useMemo(() => {
    const sources = new Set<WorkflowRunSource>();
    for (const run of runs) {
      if (run.source) {
        sources.add(run.source);
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
  }, [runs]);

  const strategyOptions = useMemo(
    () =>
      Array.from(new Set(runs.map(run => run.strategy))).map(strategy => ({
        value: strategy,
        label: STRATEGY_META[strategy].label,
      })),
    [runs]
  );

  const filteredRuns = useMemo(() => {
    return runs.filter(run => {
      if (strategyFilter.length && !strategyFilter.includes(run.strategy)) {
        return false;
      }
      if (statusFilter.length && !statusFilter.includes(getWorkflowStatus(run))) {
        return false;
      }
      if (sourceFilter.length && (!run.source || !sourceFilter.includes(run.source))) {
        return false;
      }
      if (periodCutoffMs !== null && Date.parse(run.dateAdded) < periodCutoffMs) {
        return false;
      }
      return true;
    });
  }, [runs, strategyFilter, statusFilter, sourceFilter, periodCutoffMs]);

  const sortDirection = decodeScalar(location.query.sort) === 'asc' ? 'asc' : 'desc';

  const sortedRuns = useMemo(() => {
    const cmp = (a: SeerWorkflowRun, b: SeerWorkflowRun) =>
      Date.parse(a.dateAdded) - Date.parse(b.dateAdded);
    const next = filteredRuns.toSorted(cmp);
    return sortDirection === 'desc' ? next.reverse() : next;
  }, [filteredRuns, sortDirection]);

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

  const expandLatest = decodeScalar(location.query.expandLatest) as
    | WorkflowStrategy
    | undefined;
  const autoExpandedForRef = useRef<WorkflowStrategy | null>(null);
  useEffect(() => {
    if (
      !expandLatest ||
      autoExpandedForRef.current === expandLatest ||
      filteredRuns.length === 0
    ) {
      return;
    }
    // Only auto-expand a run that's actually visible under the current filters,
    // otherwise we'd set expansion state on a run hidden by status/period/etc.
    const candidates = filteredRuns.filter(run => run.strategy === expandLatest);
    if (candidates.length === 0) {
      return;
    }
    const latest = candidates.reduce((acc, run) =>
      Date.parse(run.dateAdded) > Date.parse(acc.dateAdded) ? run : acc
    );
    // oxlint-disable-next-line react/set-state-in-effect
    setExpanded(prev => {
      const next = new Set(prev);
      next.add(latest.id);
      return next;
    });
    autoExpandedForRef.current = expandLatest;
  }, [expandLatest, filteredRuns]);

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
                trigger={triggerProps => (
                  <OverlayTrigger.Button {...triggerProps} busy={isStartingWorkflowRun}>
                    {t('Run…')}
                  </OverlayTrigger.Button>
                )}
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
                    options={strategyOptions}
                    disabled={strategyOptions.length === 0}
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
              {sortedRuns.length === 0 ? (
                <SimpleTable.Empty>
                  {runs.length === 0
                    ? t('No workflow runs yet.')
                    : t('No runs match your filters.')}
                </SimpleTable.Empty>
              ) : (
                sortedRuns.map(run => {
                  const status = getWorkflowStatus(run);
                  const isExpanded = expanded.has(run.id);
                  return (
                    <Fragment key={run.id}>
                      <SimpleTable.Row
                        aria-expanded={isExpanded}
                        onClick={() => toggleExpanded(run.id)}
                        style={{cursor: 'pointer'}}
                      >
                        <SimpleTable.RowCell>
                          <StatusIcon status={status} />
                        </SimpleTable.RowCell>
                        <SimpleTable.RowCell>
                          <Stack gap="2xs">
                            <Text size="sm">
                              <DateTime date={run.dateAdded} />
                            </Text>
                            <Text size="xs" variant="muted">
                              <TimeSince date={run.dateAdded} />
                            </Text>
                          </Stack>
                        </SimpleTable.RowCell>
                        <SimpleTable.RowCell>
                          <Flex gap="sm" align="center" wrap="wrap">
                            <SourceIcon source={run.source} />
                            <Text size="sm">{STRATEGY_META[run.strategy].label}</Text>
                          </Flex>
                        </SimpleTable.RowCell>
                        <SimpleTable.RowCell>
                          <Text
                            size="sm"
                            variant={status === 'failed' ? 'danger' : 'primary'}
                          >
                            {getWorkflowSummary(run)}
                          </Text>
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
                              toggleExpanded(run.id);
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
                            <RunDetail run={run} organizationSlug={organization.slug} />
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

function isSupportedStrategy(strategy: string): strategy is WorkflowStrategy {
  return Object.hasOwn(STRATEGY_META, strategy);
}

const SOURCE_LABELS: Record<WorkflowRunSource, string> = {
  cron: 'Automated',
  manual: 'Manual',
};

const SOURCE_ICONS: Record<
  WorkflowRunSource,
  React.ComponentType<{size?: 'xs' | 'sm' | 'md'; variant?: 'muted'}>
> = {
  cron: IconBot,
  manual: IconUser,
};

function getSourceLabel(source: WorkflowRunSource | null): string {
  if (!source) {
    return '--';
  }
  return SOURCE_LABELS[source] ?? source;
}

function SourceIcon({source}: {source: WorkflowRunSource | null}) {
  if (!source) {
    return (
      <Text size="sm" variant="muted">
        {getSourceLabel(source)}
      </Text>
    );
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
  value: WorkflowDisplayStatus;
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
  Exclude<WorkflowDisplayStatus, 'running'>,
  {
    Icon: React.ComponentType<{size?: 'xs' | 'sm' | 'md'}>;
    label: string;
    text: 'success' | 'danger' | 'muted' | 'warning';
  }
>;

function StatusIcon({status}: {status: WorkflowDisplayStatus}) {
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
  run,
  organizationSlug,
}: {
  organizationSlug: string;
  run: SeerWorkflowRun;
}) {
  const isSentryEmployee = useIsSentryEmployee();
  const hasTriageDebug = isSentryEmployee && run.strategy === 'agentic_triage';
  return (
    <Stack gap="lg">
      <WorkflowResults run={run} organizationSlug={organizationSlug} />
      {run.seerRunId || hasTriageDebug ? (
        <Disclosure>
          <Disclosure.Title>
            <Flex gap="sm" align="center">
              <Text bold>{t('Debug')}</Text>
              {!run.seerRunId && isSentryEmployee && (
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
              {run.seerRunId && (
                <Fragment>
                  <Text size="xs" variant="muted">
                    {t('Run %s', run.id)}
                  </Text>
                  <Link to={getRelativeExplorerUrl(run.seerRunId)}>
                    {t('View prompt and agent run %s', run.seerRunId)}
                  </Link>
                </Fragment>
              )}
              {isSentryEmployee && run.strategy === 'agentic_triage' && (
                <AgenticTriageDebug run={run} />
              )}
            </Stack>
          </Disclosure.Content>
        </Disclosure>
      ) : null}
    </Stack>
  );
}

export default SeerWorkflows;
