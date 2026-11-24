/**
 * Organization and current-user endpoints. Each wrapper validates the
 * response with the schema the host passes, so the host's schema decides the
 * result type. Hosts pick the origin: user identity and the organization
 * list live on the control host, an organization on its region.
 */

import { listOrganizations as listOrganizationsOperation } from "@sentry/api";
import {
  apiPath,
  type ApiTarget,
  type ListPage,
  listPage,
  type ResponseSchema,
  validateResponse,
  withQuery,
} from "@sentry/api/client";

/** The user the request's credential belongs to (`GET /auth/`). */
export async function getAuthenticatedUser<T>(
  { core, origin }: ApiTarget,
  schema: ResponseSchema<T>,
): Promise<T> {
  return validateResponse(schema, await core.requestJson(origin, "/auth/"));
}

export type ListOrganizationsParams = {
  /** Filters by name or slug. */
  query?: string;
  /** Most organizations to return. Default: 25. */
  limit?: number;
  /** Resumes from a previous call's `nextCursor`. */
  cursor?: string | null;
};

/** A page of the organizations the credential can access. */
export async function listOrganizations<T>(
  { core, origin }: ApiTarget,
  params: ListOrganizationsParams,
  schema: ResponseSchema<T[]>,
): Promise<ListPage<T>> {
  const client = core.sdkClient(origin, "/organizations/");
  return await listPage(
    (perPage, cursor) =>
      listOrganizationsOperation({
        client,
        query: { per_page: perPage, query: params.query, cursor },
        throwOnError: true,
      }),
    schema,
    params.limit ?? 25,
    params.cursor,
  );
}

export type GetOrganizationParams = {
  organizationSlug: string;
  /** Include `features`, which Sentry omits otherwise. */
  includeFeatureFlags?: boolean;
  /** Set false to leave out projects and teams; Sentry defaults to true. */
  detailed?: boolean;
};

/** One organization by slug. */
export async function getOrganization<T>(
  { core, origin }: ApiTarget,
  params: GetOrganizationParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const query = new URLSearchParams();
  if (params.includeFeatureFlags) {
    query.set("include_feature_flags", "1");
  }
  if (params.detailed === false) {
    query.set("detailed", "0");
  }
  const body = await core.requestJson(
    origin,
    withQuery(apiPath`/organizations/${params.organizationSlug}/`, query),
  );
  return validateResponse(schema, body);
}

export type UpdateAgenticOnboardingStatusParams = {
  organizationSlug: string;
  /** The status report, sent as the JSON body. */
  update: object;
};

/** Report progress of an agent-driven onboarding run. */
export async function updateAgenticOnboardingStatus<T>(
  { core, origin }: ApiTarget,
  { organizationSlug, update }: UpdateAgenticOnboardingStatusParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const body = await core.requestJson(
    origin,
    apiPath`/organizations/${organizationSlug}/onboarding/agent/status/`,
    { method: "POST", body: JSON.stringify(update) },
  );
  return validateResponse(schema, body);
}
