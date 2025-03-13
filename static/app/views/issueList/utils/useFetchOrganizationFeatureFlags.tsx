import {useFetchOrganizationTags} from 'sentry/actionCreators/tags';
import type {Tag} from 'sentry/types/group';
import type {UseApiQueryOptions} from 'sentry/utils/queryClient';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

export default function useFetchOrganizationFeatureFlags(
  {
    orgSlug,
    projectIds,
    enabled,
    keepPreviousData = false,
    useCache = true,
    ...statsPeriodParams
  }: {
    orgSlug: string;
    projectIds: string[];
    enabled?: boolean;
    end?: string;
    keepPreviousData?: boolean;
    start?: string;
    statsPeriod?: string | null;
    useCache?: boolean;
  },
  options: Partial<UseApiQueryOptions<Tag[]>>
) {
  return useFetchOrganizationTags(
    {
      orgSlug,
      projectIds,
      dataset: Dataset.ERRORS,
      useCache,
      useFlagsBackend: true, // Queries `flags` column instead of tags. Response format is the same as `useFetchOrganizationTags`.
      enabled,
      keepPreviousData,
      ...statsPeriodParams,
    },
    options
  );
}
