import {Fragment} from 'react';

import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {isOnDemandMetricAlert} from 'sentry/views/alerts/rules/metric/utils/onDemandMetricAlert';
import {CombinedAlertType, type MetricAlert} from 'sentry/views/alerts/types';

// The maximum number of on-demand metric alerts that can be created per project.
// This value is defined in Sentry's options in the following file:
// https://github.com/getsentry/sentry/blob/cac47187ae98f105b39edf80a0fd3105c95e1cb5/src/sentry/options/defaults.py#L2215-L2219
const MAX_ON_DEMAND_METRIC_ALERTS = 50;

interface OnDemandThresholdCheckerProps {
  children: (props: {isOnDemandLimitReached: boolean}) => React.ReactNode;
  isExtrapolatedChartData: boolean;
  projectId: Project['id'];
}

export function OnDemandThresholdChecker({
  isExtrapolatedChartData,
  children,
  projectId,
}: OnDemandThresholdCheckerProps) {
  const organization = useOrganization();

  const {data} = useApiQuery<Array<MetricAlert | null>>(
    [
      `/organizations/${organization.slug}/combined-rules/`,
      {
        query: {
          project: projectId,
          alert_type: CombinedAlertType.METRIC,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: isExtrapolatedChartData,
    }
  );

  const onDemandMetricAlerts = (data ?? [])
    .filter(defined)
    .filter(alert => isOnDemandMetricAlert(alert.dataset, alert.aggregate, alert.query));

  const isOnDemandLimitReached =
    onDemandMetricAlerts.length >= MAX_ON_DEMAND_METRIC_ALERTS;

  return <Fragment>{children({isOnDemandLimitReached})}</Fragment>;
}
