/**
 * Team endpoints within an organization. Each wrapper validates the response
 * with the schema the host passes, so the host's schema decides the result
 * type.
 */

import { listOrganizationTeams } from "@sentry/api";
import {
  apiPath,
  type ApiTarget,
  type ListPage,
  listPage,
  type ResponseSchema,
  validateResponse,
} from "@sentry/api/client";

export type ListTeamsParams = {
  organizationSlug: string;
  /** Filters by name or slug. */
  query?: string;
  /** Most teams to return. Default: 25. */
  limit?: number;
  /** Resumes from a previous call's `nextCursor`. */
  cursor?: string | null;
};

/** A page of the organization's teams. */
export async function listTeams<T>(
  { core, origin }: ApiTarget,
  params: ListTeamsParams,
  schema: ResponseSchema<T[]>,
): Promise<ListPage<T>> {
  const client = core.sdkClient(
    origin,
    apiPath`/organizations/${params.organizationSlug}/teams/`,
  );
  return await listPage(
    (perPage, cursor) =>
      listOrganizationTeams({
        client,
        path: { organization_id_or_slug: params.organizationSlug },
        query: { per_page: perPage, query: params.query, cursor },
        throwOnError: true,
      }),
    schema,
    params.limit ?? 25,
    params.cursor,
  );
}

export type CreateTeamParams = {
  organizationSlug: string;
  name: string;
};

/** Create a team in the organization. */
export async function createTeam<T>(
  { core, origin }: ApiTarget,
  { organizationSlug, name }: CreateTeamParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const body = await core.requestJson(
    origin,
    apiPath`/organizations/${organizationSlug}/teams/`,
    { method: "POST", body: JSON.stringify({ name }) },
  );
  return validateResponse(schema, body);
}
