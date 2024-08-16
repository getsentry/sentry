import type {PageFilters} from 'sentry/types/core';
import type {MRI} from 'sentry/types/metrics';
import type {Organization} from 'sentry/types/organization';
import {SPAN_DURATION_MRI} from 'sentry/utils/metrics/constants';
import {parseMRI} from 'sentry/utils/metrics/mri';
import type {MetricTag} from 'sentry/utils/metrics/types';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

const ALLOWED_SPAN_DURATION_TAGS = [
  'span.category',
  'span.description',
  'environment',
  'project',
  'span.action',
  'span.domain',
  'span.op',
  'transaction',
];

export function getMetricsTagsQueryKey(
  organization: Organization,
  mri: MRI | undefined,
  pageFilters: Partial<PageFilters>
) {
  const queryParams = {
    metric: mri,
    project: pageFilters.projects,
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
  const parsedMRI = parseMRI(mri);
  const useCase = parsedMRI?.useCase ?? 'custom';

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

  let tags = {
    ...tagsQuery,
    data: tagsQuery.data?.filter(tag => !blockedTagsData.includes(tag.key)) ?? [],
  };

  // Span duration only exposes tags that are found on all/most spans to
  // avoid tags that are only collected for specific Insights use cases
  if (mri === SPAN_DURATION_MRI) {
    tags = {
      ...tags,
      data: tags.data.filter(tag => ALLOWED_SPAN_DURATION_TAGS.includes(tag.key)),
    };
  }

  return tags;
}
