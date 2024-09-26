import {useMemo} from 'react';

import {getHasTag} from 'sentry/components/events/searchBar';
import type {PageFilters} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryResult,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanIndexedField, SpanMetricsField} from 'sentry/views/insights/types';

const DATASET_TO_FIELDS = {
  [DiscoverDatasets.SPANS_INDEXED]: SpanIndexedField,
  [DiscoverDatasets.SPANS_METRICS]: SpanMetricsField,
};

const getSpanFieldSupportedTags = (
  excludedTags,
  dataset: DiscoverDatasets.SPANS_INDEXED | DiscoverDatasets.SPANS_METRICS
) => {
  const fields = DATASET_TO_FIELDS[dataset];

  const tags: TagCollection = Object.fromEntries(
    Object.values(fields)
      .filter(v => !excludedTags.includes(v))
      .map(v => [v, {key: v, name: v}])
  );
  tags.has = getHasTag(tags);
  return tags;
};

interface SpanFieldEntry {
  key: string;
  name: string;
}
type SpanFieldsResponse = SpanFieldEntry[];

const getDynamicSpanFieldsEndpoint = (
  orgSlug: string,
  projects: PageFilters['projects'],
  environments: PageFilters['environments']
): ApiQueryKey => [
  `/organizations/${orgSlug}/spans/fields/`,
  {
    query: {
      project: projects,
      environment: environments,
      statsPeriod: '1h', // Hard coded stats period to load recent tags fast
    },
  },
];

export function useSpanMetricsFieldSupportedTags(options?: {excludedTags?: string[]}) {
  const {excludedTags = []} = options || {};

  // we do not yet support span field search by SPAN_AI_PIPELINE_GROUP
  return getSpanFieldSupportedTags(
    [SpanIndexedField.SPAN_AI_PIPELINE_GROUP, ...excludedTags],
    DiscoverDatasets.SPANS_METRICS
  );
}

export function useSpanFieldCustomTags(options?: {
  projects?: PageFilters['projects'];
}): UseApiQueryResult<TagCollection, RequestError> {
  const {projects} = options || {};
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const {data, ...rest} = useApiQuery<SpanFieldsResponse>(
    getDynamicSpanFieldsEndpoint(
      organization.slug,
      projects ?? selection.projects,
      selection.environments
    ),
    {
      staleTime: 0,
      retry: false,
    }
  );

  const tags: TagCollection = useMemo(() => {
    if (!data) {
      return {};
    }
    return Object.fromEntries(
      data.map(entry => [entry.key, {key: entry.key, name: entry.name}])
    );
  }, [data]);

  // XXX: We need to cast here because unwrapping `data` breaks the type returned by
  //      useQuery above. The react-query library's UseQueryResult is a union type and
  //      too complex to recreate here so casting the entire object is more appropriate.
  return {...rest, data: tags} as UseApiQueryResult<TagCollection, RequestError>;
}

export function useSpanFieldSupportedTags(options?: {
  excludedTags?: string[];
  projects?: PageFilters['projects'];
}): UseApiQueryResult<TagCollection, RequestError> {
  const {excludedTags = [], projects} = options || {};
  // we do not yet support span field search by SPAN_AI_PIPELINE_GROUP and SPAN_CATEGORY should not be surfaced to users
  const staticTags: TagCollection = getSpanFieldSupportedTags(
    [
      SpanIndexedField.SPAN_AI_PIPELINE_GROUP,
      SpanIndexedField.SPAN_CATEGORY,
      SpanIndexedField.SPAN_GROUP,
      ...excludedTags,
    ],
    DiscoverDatasets.SPANS_INDEXED
  );

  const {data: customTags, ...rest} = useSpanFieldCustomTags({projects});

  const tags: TagCollection = useMemo(() => {
    return {
      ...customTags,
      ...staticTags,
    };
  }, [customTags, staticTags]);

  // XXX: We need to cast here because unwrapping `data` breaks the type returned by
  //      useQuery above. The react-query library's UseQueryResult is a union type and
  //      too complex to recreate here so casting the entire object is more appropriate.
  return {...rest, data: tags} as UseApiQueryResult<TagCollection, RequestError>;
}
