import {Fragment} from 'react';
import {Location} from 'history';

import {Organization} from 'sentry/types';
import DiscoverQuery, {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {GenericChildrenProps} from 'sentry/utils/discover/genericDiscoverQuery';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';

import {getMetricOnlyQueryParams} from './widgets/utils';

export interface MetricDataSwitcherChildrenProps {
  forceTransactionsOnly: boolean;
  compatibleProjects?: number[];
  shouldNotifyUnnamedTransactions?: boolean;
  shouldWarnIncompatibleSDK?: boolean;
}

interface MetricDataSwitchProps {
  children: (props: MetricDataSwitcherChildrenProps) => React.ReactNode;
  eventView: EventView;
  location: Location;
  organization: Organization;
}

export enum LandingPageMEPDecision {
  fallbackToTransactions = 'fallbackToTransactions',
}

interface DataCounts {
  metricsCountData: GenericChildrenProps<TableData>;
  nullData: GenericChildrenProps<TableData>;
  transactionCountData: GenericChildrenProps<TableData>;
  unparamData: GenericChildrenProps<TableData>;
}

/**
 * This component decides based on some stats about current projects whether to show certain views of the landing page.
 * It is primarily needed for the rollout during which time users, despite having the flag enabled,
 * may or may not have sampling rules, compatible sdk's etc. This can be simplified post rollout.
 */
export function MetricsDataSwitcher(props: MetricDataSwitchProps) {
  const isUsingMetrics = canUseMetricsData(props.organization);

  if (!isUsingMetrics) {
    return (
      <Fragment>
        {props.children({
          forceTransactionsOnly: true,
        })}
      </Fragment>
    );
  }

  const countView = props.eventView.withColumns([{kind: 'field', field: 'count()'}]);
  countView.statsPeriod = '15m';
  countView.start = undefined;
  countView.end = undefined;
  const unparamView = countView.clone();
  unparamView.additionalConditions.setFilterValues('transaction', [
    '<< unparameterized >>',
  ]);
  const nullView = countView.clone();
  nullView.additionalConditions.setFilterValues('transaction', ['']);

  const projectCompatibleView = countView.withColumns([
    {kind: 'field', field: 'project.id'},
    {kind: 'field', field: 'count()'},
  ]);

  const projectIncompatibleView = projectCompatibleView.clone();
  projectIncompatibleView.additionalConditions.setFilterValues('transaction', ['']);

  const baseDiscoverProps = {
    location: props.location,
    orgSlug: props.organization.slug,
    cursor: '0:0:0',
  };

  const metricsDiscoverProps = {
    ...baseDiscoverProps,
    queryExtras: getMetricOnlyQueryParams(),
  };

  return (
    <Fragment>
      <DiscoverQuery eventView={countView} {...baseDiscoverProps}>
        {transactionCountData => (
          <DiscoverQuery eventView={countView} {...metricsDiscoverProps}>
            {metricsCountData => (
              <DiscoverQuery eventView={nullView} {...metricsDiscoverProps}>
                {nullData => (
                  <DiscoverQuery eventView={unparamView} {...metricsDiscoverProps}>
                    {unparamData => (
                      <DiscoverQuery
                        eventView={projectCompatibleView}
                        {...metricsDiscoverProps}
                      >
                        {projectsCompatData => (
                          <DiscoverQuery
                            eventView={projectIncompatibleView}
                            {...metricsDiscoverProps}
                          >
                            {projectsIncompatData => {
                              if (
                                transactionCountData.isLoading ||
                                unparamData.isLoading ||
                                metricsCountData.isLoading ||
                                projectsIncompatData.isLoading ||
                                nullData.isLoading ||
                                projectsCompatData.isLoading
                              ) {
                                return null;
                              }

                              const dataCounts: DataCounts = {
                                transactionCountData,
                                metricsCountData,
                                nullData,
                                unparamData,
                              };

                              const compatibleProjects = getCompatibleProjects({
                                projectsCompatData,
                                projectsIncompatData,
                              });

                              if (checkIfNotEffectivelySampling(dataCounts)) {
                                return (
                                  <Fragment>
                                    {props.children({
                                      forceTransactionsOnly: true,
                                    })}
                                  </Fragment>
                                );
                              }

                              if (checkNoDataFallback(dataCounts)) {
                                return (
                                  <Fragment>
                                    {props.children({
                                      forceTransactionsOnly: true,
                                    })}
                                  </Fragment>
                                );
                              }

                              if (checkIncompatibleData(dataCounts)) {
                                return (
                                  <Fragment>
                                    {props.children({
                                      shouldWarnIncompatibleSDK: true,
                                      forceTransactionsOnly: true,
                                      compatibleProjects,
                                    })}
                                  </Fragment>
                                );
                              }

                              if (checkIfAllOtherData(dataCounts)) {
                                return (
                                  <Fragment>
                                    {props.children({
                                      shouldNotifyUnnamedTransactions: true,
                                      forceTransactionsOnly: true,
                                      compatibleProjects,
                                    })}
                                  </Fragment>
                                );
                              }

                              if (checkIfPartialOtherData(dataCounts)) {
                                return (
                                  <Fragment>
                                    {props.children({
                                      shouldNotifyUnnamedTransactions: true,
                                      compatibleProjects,

                                      forceTransactionsOnly: false,
                                    })}
                                  </Fragment>
                                );
                              }

                              return (
                                <Fragment>
                                  {props.children({
                                    forceTransactionsOnly: false,
                                  })}
                                </Fragment>
                              );
                            }}
                          </DiscoverQuery>
                        )}
                      </DiscoverQuery>
                    )}
                  </DiscoverQuery>
                )}
              </DiscoverQuery>
            )}
          </DiscoverQuery>
        )}
      </DiscoverQuery>
    </Fragment>
  );
}

/**
 * Fallback if very similar amounts of metrics and transactions are found.
 * Only used to rollout sampling before rules are selected. Could be replaced with project dynamic sampling check directly.
 */
function checkIfNotEffectivelySampling(dataCounts: DataCounts) {
  const counts = extractCounts(dataCounts);
  if (counts.metricsCount === 0) {
    return true;
  }
  return (
    counts.transactionsCount > 0 &&
    counts.metricsCount > counts.transactionsCount &&
    counts.transactionsCount >= counts.metricsCount * 0.95
  );
}

/**
 * Fallback if no metrics found.
 */
function checkNoDataFallback(dataCounts: DataCounts) {
  const counts = extractCounts(dataCounts);
  return !counts.metricsCount;
}

/**
 * Fallback and warn if incompatible data found (old specific SDKs).
 */
function checkIncompatibleData(dataCounts: DataCounts) {
  const counts = extractCounts(dataCounts);
  return counts.nullCount > 0;
}

/**
 * Fallback and warn about unnamed transactions (specific SDKs).
 */
function checkIfAllOtherData(dataCounts: DataCounts) {
  const counts = extractCounts(dataCounts);
  return counts.unparamCount >= counts.metricsCount;
}

/**
 * Show metrics but warn about unnamed transactions.
 */
function checkIfPartialOtherData(dataCounts: DataCounts) {
  const counts = extractCounts(dataCounts);
  return counts.unparamCount > 0;
}

/**
 * Temporary function, can be removed after API changes.
 */
function extractCounts({
  metricsCountData,
  transactionCountData,
  unparamData,
  nullData,
}: DataCounts) {
  try {
    const metricsCount = Number(metricsCountData.tableData?.data?.[0].count);
    const transactionsCount = Number(transactionCountData.tableData?.data?.[0].count);
    const unparamCount = Number(unparamData.tableData?.data?.[0].count);
    const nullCount = Number(nullData.tableData?.data?.[0].count);
    return {
      metricsCount,
      transactionsCount,
      unparamCount,
      nullCount,
    };
  } catch (_) {
    return {
      metricsCount: 0,
      transactionsCount: 0,
      unparamCount: 0,
      nullCount: 0,
    };
  }
}

/**
 * Temporary function, can be removed after API changes.
 */
function getCompatibleProjects({
  projectsCompatData,
  projectsIncompatData,
}: {
  projectsCompatData: GenericChildrenProps<TableData>;
  projectsIncompatData: GenericChildrenProps<TableData>;
}) {
  const baseProjectRows = projectsCompatData.tableData?.data || [];
  const projectIdsPage = baseProjectRows.map(row => Number(row['project.id']));

  const incompatProjectsRows = projectsIncompatData.tableData?.data || [];
  const incompatProjectIds = incompatProjectsRows.map(row => Number(row['project.id']));

  return projectIdsPage.filter(projectId => !incompatProjectIds.includes(projectId));
}
