import {MRI, PageFilters} from 'sentry/types';
import {MetricTag} from 'sentry/utils/metrics';
import {getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
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
