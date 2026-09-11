import {Fragment, useEffect} from 'react';
import type {Location} from 'history';

import type {MetricDataSwitcherOutcome} from 'sentry/utils/performance/contexts/metricsCardinality';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import {
  MEPState,
  METRIC_SEARCH_SETTING_PARAM,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {decodeScalar} from 'sentry/utils/queryString';
import {useNavigate} from 'sentry/utils/useNavigate';

interface MetricDataSwitchProps {
  children: (props: MetricDataSwitcherOutcome) => React.ReactNode;
  location: Location;
}

/**
 * This component decides based on some stats about current projects whether to show certain views of the landing page.
 * It is primarily needed for the rollout during which time users, despite having the flag enabled,
 * may or may not have sampling rules, compatible sdk's etc. This can be simplified post rollout.
 */
export function MetricsDataSwitcher(props: MetricDataSwitchProps) {
  const metricsCardinality = useMetricsCardinalityContext();

  // Always use MetricsSwitchHandler for consistent component structure
  // to prevent remounting children when outcome changes
  return (
    <Fragment>
      <MetricsSwitchHandler
        location={props.location}
        outcome={metricsCardinality?.outcome ?? {forceTransactionsOnly: false}}
        switcherChildren={props.children}
      />
    </Fragment>
  );
}

interface SwitcherHandlerProps {
  location: Location;
  outcome: MetricDataSwitcherOutcome;
  switcherChildren: MetricDataSwitchProps['children'];
}

function MetricsSwitchHandler({
  switcherChildren,
  outcome,
  location,
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

  return <Fragment>{switcherChildren(outcome)}</Fragment>;
}
