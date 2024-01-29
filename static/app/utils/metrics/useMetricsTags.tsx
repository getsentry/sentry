import type {MRI, PageFilters} from 'sentry/types';
import {getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import type {MetricTag} from 'sentry/utils/metrics/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useMetricsTags(mri: MRI | undefined, projects: PageFilters['projects']) {
  const {slug} = useOrganization();
  const useCase = getUseCaseFromMRI(mri);
  return useApiQuery<MetricTag[]>(
    [
      `/organizations/${slug}/metrics/tags/`,
      {query: {metric: mri, useCase, project: projects}},
    ],
    {
      enabled: !!mri,
      staleTime: Infinity,
    }
  );
}
