import {
  organizationTagsApiOptions,
  type FetchOrganizationTagsParams,
} from 'sentry/actionCreators/tags';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

/**
 * Queries the flags column of the errors dataset through the tags endpoint.
 */
export function organizationFeatureFlagsApiOptions({
  keepPreviousData = false,
  useCache = true,
  ...params
}: Omit<FetchOrganizationTagsParams, 'dataset' | 'useFlagsBackend'>) {
  return organizationTagsApiOptions({
    ...params,
    dataset: Dataset.ERRORS,
    useCache,
    useFlagsBackend: true,
    keepPreviousData,
  });
}
