/**
 * Trace endpoints. Each wrapper validates the response with the schema the
 * host passes, so the host's schema decides the result type.
 */

import {
  apiPath,
  type ApiTarget,
  type ResponseSchema,
  validateResponse,
} from "@sentry/api/client";

export type TraceParams = {
  organizationSlug: string;
  /** 32-character hex trace ID. */
  traceId: string;
  /** Default: `14d`. */
  statsPeriod?: string;
};

/** Span, error, and operation counts for a trace. */
export async function getTraceMeta<T>(
  { core, origin }: ApiTarget,
  { organizationSlug, traceId, statsPeriod = "14d" }: TraceParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const query = new URLSearchParams({ statsPeriod });
  const body = await core.requestJson(
    origin,
    apiPath`/organizations/${organizationSlug}/trace-meta/${traceId}/` +
      `?${query.toString()}`,
  );
  return validateResponse(schema, body);
}

/**
 * The trace's span tree. `limit` and `project` are the endpoint's declared
 * parameters; the server currently ignores `project` and paginates
 * internally, but they are still sent.
 */
export async function getTrace<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    traceId,
    limit = 1000,
    project = "-1",
    statsPeriod = "14d",
  }: TraceParams & {
    /** Span-count hint. Default: 1000. */
    limit?: number;
    /** Project filter hint. Default: `-1` (all projects). */
    project?: string;
  },
  schema: ResponseSchema<T>,
): Promise<T> {
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  query.set("project", project);
  query.set("statsPeriod", statsPeriod);
  const body = await core.requestJson(
    origin,
    apiPath`/organizations/${organizationSlug}/trace/${traceId}/` +
      `?${query.toString()}`,
  );
  return validateResponse(schema, body);
}
