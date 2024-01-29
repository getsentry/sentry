import type {MRI, PageFilters} from 'sentry/types';
import {getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import type {MetricTag} from 'sentry/utils/metrics/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useMetricsTagValues(
  mri: MRI,
  tag: string,
  projects: PageFilters['projects']
) {
  const {slug} = useOrganization();
  const useCase = getUseCaseFromMRI(mri);
  return useApiQuery<MetricTag[]>(
    [
      `/organizations/${slug}/metrics/tags/${tag}/`,
      {query: {metric: mri, useCase, project: projects}},
    ],
    {
      staleTime: Infinity,
      enabled: !!tag,
    }
  );
}
