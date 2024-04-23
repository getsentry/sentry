import type {MRI, Organization, PageFilters} from 'sentry/types';
import {getUseCaseFromMRI} from 'sentry/utils/metrics/mri';
import type {MetricTag} from 'sentry/utils/metrics/types';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {getMetaDateTimeParams} from './index';

export function getMetricsTagsQueryKey(
  organization: Organization,
  mri: MRI | undefined,
  pageFilters: Partial<PageFilters>
) {
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

  return [
    `/organizations/${organization.slug}/metrics/tags/`,
    {
      query: queryParams,
    },
  ] as const;
}

export function useMetricsTags(
  mri: MRI | undefined,
  pageFilters: Partial<PageFilters>,
  filterBlockedTags = true,
  blockedTags?: string[]
) {
  const organization = useOrganization();
  const useCase = getUseCaseFromMRI(mri) ?? 'custom';

  const tagsQuery = useApiQuery<MetricTag[]>(
    getMetricsTagsQueryKey(organization, mri, pageFilters),
    {
      enabled: !!mri,
      staleTime: Infinity,
    }
  );

  const metricMeta = useMetricsMeta(pageFilters, [useCase], false, !blockedTags);
  const blockedTagsData =
    (blockedTags ||
      metricMeta.data
        ?.find(meta => meta.mri === mri)
        ?.blockingStatus?.flatMap(s => s.blockedTags)) ??
    [];

  if (!filterBlockedTags) {
    return tagsQuery;
  }

  return {
    ...tagsQuery,
    data: tagsQuery.data?.filter(tag => !blockedTagsData.includes(tag.key)) ?? [],
  };
}
