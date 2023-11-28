import isArray from 'lodash/isArray';

import {PageFilters} from 'sentry/types';
import {MetricMetaCodeLocation} from 'sentry/utils/metrics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useMetricsCodeLocations(
  mri: string | undefined,
  projects?: PageFilters['projects']
) {
  const organization = useOrganization();

  const {data, isLoading} = useApiQuery<{codeLocations: MetricMetaCodeLocation[]}>(
    [
      `/organizations/${organization.slug}/ddm/meta/`,
      {query: {metric: mri, project: projects}},
    ],
    {
      enabled: !!mri,
      staleTime: Infinity,
    }
  );

  if (data && isArray(data?.codeLocations)) {
    data.codeLocations = data.codeLocations.filter(
      codeLocation => codeLocation.mri === mri
    );
  }

  return {data, isLoading};
}
