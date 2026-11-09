import {
  useFetchOrganizationTags,
  type FetchOrganizationTagsParams,
} from 'sentry/actionCreators/tags';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

/**
 * Queries `flags` column of errors dataset. Response format is the same as `useFetchOrganizationTags`. response.data: Tag[]
 */
export function useFetchOrganizationFeatureFlags(
  {
    keepPreviousData = false,
    useCache = true,
    ...params
  }: Omit<FetchOrganizationTagsParams, 'dataset' | 'useFlagsBackend'>,
  options: Parameters<typeof useFetchOrganizationTags>[1]
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
