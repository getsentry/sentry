// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationFeedbackCategoriesResponse {
  categories: unknown;
  detail: unknown;
  numFeedbacksContext: unknown;
  success: unknown;
}

interface OrganizationFeedbackCategoriesQueryParams {
  project?: string;
}

type TQueryData = ApiResponse<OrganizationFeedbackCategoriesResponse>;
type TData = OrganizationFeedbackCategoriesResponse;

/**
 * @public
 * Gets categories of feedbacks for an organization.
 *
 *         Returns groups of labels, which correspond to categories, for feedbacks that can be filtered by:
 *         - A list of projects
 *         - The date range that they were first seen in (defaults to the last 7 days)
 *
 *         If the request is successful, the return format is:
 *         {
 *             "categories": [
 *                 {
 *                     "primaryLabel": str,
 *                     "associatedLabels": list[str],
 *                     "feedbackCount": int,
 *                 }
 *                 ...
 *             ],
 *             "success": True,
 *             "numFeedbacksContext": int,
 *         }
 *         It is returned as a list in the order of feedback count.
 *
 *         Returns 500 if the Seer endpoint fails.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization.
 *         :qparam int project: project IDs to filter by
 *         :qparam string statsPeriod: filter feedbacks by date range (e.g. "14d")
 *         :qparam string start: start date range (alternative to statsPeriod)
 *         :qparam string end: end date range (alternative to statsPeriod)
 *         :auth: required
 */
export function organizationFeedbackCategoriesOptions(
  organization: Organization,
  query?: OrganizationFeedbackCategoriesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/feedback-categories/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
