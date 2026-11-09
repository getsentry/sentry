/**
 * Session replay endpoints. Each wrapper validates the response with the
 * schema the host passes, so the host's schema decides the result type.
 */

import {
  apiPath,
  type ApiTarget,
  applyTimeParams,
  nextPageCursor,
  readJsonResponse,
  type ResponseSchema,
  validateResponse,
  withQuery,
} from "@sentry/api/client";

/** The recording-segments endpoint caps `per_page` at 100. */
const REPLAY_SEGMENTS_PER_PAGE = 100;

export type SearchReplaysParams = {
  organizationSlug: string;
  query?: string;
  /** Page size. */
  limit?: number;
  /** Numeric project ID. */
  projectId?: string;
  sort?: string;
  environment?: string | string[];
  statsPeriod?: string;
  start?: string;
  end?: string;
  /** Fields to return. */
  fields?: string[];
};

/** The first page of the organization's replays, in the `{ data }` envelope. */
export async function searchReplays<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    query,
    limit,
    projectId,
    sort,
    environment,
    statsPeriod,
    start,
    end,
    fields,
  }: SearchReplaysParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const params = new URLSearchParams();
  if (query) {
    params.set("query", query);
  }
  if (limit !== undefined) {
    params.set("per_page", String(limit));
  }
  if (projectId) {
    params.append("project", projectId);
  }
  if (sort) {
    params.set("sort", sort);
  }
  if (environment) {
    const environments = Array.isArray(environment)
      ? environment
      : [environment];
    for (const value of environments) {
      params.append("environment", value);
    }
  }
  for (const field of fields ?? []) {
    params.append("field", field);
  }
  applyTimeParams(params, statsPeriod, start, end);
  const body = await core.requestJson(
    origin,
    withQuery(apiPath`/organizations/${organizationSlug}/replays/`, params),
  );
  return validateResponse(schema, body);
}

/** One replay, in the `{ data }` envelope. */
export async function getReplay<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    replayId,
  }: { organizationSlug: string; replayId: string },
  schema: ResponseSchema<T>,
): Promise<T> {
  const body = await core.requestJson(
    origin,
    apiPath`/organizations/${organizationSlug}/replays/${replayId}/`,
  );
  return validateResponse(schema, body);
}

export type IssueReplayIdsParams = {
  organizationSlug: string;
  issueId: string | number;
  dataSource: "discover" | "search_issues";
};

/**
 * The IDs of an issue's replays in the last 90 days, across all projects,
 * keyed by issue ID.
 */
export async function listIssueReplayIds<T>(
  { core, origin }: ApiTarget,
  { organizationSlug, issueId, dataSource }: IssueReplayIdsParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const params = new URLSearchParams();
  params.set("returnIds", "true");
  params.set("query", `issue.id:[${String(issueId)}]`);
  params.set("data_source", dataSource);
  params.set("statsPeriod", "90d");
  params.append("project", "-1");
  const body = await core.requestJson(
    origin,
    apiPath`/organizations/${organizationSlug}/replay-count/` +
      `?${params.toString()}`,
  );
  return validateResponse(schema, body);
}

export type ReplayRecordingSegmentsParams = {
  organizationSlug: string;
  projectSlugOrId: string;
  replayId: string;
  /** Most segments to visit. */
  maxSegments: number;
};

/**
 * Visit a replay's recording segments page by page, following the `Link`
 * cursor. Segments go to `onSegment` as each page arrives instead of being
 * collected, because full DOM snapshots make raw pages large.
 */
export async function visitReplayRecordingSegments<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    projectSlugOrId,
    replayId,
    maxSegments,
  }: ReplayRecordingSegmentsParams,
  pageSchema: ResponseSchema<T[]>,
  onSegment: (segment: T) => void,
): Promise<{ segmentsRead: number; truncated: boolean }> {
  let cursor: string | null = null;
  let segmentsRead = 0;

  do {
    const params = new URLSearchParams();
    params.set("per_page", String(REPLAY_SEGMENTS_PER_PAGE));
    if (cursor) {
      params.set("cursor", cursor);
    }
    const response = await core.request(
      origin,
      apiPath`/projects/${organizationSlug}/${projectSlugOrId}/replays/${replayId}/recording-segments/` +
        `?${params.toString()}`,
      { method: "GET" },
    );
    const page = validateResponse(pageSchema, await readJsonResponse(response));
    for (const segment of page) {
      if (segmentsRead >= maxSegments) {
        return { segmentsRead, truncated: true };
      }
      onSegment(segment);
      segmentsRead += 1;
    }
    cursor = nextPageCursor(response);
    // Only rows count toward `maxSegments`, so an empty page ends the walk
    // too; following its cursor could otherwise never stop.
    if (cursor && (segmentsRead >= maxSegments || page.length === 0)) {
      return { segmentsRead, truncated: true };
    }
  } while (cursor);

  return { segmentsRead, truncated: false };
}
