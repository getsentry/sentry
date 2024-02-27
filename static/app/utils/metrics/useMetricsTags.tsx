import type {MRI, PageFilters} from 'sentry/types';
import {getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import type {MetricTag} from 'sentry/utils/metrics/types';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {getMetaDateTimeParams} from './index';

export function useMetricsTags(
  mri: MRI | undefined,
  pageFilters: Partial<PageFilters>,
  filterBlockedTags = true
) {
  const {slug} = useOrganization();
  const useCase = getUseCaseFromMRI(mri) ?? 'custom';

  const queryParams = pageFilters.projects?.length
    ? {
        metric: mri,
        useCase,
        project: pageFilters.projects,
        ...getMetaDateTimeParams(pageFilters.datetime),
      }
    : {
        metric: mri,
        useCase,
        ...getMetaDateTimeParams(pageFilters.datetime),
      };

  const tagsQuery = useApiQuery<MetricTag[]>(
    [
      `/organizations/${slug}/metrics/tags/`,
      {
        query: queryParams,
      },
    ],
    {
      enabled: !!mri,
      staleTime: Infinity,
    }
  );

  const metricMeta = useMetricsMeta(pageFilters, [useCase], false);
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
