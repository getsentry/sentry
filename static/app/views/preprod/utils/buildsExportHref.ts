import * as qs from 'query-string';

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

  return `/api/0/organizations/${organizationSlug}/builds-export/?${qs.stringify(exportParams)}`;
}
