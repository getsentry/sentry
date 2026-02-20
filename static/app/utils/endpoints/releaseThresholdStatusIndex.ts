// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ReleaseThresholdStatusIndexResponse {
  // No response keys detected — fill in manually
}

interface ReleaseThresholdStatusIndexQueryParams {
  /** The inclusive end of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds. Use along wi */
  end: string;
  /** The start of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds. Use along with `end` */
  start: string;
  /** A list of environment names to filter your results by. */
  environment?: string[];
  /** A list of project slugs to filter your results by. */
  projectSlug?: string[];
  /** A list of release versions to filter your results by. */
  release?: string[];
}

type TQueryData = ApiResponse<ReleaseThresholdStatusIndexResponse>;
type TData = ReleaseThresholdStatusIndexResponse;

/**
 * @public
 * **`[WARNING]`**: This API is an experimental Alpha feature and is subject to change!
 *
 *         List all derived statuses of releases that fall within the provided start/end datetimes.
 *
 *         Constructs a response key'd off \{`release_version`\}-\{`project_slug`\} that lists thresholds with their status for *specified* projects.
 *         Each returned enriched threshold will contain the full serialized `release_threshold` instance as well as it's derived health statuses.
 */
export function releaseThresholdStatusIndexOptions(
  organization: Organization,
  query?: ReleaseThresholdStatusIndexQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/release-threshold-statuses/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
