import type {MRI, PageFilters} from 'sentry/types';
import {getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import type {MetricTag} from 'sentry/utils/metrics/types';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useMetricsTags(
  mri: MRI | undefined,
  projects: PageFilters['projects'],
  filterBlockedTags = true
) {
  const {slug} = useOrganization();
  const useCase = getUseCaseFromMRI(mri) ?? 'custom';

  const tagsQuery = useApiQuery<MetricTag[]>(
    [
      `/organizations/${slug}/metrics/tags/`,
      {query: {metric: mri, useCase, project: projects}},
    ],
    {
      enabled: !!mri,
      staleTime: Infinity,
    }
  );

  const metricMeta = useMetricsMeta(projects, [useCase], false);
  const blockedTags =
    metricMeta.data
      ?.find(meta => meta.mri === mri)
      ?.blockingStatus?.flatMap(s => s.blockedTags) ?? [];

  if (!filterBlockedTags) {
    return tagsQuery;
  }

  return {
    ...tagsQuery,
    data: tagsQuery.data?.filter(tag => !blockedTags.includes(tag.key)) ?? [],
  };
}
