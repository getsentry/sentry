import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import {IconChevron} from '@sentry/icons/chevron';
import {IconFilter} from '@sentry/icons/filter';
import {skipToken, useMutation, useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {DateTime} from 'sentry/components/dateTime';
import {NotFound} from 'sentry/components/errors/notFound';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tn} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getRelativeExplorerUrl} from 'sentry/views/seerExplorer/utils';
import {useAutomationRuns} from 'sentry/views/seerWorkflows/automations/hooks/useAutomationRuns';
import {
  getRunDisplayStatus,
  StatusIcon,
} from 'sentry/views/seerWorkflows/automations/runs/statusIcon';
import {
  getStrategyLabel,
  getWorkflowRunActions,
} from 'sentry/views/seerWorkflows/strategies';
import type {
  SeerAutomationRun,
  SeerWorkflowConfigsResponse,
  WorkflowDisplayStatus,
  WorkflowRunCreateRequest,
} from 'sentry/views/seerWorkflows/types';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

const RUNS_COLUMNS: TableColumnConfig[] = [
  {key: 'select', width: 'min-content'},
  {key: 'date', width: 'max-content'},
  {key: 'strategy', width: '1fr'},
  {key: 'result', width: '2fr'},
  {key: 'actions', width: 'min-content'},
];

export default function AutomationRunsList() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const automationsEnabled = useAutomationsEnabled();
  const runActions = getWorkflowRunActions(organization.features);
  const [expanded, setExpanded] = useState(new Set<string>());
  const {mutate: startWorkflowRun, isPending: isStartingWorkflowRun} = useMutation({
    mutationFn: (data: WorkflowRunCreateRequest) =>
      fetchMutation<{runId: string}>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/seer/workflows/runs/', {
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

  const {runs: apiRuns, isPending, isError, refetch} = useAutomationRuns();
  // Runs only reference their config, so look up each run's strategy from its config
  const {data: configsData} = useQuery(
    apiOptions.as<SeerWorkflowConfigsResponse>()(
      '/organizations/$organizationIdOrSlug/seer/workflows/configs/',
      {
        path: automationsEnabled ? {organizationIdOrSlug: organization.slug} : skipToken,
        staleTime: 30_000,
      }
    )
  );
  const runs: RunWithStrategy[] = useMemo(() => {
    const strategies = new Map(
      configsData?.configs.map(config => [config.id, config.strategy])
    );
    return apiRuns.map(run => ({...run, strategy: strategies.get(run.configId) ?? null}));
  }, [apiRuns, configsData]);

  const strategyFilter = decodeList(location.query.strategy);
  const statusFilter = decodeList(location.query.status) as WorkflowDisplayStatus[];
  const period = decodeScalar(location.query.period);

  const [now] = useState(() => Date.now());
  const periodCutoffMs = useMemo(() => {
    const days = PERIOD_TO_DAYS[period ?? ''];
    return days === undefined ? null : now - days * 24 * 60 * 60 * 1000;
  }, [period, now]);

  const strategyOptions = useMemo(
    () =>
      Array.from(new Set(runs.flatMap(run => (run.strategy ? [run.strategy] : [])))).map(
        strategy => ({
          value: strategy,
          label: getStrategyLabel(strategy),
        })
      ),
    [runs]
  );

  const filteredRuns = useMemo(() => {
    return runs.filter(run => {
      if (
        strategyFilter.length &&
        (!run.strategy || !strategyFilter.includes(run.strategy))
      ) {
        return false;
      }
      const status = getRunDisplayStatus(run.status);
      if (statusFilter.length && (!status || !statusFilter.includes(status))) {
        return false;
      }
      if (periodCutoffMs !== null && Date.parse(run.dateAdded) < periodCutoffMs) {
        return false;
      }
      return true;
    });
  }, [runs, strategyFilter, statusFilter, periodCutoffMs]);

  const sortDirection = decodeScalar(location.query.sort) === 'asc' ? 'asc' : 'desc';

  const sortedRuns = useMemo(() => {
    const cmp = (a: RunWithStrategy, b: RunWithStrategy) =>
      Date.parse(a.dateAdded) - Date.parse(b.dateAdded);
    const next = filteredRuns.toSorted(cmp);
    return sortDirection === 'desc' ? next.reverse() : next;
  }, [filteredRuns, sortDirection]);

  const hasActiveFilters =
    strategyFilter.length > 0 || statusFilter.length > 0 || period !== undefined;

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

  const expandLatest = decodeScalar(location.query.expandLatest);
  const autoExpandedForRef = useRef<string | null>(null);
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

  if (!automationsEnabled) {
    return <NotFound />;
  }

  return (
    <Stack gap="lg">
      <Stack gap="2xs">
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

      {isError && apiRuns.length === 0 ? (
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
                  value={period ?? ''}
                  options={PERIOD_FILTER_OPTIONS}
                  onChange={selected =>
                    updateQuery({
                      period: selected.value === '' ? undefined : String(selected.value),
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
                const status = getRunDisplayStatus(run.status);
                const isExpanded = expanded.has(run.id);
                return (
                  <Fragment key={run.id}>
                    <SimpleTable.Row
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(run.id)}
                      style={{cursor: 'pointer'}}
                    >
                      <SimpleTable.RowCell>
                        {status ? (
                          <StatusIcon status={status} />
                        ) : (
                          <Text variant="muted">{'\u2014'}</Text>
                        )}
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
                        <Text size="sm">
                          {run.strategy ? getStrategyLabel(run.strategy) : '\u2014'}
                        </Text>
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <Text
                          size="sm"
                          variant={status === 'failed' ? 'danger' : 'primary'}
                        >
                          {getRunSummary(run)}
                        </Text>
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <Button
                          aria-label={isExpanded ? t('Collapse run') : t('Expand run')}
                          size="xs"
                          variant="transparent"
                          icon={<IconChevron direction={isExpanded ? 'down' : 'right'} />}
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
                          <RunDetail run={run} />
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
  );
}

type RunWithStrategy = SeerAutomationRun & {
  /**
   * From the run's config. Null until configs load, or if the config is gone
   */
  strategy: string | null;
};

function getRunSummary(run: SeerAutomationRun): string {
  switch (run.status) {
    case 'failed':
    case 'rejected':
      return run.error.message;
    case 'queued':
      return t('Queued');
    case 'running':
      return t('Running…');
    case 'complete':
    case null:
      return tn('%s execution', '%s executions', run.executions.length);
  }
}

const STATUS_FILTER_OPTIONS: Array<{
  label: string;
  value: WorkflowDisplayStatus;
}> = [
  {value: 'succeeded', label: 'Succeeded'},
  {value: 'failed', label: 'Failed'},
  {value: 'skipped', label: 'Skipped'},
  {value: 'running', label: 'Running'},
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

function RunDetail({run}: {run: SeerAutomationRun}) {
  if (run.executions.length === 0) {
    return (
      <Text size="sm" variant="muted">
        {t('No executions recorded for this run.')}
      </Text>
    );
  }
  return (
    <Stack gap="sm">
      {run.executions.map(execution => {
        const status = getRunDisplayStatus(execution.status);
        return (
          <Flex key={execution.id} gap="md" align="center" wrap="wrap">
            {status && <StatusIcon status={status} />}
            <Text size="sm">{t('Execution %s', execution.id)}</Text>
            <Text size="sm" variant="muted">
              <DateTime date={execution.dateAdded} />
            </Text>
            {execution.status === 'failed' && (
              <Text size="sm" variant="danger">
                {execution.error.message}
              </Text>
            )}
            {execution.seerRunId && (
              <Link to={getRelativeExplorerUrl(execution.seerRunId)}>
                {t('View agent run')}
              </Link>
            )}
          </Flex>
        );
      })}
    </Stack>
  );
}
