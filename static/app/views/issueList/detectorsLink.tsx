import {LinkButton} from '@sentry/scraps/button/linkButton';

import {tn} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getDetectorTypeSearchAlias} from 'sentry/views/detectors/utils/detectorTypeConfig';

type DetectorCounts = {
  active: number;
  deactive: number;
  total: number;
};

type DetectorsLinkProps = {
  detectorTypes: DetectorType[];
};

export function DetectorsLink({detectorTypes}: DetectorsLinkProps) {
  const organization = useOrganization();
  const location = useLocation();

  const {data: detectorsData, isPending} = useApiQuery<DetectorCounts>(
    [
      `/organizations/${organization.slug}/detectors/count/`,
      {
        query: {
          project: location.query.project,
          type: detectorTypes,
        },
      },
    ],
    {
      staleTime: 0,
      placeholderData: keepPreviousData,
      retry: false,
    }
  );

  if (isPending || !detectorsData) {
    return null;
  }

  return (
    <LinkButton
      to={{
        pathname: `/organizations/${organization.slug}/monitors/`,
        query: {
          project: location.query.project,
          query:
            detectorTypes.length > 0
              ? `type:[${detectorTypes.map(type => getDetectorTypeSearchAlias(type)).join(',')}]`
              : undefined,
        },
      }}
    >
      {tn('%s Monitor', '%s Monitors', detectorsData?.total)}
    </LinkButton>
  );
}
