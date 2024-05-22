import {getHasTag} from 'sentry/components/events/searchBar';
import type {TagCollection} from 'sentry/types';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanIndexedField} from 'sentry/views/starfish/types';

const omitSupportedTags = [SpanIndexedField.SPAN_AI_PIPELINE_GROUP];

const getSpanFieldSupportedTags = () => {
  const tags: TagCollection = Object.fromEntries(
    Object.values(SpanIndexedField)
      .filter(v => !omitSupportedTags.includes(v))
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

const getDynamicSpanFieldsEndpoint = (orgSlug: string, selection): ApiQueryKey => [
  `/organizations/${orgSlug}/spans/fields/`,
  {
    query: {
      project: selection.projects,
      environment: selection.environments,
      statsPeriod: '1h', // Hard coded stats period to load recent tags fast
    },
  },
];

export function useSpanFieldSupportedTags(): TagCollection {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const staticTags = getSpanFieldSupportedTags();

  const dynamicTagQuery = useApiQuery<SpanFieldsResponse>(
    getDynamicSpanFieldsEndpoint(organization.slug, selection),
    {
      staleTime: 0,
      retry: false,
    }
  );

  if (dynamicTagQuery.isSuccess) {
    const dynamicTags: TagCollection = Object.fromEntries(
      dynamicTagQuery.data.map(entry => [entry.key, entry])
    );
    return {
      ...dynamicTags,
      ...staticTags,
    };
  }

  return staticTags;
}
