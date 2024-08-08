import {useMemo} from 'react';

import {useFetchOrganizationTags} from 'sentry/actionCreators/tags';
import type {Organization, TagCollection} from 'sentry/types';
import {FieldKind} from 'sentry/utils/fields';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

type UseFetchIssuePlatformTagsParams = {
  org: Organization;
  projectIds: string[];
  enabled?: boolean;
  end?: string;
  keepPreviousData?: boolean;
  start?: string;
  statsPeriod?: string | null;
  useCache?: boolean;
};

// Fetches tags exclusively from the IssuePlatform (search_issues) dataset. Based on useFetchIssueTags.
export default function useFetchIssuePlatformTags({
  org,
  projectIds,
  keepPreviousData = false,
  useCache = true,
  enabled = true,
  ...statsPeriodParams
}: UseFetchIssuePlatformTagsParams): {
  isError: boolean;
  isLoading: boolean;
  tags: TagCollection;
} {
  const issuePlatformTagsQuery = useFetchOrganizationTags(
    {
      orgSlug: org.slug,
      projectIds: projectIds.map(String),
      dataset: Dataset.ISSUE_PLATFORM,
      useCache,
      enabled,
      keepPreviousData,
      ...statsPeriodParams,
    },
    {}
  );

  const tags: TagCollection = useMemo(() => {
    return (issuePlatformTagsQuery.data ?? []).reduce<TagCollection>((acc, tag) => {
      acc[tag.key] = {...tag, kind: FieldKind.TAG};
      return acc;
    }, {});
  }, [issuePlatformTagsQuery]);

  return {
    tags: tags,
    isLoading: issuePlatformTagsQuery.isLoading,
    isError: issuePlatformTagsQuery.isError,
  };
}
