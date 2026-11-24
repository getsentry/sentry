/**
 * Project endpoints: listing, reading, creating, and updating projects, and
 * the teams assigned to a project. Each wrapper validates the response with
 * the schema the host passes, so the host's schema decides the result type.
 */

import { listOrganizationProjects } from "@sentry/api";
import {
  apiPath,
  type ApiTarget,
  fetchAllPages,
  type ListPage,
  listPage,
  MAX_LIST_PAGES,
  nextPageCursor,
  readJsonResponse,
  type ResponseSchema,
  validateResponse,
  withQuery,
} from "@sentry/api/client";

export type ListProjectsParams = {
  organizationSlug: string;
  /** Filters by name or slug. */
  query?: string;
  /** Most projects to return. Default: 25. */
  limit?: number;
  /** Resumes from a previous call's `nextCursor`. */
  cursor?: string | null;
};

/** A page of the organization's projects. */
export async function listProjects<T>(
  { core, origin }: ApiTarget,
  params: ListProjectsParams,
  schema: ResponseSchema<T[]>,
): Promise<ListPage<T>> {
  const client = core.sdkClient(
    origin,
    apiPath`/organizations/${params.organizationSlug}/projects/`,
  );
  return await listPage(
    (perPage, cursor) =>
      listOrganizationProjects({
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

export type GetProjectParams = {
  organizationSlug: string;
  projectSlugOrId: string;
  /** Return only the organization's ID and slug instead of all of it. */
  collapse?: "organization";
};

/** One project by slug or ID. */
export async function getProject<T>(
  { core, origin }: ApiTarget,
  { organizationSlug, projectSlugOrId, collapse }: GetProjectParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const query = new URLSearchParams();
  if (collapse) {
    query.set("collapse", collapse);
  }
  const body = await core.requestJson(
    origin,
    withQuery(
      apiPath`/projects/${organizationSlug}/${projectSlugOrId}/`,
      query,
    ),
  );
  return validateResponse(schema, body);
}

export type CreateProjectParams = {
  organizationSlug: string;
  /** The team that owns the new project. */
  teamSlug: string;
  name: string;
  slug?: string | null;
  platform?: string | null;
};

/** Create a project owned by a team. Empty `slug` and `platform` are left out. */
export async function createProject<T>(
  { core, origin }: ApiTarget,
  { organizationSlug, teamSlug, name, slug, platform }: CreateProjectParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const data: { name: string; slug?: string; platform?: string } = { name };
  if (slug) {
    data.slug = slug;
  }
  if (platform) {
    data.platform = platform;
  }
  const body = await core.requestJson(
    origin,
    apiPath`/teams/${organizationSlug}/${teamSlug}/projects/`,
    { method: "POST", body: JSON.stringify(data) },
  );
  return validateResponse(schema, body);
}

export type UpdateProjectParams = {
  organizationSlug: string;
  projectSlug: string;
  name?: string | null;
  slug?: string | null;
  platform?: string | null;
};

/** Update a project. Only non-empty fields are sent. */
export async function updateProject<T>(
  { core, origin }: ApiTarget,
  { organizationSlug, projectSlug, name, slug, platform }: UpdateProjectParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const data: { name?: string; slug?: string; platform?: string } = {};
  if (name) data.name = name;
  if (slug) data.slug = slug;
  if (platform) data.platform = platform;
  const body = await core.requestJson(
    origin,
    apiPath`/projects/${organizationSlug}/${projectSlug}/`,
    { method: "PUT", body: JSON.stringify(data) },
  );
  return validateResponse(schema, body);
}

export type ProjectTeamParams = {
  organizationSlug: string;
  projectSlug: string;
};

/**
 * Every team assigned to a project, across all pages.
 *
 * @throws {Error} When a cursor repeats or the walk passes
 *   {@link MAX_LIST_PAGES}
 */
export async function listProjectTeams<T>(
  { core, origin }: ApiTarget,
  { organizationSlug, projectSlug }: ProjectTeamParams,
  schema: ResponseSchema<T[]>,
): Promise<T[]> {
  const result = await fetchAllPages(
    async (cursor) => {
      const query = new URLSearchParams();
      query.set("per_page", "100");
      if (cursor) {
        query.set("cursor", cursor);
      }
      const response = await core.request(
        origin,
        `${apiPath`/projects/${organizationSlug}/${projectSlug}/teams/`}?${query.toString()}`,
      );
      return {
        data: await readJsonResponse(response),
        nextCursor: nextPageCursor(response) ?? undefined,
      };
    },
    (data) => validateResponse(schema, data),
    MAX_LIST_PAGES,
  );
  if (!result.ok) {
    // `parse` throws for an invalid page, so only the cursor checks remain.
    throw new Error(
      result.reason === "page-cap"
        ? "API pagination exceeded its page limit"
        : "API returned a repeated pagination cursor",
    );
  }
  return result.items;
}

/** Assign a team to a project. */
export async function addProjectTeam(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    projectSlug,
    teamSlug,
  }: ProjectTeamParams & {
    teamSlug: string;
  },
): Promise<void> {
  await core.request(
    origin,
    apiPath`/projects/${organizationSlug}/${projectSlug}/teams/${teamSlug}/`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

/** Remove a team from a project. */
export async function removeProjectTeam(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    projectSlug,
    teamSlug,
  }: ProjectTeamParams & {
    teamSlug: string;
  },
): Promise<void> {
  await core.request(
    origin,
    apiPath`/projects/${organizationSlug}/${projectSlug}/teams/${teamSlug}/`,
    { method: "DELETE" },
  );
}
