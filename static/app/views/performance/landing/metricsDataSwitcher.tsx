import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import type {MetricDataSwitcherOutcome} from 'sentry/utils/performance/contexts/metricsCardinality';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import {
  canUseMetricsData,
  MEPState,
  METRIC_SEARCH_SETTING_PARAM,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {decodeScalar} from 'sentry/utils/queryString';
import {useNavigate} from 'sentry/utils/useNavigate';

interface MetricDataSwitchProps {
  children: (props: MetricDataSwitcherOutcome) => React.ReactNode;
  eventView: EventView;
  location: Location;
  organization: Organization;
  hideLoadingIndicator?: boolean;
}

/**
 * This component decides based on some stats about current projects whether to show certain views of the landing page.
 * It is primarily needed for the rollout during which time users, despite having the flag enabled,
 * may or may not have sampling rules, compatible sdk's etc. This can be simplified post rollout.
 */
export function MetricsDataSwitcher(props: MetricDataSwitchProps) {
  const isUsingMetrics = canUseMetricsData(props.organization);
  const metricsCardinality = useMetricsCardinalityContext();

  if (!isUsingMetrics) {
    return (
      <Fragment>
        {props.children({
          forceTransactionsOnly: true,
        })}
      </Fragment>
    );
  }

  if (metricsCardinality.isLoading && !props.hideLoadingIndicator) {
    return (
      <Fragment>
        <LoadingContainer>
          <LoadingIndicator />
        </LoadingContainer>
      </Fragment>
    );
  }

  if (!metricsCardinality.outcome) {
    return (
      <Fragment>
        {props.children({
          forceTransactionsOnly: true,
        })}
      </Fragment>
    );
  }

  return (
    <Fragment>
      <MetricsSwitchHandler
        eventView={props.eventView}
        location={props.location}
        outcome={metricsCardinality.outcome}
        switcherChildren={props.children}
      />
    </Fragment>
  );
}

interface SwitcherHandlerProps {
  eventView: EventView;
  location: Location;
  outcome: MetricDataSwitcherOutcome;
  switcherChildren: MetricDataSwitchProps['children'];
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
  const queryIsTransactionsBased = mepSearchState === MEPState.TRANSACTIONS_ONLY;
  const navigate = useNavigate();

  const shouldAdjustQuery =
    hasQuery && queryIsTransactionsBased && !outcome.forceTransactionsOnly;

  useEffect(() => {
    if (shouldAdjustQuery) {
      navigate({
        pathname: location.pathname,
        query: {
          ...location.query,
          cursor: undefined,
          query: undefined,
          [METRIC_SEARCH_SETTING_PARAM]: undefined,
        },
      });
    }
  }, [shouldAdjustQuery, location, navigate]);

  if (hasQuery && queryIsTransactionsBased && !outcome.forceTransactionsOnly) {
    eventView.query = ''; // TODO: Create switcher provider and move it to the route level to remove the need for this.
  }

  return <Fragment>{switcherChildren(outcome)}</Fragment>;
}

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
`;
