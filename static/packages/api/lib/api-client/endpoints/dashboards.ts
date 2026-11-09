/**
 * Dashboard endpoints. Each wrapper validates the response with the schema
 * the host passes, so the host's schema decides the result type.
 */

import {
  apiPath,
  type ApiTarget,
  type ListPage,
  nextPageCursor,
  readJsonResponse,
  type ResponseSchema,
  validateResponse,
} from "@sentry/api/client";

export type ListDashboardsParams = {
  organizationSlug: string;
  /** Filters by title. */
  query?: string | null;
  sortBy?: "title" | "-title" | "dateCreated" | "-dateCreated";
  /** Page size. Default: 10. */
  limit?: number;
  /** Resumes from a previous call's `nextCursor`. */
  cursor?: string | null;
};

/** One page of the organization's dashboards. */
export async function listDashboards<T>(
  { core, origin }: ApiTarget,
  { organizationSlug, query, sortBy, limit = 10, cursor }: ListDashboardsParams,
  schema: ResponseSchema<T[]>,
): Promise<ListPage<T>> {
  const params = new URLSearchParams();
  params.set("per_page", String(limit));
  if (query) {
    params.set("query", query);
  }
  if (sortBy) {
    params.set("sort", sortBy);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  const response = await core.request(
    origin,
    `${apiPath`/organizations/${organizationSlug}/dashboards/`}?${params.toString()}`,
  );
  return {
    items: validateResponse(schema, await readJsonResponse(response)),
    nextCursor: nextPageCursor(response),
  };
}

export type GetDashboardParams = {
  organizationSlug: string;
  dashboardId: string;
};

/** One dashboard with its widgets. */
export async function getDashboard<T>(
  { core, origin }: ApiTarget,
  { organizationSlug, dashboardId }: GetDashboardParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const body = await core.requestJson(
    origin,
    apiPath`/organizations/${organizationSlug}/dashboards/${dashboardId}/`,
  );
  return validateResponse(schema, body);
}
