import {Fragment} from 'react';

import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface OnDemandThresholdCheckerProps {
  children: (props: {isOnDemandLimitReached: boolean | undefined}) => React.ReactNode;
  isExtrapolatedChartData: boolean;
  projectId: Project['id'];
}

export function OnDemandThresholdChecker({
  isExtrapolatedChartData,
  children,
  projectId,
}: OnDemandThresholdCheckerProps) {
  const organization = useOrganization();

  const {data} = useApiQuery<{max_allowed: number; total_on_demand_alert_specs: number}>(
    [
      `/organizations/${organization.slug}/ondemand-rules/`,
      {
        query: {
          project: projectId,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: isExtrapolatedChartData,
    }
  );

  const isOnDemandLimitReached =
    data === undefined ? undefined : data.total_on_demand_alert_specs >= data.max_allowed;

  return <Fragment>{children({isOnDemandLimitReached})}</Fragment>;
}
