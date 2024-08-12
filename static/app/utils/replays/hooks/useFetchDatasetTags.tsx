import {useMemo} from 'react';

import {useFetchOrganizationTags} from 'sentry/actionCreators/tags';
import type {Organization, TagCollection} from 'sentry/types';
import {FieldKind} from 'sentry/utils/fields';
import type {Dataset} from 'sentry/views/alerts/rules/metric/types';

type UseFetchDatasetTagsParams = {
  dataset: Dataset;
  org: Organization;
  projectIds: string[];
  enabled?: boolean;
  end?: string;
  keepPreviousData?: boolean;
  start?: string;
  statsPeriod?: string | null;
  useCache?: boolean;
};

/**
 * Fetches tags from exclusively one dataset. Based on useFetchIssueTags.
 */
export default function useFetchDatasetTags({
  org,
  projectIds,
  dataset,
  keepPreviousData = false,
  useCache = true,
  enabled = true,
  ...statsPeriodParams
}: UseFetchDatasetTagsParams): {
  isError: boolean;
  isLoading: boolean;
  tags: TagCollection;
} {
  const query = useFetchOrganizationTags(
    {
      orgSlug: org.slug,
      projectIds: projectIds.map(String),
      dataset,
      useCache,
      enabled,
      keepPreviousData,
      ...statsPeriodParams,
    },
    {}
  );

  const tags: TagCollection = useMemo(() => {
    return (query.data ?? []).reduce<TagCollection>((acc, tag) => {
      acc[tag.key] = {...tag, kind: FieldKind.TAG};
      return acc;
    }, {});
  }, [query]);

  return {
    tags: tags,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
