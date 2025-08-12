import {
  useFetchOrganizationTags,
  type FetchOrganizationTagsParams,
} from 'sentry/actionCreators/tags';
import type {Tag} from 'sentry/types/group';
import type {UseApiQueryOptions} from 'sentry/utils/queryClient';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

/**
 * Queries `flags` column of errors dataset. Response format is the same as `useFetchOrganizationTags`. response.data: Tag[]
 */
export default function useFetchOrganizationFeatureFlags(
  {
    keepPreviousData = false,
    useCache = true,
    ...params
  }: Omit<FetchOrganizationTagsParams, 'dataset' | 'useFlagsBackend'>,
  options: Partial<UseApiQueryOptions<Tag[]>>
) {
  return useFetchOrganizationTags(
    {
      ...params,
      dataset: Dataset.ERRORS,
      useCache,
      useFlagsBackend: true,
      keepPreviousData,
    },
    options
  );
}
