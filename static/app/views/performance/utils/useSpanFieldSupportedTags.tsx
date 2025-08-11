import {useMemo} from 'react';

import {getHasTag} from 'sentry/components/events/searchBar';
import type {PageFilters} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanFields} from 'sentry/views/insights/types';

function useSpanFieldBaseTags(excludedTags: string[]) {
  const builtinTags = useMemo(() => {
    const fields = SpanFields;

    const tags: TagCollection = Object.fromEntries(
      Object.values(fields)
        .filter(v => !excludedTags.includes(v))
        .map(v => [v, {key: v, name: v}])
    );

    tags.has = getHasTag(tags);

    return tags;
  }, [excludedTags]);

  return builtinTags;
}

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

export function useSpanFieldCustomTags(options?: {
  enabled?: boolean;
  projects?: PageFilters['projects'];
}) {
  const {enabled, projects} = options || {};
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
      enabled,
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

  return {...rest, data: tags};
}

function useSpanFieldStaticTags(options?: {excludedTags?: string[]}) {
  const {excludedTags = []} = options || {};
  // we do not yet support span field search by SPAN_AI_PIPELINE_GROUP and SPAN_CATEGORY should not be surfaced to users
  const staticTags: TagCollection = useSpanFieldBaseTags([
    SpanFields.SPAN_AI_PIPELINE_GROUP,
    SpanFields.SPAN_CATEGORY,
    SpanFields.SPAN_GROUP,
    ...excludedTags,
  ]);

  return staticTags;
}

export function useSpanFieldSupportedTags(options?: {
  excludedTags?: string[];
  projects?: PageFilters['projects'];
}) {
  const {excludedTags = [], projects} = options || {};
  // we do not yet support span field search by SPAN_AI_PIPELINE_GROUP and SPAN_CATEGORY should not be surfaced to users
  const staticTags: TagCollection = useSpanFieldStaticTags({
    excludedTags,
  });

  const {data: customTags, ...rest} = useSpanFieldCustomTags({projects});

  const tags: TagCollection = useMemo(() => {
    return {
      ...customTags,
      ...staticTags,
    };
  }, [customTags, staticTags]);

  return {...rest, data: tags};
}
