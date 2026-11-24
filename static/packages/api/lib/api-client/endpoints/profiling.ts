/**
 * Profiling endpoints. Each wrapper validates the response with the schema
 * the host passes, so the host's schema decides the result type.
 */

import {
  apiPath,
  type ApiTarget,
  type ResponseSchema,
  validateResponse,
} from "@sentry/api/client";

export type GetFlamegraphParams = {
  organizationSlug: string;
  projectId: string | number;
  /** Matched exactly; quotes and backslashes are escaped. */
  transactionName: string;
  /** Default: `7d`. */
  statsPeriod?: string;
};

/** The aggregated flamegraph of a transaction's profiles. */
export async function getFlamegraph<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    projectId,
    transactionName,
    statsPeriod = "7d",
  }: GetFlamegraphParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const query = new URLSearchParams();
  query.set("project", projectId.toString());
  // Escape backslashes first, then quotes.
  const escapedTransaction = transactionName
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  query.set(
    "query",
    `event.type:transaction transaction:"${escapedTransaction}"`,
  );
  query.set("statsPeriod", statsPeriod);
  const body = await core.requestJson(
    origin,
    apiPath`/organizations/${organizationSlug}/profiling/flamegraph/` +
      `?${query.toString()}`,
  );
  return validateResponse(schema, body);
}

/** One transaction profile. */
export async function getTransactionProfile<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    projectSlugOrId,
    profileId,
  }: {
    organizationSlug: string;
    projectSlugOrId: string | number;
    profileId: string;
  },
  schema: ResponseSchema<T>,
): Promise<T> {
  const body = await core.requestJson(
    origin,
    apiPath`/projects/${organizationSlug}/${projectSlugOrId}/profiling/profiles/${profileId}/`,
  );
  return validateResponse(schema, body);
}

export type GetProfileChunksParams = {
  organizationSlug: string;
  profilerId: string;
  projectId: string | number;
  /** ISO timestamp. */
  start: string;
  /** ISO timestamp. */
  end: string;
};

/** The continuous profile chunks of a profiler in a time range. */
export async function getProfileChunks<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    profilerId,
    projectId,
    start,
    end,
  }: GetProfileChunksParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const query = new URLSearchParams();
  query.set("profiler_id", profilerId);
  query.set("project", projectId.toString());
  query.set("start", start);
  query.set("end", end);
  const body = await core.requestJson(
    origin,
    apiPath`/organizations/${organizationSlug}/profiling/chunks/` +
      `?${query.toString()}`,
  );
  return validateResponse(schema, body);
}
