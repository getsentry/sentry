import {Fragment} from 'react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Organization} from 'sentry/types';
import {
  MetricDataSwitcherOutcome,
  useMetricsCardinalityContext,
} from 'sentry/utils/performance/contexts/metricsCardinality';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';

interface MetricDataSwitchProps {
  children: (props: MetricDataSwitcherOutcome) => React.ReactNode;
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

  return <Fragment>{props.children(metricsCardinality.outcome)}</Fragment>;
}

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
`;
