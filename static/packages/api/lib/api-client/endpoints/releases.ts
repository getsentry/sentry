/**
 * Release endpoints: releases, their deploys and commits, and an event's
 * suspect committers. With a project, release reads go to the project's
 * endpoints, otherwise to the organization's. Each wrapper validates the
 * response with the schema the host passes, so the host's schema decides the
 * result type.
 */

import {
  apiPath,
  type ApiTarget,
  type ResponseSchema,
  validateResponse,
  withQuery,
} from "@sentry/api/client";

export type ListReleasesParams = {
  organizationSlug: string;
  projectSlug?: string;
  /** Filters by version. */
  query?: string;
  /** Page size. */
  limit?: number;
};

/** The first page of releases for the organization or one project. */
export async function listReleases<T>(
  { core, origin }: ApiTarget,
  { organizationSlug, projectSlug, query, limit }: ListReleasesParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const params = new URLSearchParams();
  if (query) {
    params.set("query", query);
  }
  if (limit !== undefined) {
    params.set("per_page", String(limit));
  }
  const path = projectSlug
    ? apiPath`/projects/${organizationSlug}/${projectSlug}/releases/`
    : apiPath`/organizations/${organizationSlug}/releases/`;
  const body = await core.requestJson(origin, withQuery(path, params));
  return validateResponse(schema, body);
}

export type ReleaseParams = {
  organizationSlug: string;
  releaseVersion: string;
  projectSlugOrId?: string;
};

/** One release, optionally with its health data. */
export async function getRelease<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    releaseVersion,
    projectSlugOrId,
    includeHealth,
  }: ReleaseParams & { includeHealth?: boolean },
  schema: ResponseSchema<T>,
): Promise<T> {
  const params = new URLSearchParams();
  if (includeHealth) {
    params.set("health", "1");
  }
  const path = projectSlugOrId
    ? apiPath`/projects/${organizationSlug}/${projectSlugOrId}/releases/${releaseVersion}/`
    : apiPath`/organizations/${organizationSlug}/releases/${releaseVersion}/`;
  const body = await core.requestJson(origin, withQuery(path, params));
  return validateResponse(schema, body);
}

/**
 * The first page of a release's deploys. A project narrows them, by ID when
 * it is numeric and by slug otherwise.
 */
export async function listReleaseDeploys<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    releaseVersion,
    projectSlugOrId,
    limit,
  }: ReleaseParams & { limit?: number },
  schema: ResponseSchema<T>,
): Promise<T> {
  const params = new URLSearchParams();
  if (projectSlugOrId) {
    params.set(
      /^\d+$/.test(projectSlugOrId) ? "project" : "projectSlug",
      projectSlugOrId,
    );
  }
  if (limit !== undefined) {
    params.set("per_page", String(limit));
  }
  const path = apiPath`/organizations/${organizationSlug}/releases/${releaseVersion}/deploys/`;
  const body = await core.requestJson(origin, withQuery(path, params));
  return validateResponse(schema, body);
}

/** The first page of a release's commits. */
export async function listReleaseCommits<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    releaseVersion,
    projectSlugOrId,
    limit,
  }: ReleaseParams & { limit?: number },
  schema: ResponseSchema<T>,
): Promise<T> {
  const params = new URLSearchParams();
  if (limit !== undefined) {
    params.set("per_page", String(limit));
  }
  const path = projectSlugOrId
    ? apiPath`/projects/${organizationSlug}/${projectSlugOrId}/releases/${releaseVersion}/commits/`
    : apiPath`/organizations/${organizationSlug}/releases/${releaseVersion}/commits/`;
  const body = await core.requestJson(origin, withQuery(path, params));
  return validateResponse(schema, body);
}

export type GetEventCommittersParams = {
  organizationSlug: string;
  projectSlug: string;
  eventId: string;
};

/** The suspect commits of an event's issue, grouped by committer. */
export async function getEventCommitters<T>(
  { core, origin }: ApiTarget,
  { organizationSlug, projectSlug, eventId }: GetEventCommittersParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const body = await core.requestJson(
    origin,
    apiPath`/projects/${organizationSlug}/${projectSlug}/events/${eventId}/committers/`,
  );
  return validateResponse(schema, body);
}
