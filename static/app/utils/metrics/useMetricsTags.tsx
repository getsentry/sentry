import type {PageFilters} from 'sentry/types/core';
import type {MRI} from 'sentry/types/metrics';
import type {Organization} from 'sentry/types/organization';
import {getUseCaseFromMRI, parseMRI} from 'sentry/utils/metrics/mri';
import type {MetricTag} from 'sentry/utils/metrics/types';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {getMetaDateTimeParams} from './index';

const SPAN_DURATION_MRI = 'd:spans/duration@millisecond';
const ALLOWED_SPAN_DURATION_TAGS = [
  'span.category',
  'span.description',
  'environment',
  'project',
  'span.action',
  'span.domain',
  'span.op',
];

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
  const {getTags} = useVirtualMetricsContext();
  const parsedMRI = parseMRI(mri);
  const useCase = parsedMRI?.useCase ?? 'custom';
  const isVirtualMetric = parsedMRI?.type === 'v';

  const tagsQuery = useApiQuery<MetricTag[]>(
    getMetricsTagsQueryKey(organization, mri, pageFilters),
    {
      enabled: !!mri && !isVirtualMetric,
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

  if (isVirtualMetric && mri) {
    return {
      isLoading: false,
      data: getTags(mri),
    };
  }

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
