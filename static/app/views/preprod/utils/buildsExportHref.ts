import * as qs from 'query-string';

import {resolveHostname} from 'sentry/utils/api/resolveHostname';

/**
 * Build the CSV export URL from the builds-list query params.
 */
export function getBuildsExportHref(
  organizationSlug: string,
  queryParams: Record<string, unknown>
): string {
  const exportParams = {...queryParams};
  // This endpoint doesn't paginate
  delete exportParams.per_page;
  delete exportParams.cursor;

  return resolveHostname(
    `/api/0/organizations/${organizationSlug}/builds-export/?${qs.stringify(exportParams)}`
  );
}
