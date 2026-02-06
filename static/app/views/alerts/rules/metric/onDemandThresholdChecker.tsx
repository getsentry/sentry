import {Fragment} from 'react';

import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
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

  const {data} = useApiQuery<{maxAllowed: number; totalOnDemandAlertSpecs: number}>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/ondemand-rules-stats/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
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
    data === undefined ? undefined : data.totalOnDemandAlertSpecs >= data.maxAllowed;

  return <Fragment>{children({isOnDemandLimitReached})}</Fragment>;
}
