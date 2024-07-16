import {useFetchOrganizationTags} from 'sentry/actionCreators/tags';
import type {TagCollection} from 'sentry/types';
import {FieldKind} from 'sentry/utils/fields';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

type UseFetchIssueTagsParams = {
  orgSlug: string;
  projectIds: string[];
  enabled?: boolean;
  end?: string;
  keepPreviousData?: boolean;
  start?: string;
  statsPeriod?: string;
  useCache?: boolean;
};

export const useFetchIssueOrganizationTags = ({
  orgSlug,
  projectIds,
  keepPreviousData = false,
  useCache = true,
  enabled = true,
  ...statsPeriodParams
}: UseFetchIssueTagsParams) => {
  const eventsTagsQuery = useFetchOrganizationTags(
    {
      orgSlug,
      projectIds,
      dataset: Dataset.ERRORS,
      useCache,
      enabled,
      keepPreviousData,
      ...statsPeriodParams,
    },
    {}
  );

  const issuePlatformTagsQuery = useFetchOrganizationTags(
    {
      orgSlug,
      projectIds,
      dataset: 'search_issues',
      useCache,
      enabled,
      keepPreviousData,
      ...statsPeriodParams,
    },
    {}
  );

  const eventsTags = [
    ...(eventsTagsQuery.data || []),
    ...(issuePlatformTagsQuery.data || []),
  ];

  const eventsTagCollection: TagCollection = eventsTags.reduce<TagCollection>(
    (acc, tag) => {
      acc[tag.key] = {...tag, predefined: false, kind: FieldKind.TAG};
      return acc;
    },
    {}
  );

  return {
    tags: eventsTagCollection,
    isLoading: eventsTagsQuery.isLoading || issuePlatformTagsQuery.isLoading,
    isError: eventsTagsQuery.isError || issuePlatformTagsQuery.isError,
  };
};
