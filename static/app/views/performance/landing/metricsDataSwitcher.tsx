import {Location} from 'history';
import {Fragment, useEffect} from 'react';
import {browserHistory} from 'react-router';

import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {
  canUseMetricsData,
  MEPState,
  METRIC_SEARCH_SETTING_PARAM,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';

import styled from '@emotion/styled';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {parsePeriodToHours} from 'sentry/utils/dates';
import MetricsCompatibilityQuery, {
  MetricsCompatibilityData,
} from 'sentry/utils/performance/metricsEnhanced/metricsCompatibilityQuery';
import {decodeScalar} from 'sentry/utils/queryString';

export interface MetricDataSwitcherOutcome {
  forceTransactionsOnly: boolean;
  compatibleProjects?: number[];
  shouldNotifyUnnamedTransactions?: boolean;
  shouldWarnIncompatibleSDK?: boolean;
}

interface MetricDataSwitchProps {
  children: (props: MetricDataSwitcherOutcome) => React.ReactNode;
  eventView: EventView;
  location: Location;
  organization: Organization;
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

  const baseDiscoverProps = {
    location: props.location,
    orgSlug: props.organization.slug,
    cursor: '0:0:0',
  };
  const _eventView = adjustEventViewTime(props.eventView);

  return (
    <Fragment>
      <MetricsCompatibilityQuery eventView={_eventView} {...baseDiscoverProps}>
        {data => {
          if (data.isLoading) {
            return (
              <Fragment>
                <LoadingContainer>
                  <LoadingIndicator />
                </LoadingContainer>
              </Fragment>
            );
          }

          const outcome = getMetricsOutcome(data.tableData, !!data.error);
          return (
            <MetricsSwitchHandler
              eventView={props.eventView}
              location={props.location}
              outcome={outcome}
              switcherChildren={props.children}
            />
          );
        }}
      </MetricsCompatibilityQuery>
    </Fragment>
  );
}

/**
 * Performance optimization to limit the amount of rows scanned before showing the landing page.
 */
function adjustEventViewTime(eventView: EventView) {
  const _eventView = eventView.clone();

  if (!_eventView.start && !_eventView.end) {
    if (!_eventView.statsPeriod) {
      _eventView.statsPeriod = '1h';
      _eventView.start = undefined;
      _eventView.end = undefined;
    } else {
      const periodHours = parsePeriodToHours(_eventView.statsPeriod);
      if (periodHours > 1) {
        _eventView.statsPeriod = '1h';
        _eventView.start = undefined;
        _eventView.end = undefined;
      }
    }
  }
  return _eventView;
}

interface SwitcherHandlerProps {
  outcome: MetricDataSwitcherOutcome;
  switcherChildren: MetricDataSwitchProps['children'];
  location: Location;
  eventView: EventView;
}

function MetricsSwitchHandler({
  switcherChildren,
  outcome,
  location,
  eventView,
}: SwitcherHandlerProps) {
  const {query} = location;
  const mepSearchState = decodeScalar(query[METRIC_SEARCH_SETTING_PARAM], '');
  const hasQuery = decodeScalar(query.query, '');
  const queryIsTransactionsBased = mepSearchState === MEPState.transactionsOnly;

  const shouldAdjustQuery =
    hasQuery && queryIsTransactionsBased && !outcome.forceTransactionsOnly;

  useEffect(() => {
    if (shouldAdjustQuery) {
      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          cursor: undefined,
          query: undefined,
          [METRIC_SEARCH_SETTING_PARAM]: undefined,
        },
      });
    }
  }, [shouldAdjustQuery, location]);

  if (hasQuery && queryIsTransactionsBased && !outcome.forceTransactionsOnly) {
    eventView.query = ''; // TODO: Create switcher provider and move it to the route level to remove the need for this.
  }

  return <Fragment>{switcherChildren(outcome)}</Fragment>;
}

/**
 * Logic for picking sides of metrics vs. transactions along with the associated warnings.
 */
function getMetricsOutcome(
  dataCounts: MetricsCompatibilityData | null,
  hasOtherFallbackCondition: boolean
) {
  const fallbackOutcome: MetricDataSwitcherOutcome = {
    forceTransactionsOnly: true,
  };
  const successOutcome: MetricDataSwitcherOutcome = {
    forceTransactionsOnly: false,
  };
  if (!dataCounts) {
    return fallbackOutcome;
  }
  const compatibleProjects = dataCounts.compatible_projects;

  if (hasOtherFallbackCondition) {
    return fallbackOutcome;
  }

  if (!dataCounts) {
    return fallbackOutcome;
  }

  if (checkForSamplingRules(dataCounts)) {
    return fallbackOutcome;
  }

  if (checkNoDataFallback(dataCounts)) {
    return fallbackOutcome;
  }

  if (checkIncompatibleData(dataCounts)) {
    return {
      shouldWarnIncompatibleSDK: true,
      forceTransactionsOnly: true,
      compatibleProjects,
    };
  }

  if (checkIfAllOtherData(dataCounts)) {
    return {
      shouldNotifyUnnamedTransactions: true,
      forceTransactionsOnly: true,
      compatibleProjects,
    };
  }

  if (checkIfPartialOtherData(dataCounts)) {
    return {
      shouldNotifyUnnamedTransactions: true,
      compatibleProjects,
      forceTransactionsOnly: false,
    };
  }

  return successOutcome;
}

/**
 * Fallback if very similar amounts of metrics and transactions are found.
 * No projects with dynamic sampling means no rules have been enabled yet.
 */
function checkForSamplingRules(dataCounts: MetricsCompatibilityData) {
  const counts = normalizeCounts(dataCounts);
  if (!dataCounts.dynamic_sampling_projects?.length) {
    return true;
  }
  if (counts.metricsCount === 0) {
    return true;
  }
  return false;
}

/**
 * Fallback if no metrics found.
 */
function checkNoDataFallback(dataCounts: MetricsCompatibilityData) {
  const counts = normalizeCounts(dataCounts);
  return !counts.metricsCount;
}

/**
 * Fallback and warn if incompatible data found (old specific SDKs).
 */
function checkIncompatibleData(dataCounts: MetricsCompatibilityData) {
  const counts = normalizeCounts(dataCounts);
  return counts.nullCount > 0;
}

/**
 * Fallback and warn about unnamed transactions (specific SDKs).
 */
function checkIfAllOtherData(dataCounts: MetricsCompatibilityData) {
  const counts = normalizeCounts(dataCounts);
  return counts.unparamCount >= counts.metricsCount;
}

/**
 * Show metrics but warn about unnamed transactions.
 */
function checkIfPartialOtherData(dataCounts: MetricsCompatibilityData) {
  const counts = normalizeCounts(dataCounts);
  return counts.unparamCount > 0;
}

/**
 * Temporary function, can be removed after API changes.
 */
function normalizeCounts({sum}: MetricsCompatibilityData) {
  try {
    const metricsCount = Number(sum.metrics);
    const unparamCount = Number(sum.metrics_unparam);
    const nullCount = Number(sum.metrics_null);
    return {
      metricsCount,
      unparamCount,
      nullCount,
    };
  } catch (_) {
    return {
      metricsCount: 0,
      unparamCount: 0,
      nullCount: 0,
    };
  }
}

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
`;
