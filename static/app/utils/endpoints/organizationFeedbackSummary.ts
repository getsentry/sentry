// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationFeedbackSummaryResponse {
  detail: unknown;
  numFeedbacksUsed: unknown;
  success: unknown;
  summary: unknown;
}

interface OrganizationFeedbackSummaryQueryParams {
  project?: string;
}

type TQueryData = ApiResponse<OrganizationFeedbackSummaryResponse>;
type TData = OrganizationFeedbackSummaryResponse;

/**
 * @public
 * Get the summary of the user feedbacks of an organization
 *
 *         Returns the summary of the user feedbacks. The user feedbacks can be filtered by:
 *         - A list of projects
 *         - The date range that they were first seen in (defaults to the last 7 days)
 *
 *         Returns 500 Response if the Seer endpoint fails.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization.
 *         :qparam int project: project IDs to filter by
 *         :qparam string statsPeriod: filter feedbacks by date range (e.g. "14d")
 *         :qparam string start: start date range (alternative to statsPeriod)
 *         :qparam string end: end date range (alternative to statsPeriod)
 *         :auth: required
 */
export function organizationFeedbackSummaryOptions(
  organization: Organization,
  query?: OrganizationFeedbackSummaryQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/feedback-summary/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
