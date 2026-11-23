/**
 * Uptime monitor endpoints. Each wrapper validates the response with the
 * schema the host passes, so the host's schema decides the result type.
 */

import {
  apiPath,
  type ApiTarget,
  applyTimeParams,
  defaultStatsPeriod,
  parseStatsPeriod,
  type ResponseSchema,
  validateResponse,
  withQuery,
} from "@sentry/api/client";

export type ListUptimeMonitorsParams = {
  organizationSlug: string;
  /** Numeric project ID; the endpoint filters by ID, not slug. */
  projectId?: string;
  environment?: string;
  owner?: string;
  query?: string;
  /** Page size. */
  limit?: number;
};

/** The first page of the organization's uptime monitors. */
export async function listUptimeMonitors<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    projectId,
    environment,
    owner,
    query,
    limit,
  }: ListUptimeMonitorsParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const params = new URLSearchParams();
  if (projectId) {
    params.append("project", projectId);
  }
  if (environment) {
    params.append("environment", environment);
  }
  if (owner) {
    params.append("owner", owner);
  }
  if (query) {
    params.set("query", query);
  }
  if (limit !== undefined) {
    params.set("per_page", String(limit));
  }
  const body = await core.requestJson(
    origin,
    withQuery(apiPath`/organizations/${organizationSlug}/uptime/`, params),
  );
  return validateResponse(schema, body);
}

export type UptimeMonitorParams = {
  organizationSlug: string;
  projectSlug: string;
  uptimeMonitorId: string;
};

function uptimeMonitorPath({
  organizationSlug,
  projectSlug,
  uptimeMonitorId,
}: UptimeMonitorParams): string {
  return apiPath`/projects/${organizationSlug}/${projectSlug}/uptime/${uptimeMonitorId}/`;
}

/** One uptime monitor. */
export async function getUptimeMonitor<T>(
  { core, origin }: ApiTarget,
  params: UptimeMonitorParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const body = await core.requestJson(origin, uptimeMonitorPath(params));
  return validateResponse(schema, body);
}

/** The first page of a monitor's checks in a time range, 24 hours by default. */
export async function listUptimeMonitorChecks<T>(
  { core, origin }: ApiTarget,
  params: UptimeMonitorParams & {
    statsPeriod?: string;
    start?: string;
    end?: string;
    limit?: number;
  },
  schema: ResponseSchema<T>,
): Promise<T> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) {
    query.set("per_page", String(params.limit));
  }
  const statsPeriod = defaultStatsPeriod(params);
  if (statsPeriod) {
    parseStatsPeriod(statsPeriod);
  }
  applyTimeParams(query, statsPeriod, params.start, params.end);
  const body = await core.requestJson(
    origin,
    withQuery(`${uptimeMonitorPath(params)}checks/`, query),
  );
  return validateResponse(schema, body);
}

/** The writable fields of an uptime monitor, in the order they are sent. */
export type UptimeMonitorFields = {
  name?: string;
  url?: string;
  intervalSeconds?: number;
  timeoutMs?: number;
  method?: string;
  headers?: Array<[string, string]>;
  body?: string | null;
  assertion?: unknown;
  status?: "active" | "disabled";
  owner?: string | null;
  environment?: string | null;
  traceSampling?: boolean;
  responseCaptureEnabled?: boolean;
  recoveryThreshold?: number;
  downtimeThreshold?: number;
};

const UPTIME_MONITOR_FIELDS = [
  "name",
  "url",
  "intervalSeconds",
  "timeoutMs",
  "method",
  "headers",
  "body",
  "assertion",
  "status",
  "owner",
  "environment",
  "traceSampling",
  "responseCaptureEnabled",
  "recoveryThreshold",
  "downtimeThreshold",
] as const satisfies readonly (keyof UptimeMonitorFields)[];

/** The request body: every field that is set, `null` included. */
function uptimeMonitorBody(fields: UptimeMonitorFields): string {
  const payload: Record<string, unknown> = {};
  for (const field of UPTIME_MONITOR_FIELDS) {
    if (fields[field] !== undefined) {
      payload[field] = fields[field];
    }
  }
  return JSON.stringify(payload);
}

/** Create an uptime monitor in a project. */
export async function createUptimeMonitor<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    projectSlug,
    ...fields
  }: { organizationSlug: string; projectSlug: string } & UptimeMonitorFields &
    Required<
      Pick<
        UptimeMonitorFields,
        "name" | "url" | "intervalSeconds" | "timeoutMs"
      >
    >,
  schema: ResponseSchema<T>,
): Promise<T> {
  const body = await core.requestJson(
    origin,
    apiPath`/projects/${organizationSlug}/${projectSlug}/uptime/`,
    { method: "POST", body: uptimeMonitorBody(fields) },
  );
  return validateResponse(schema, body);
}

/** Update an uptime monitor. Only the fields that are set are sent. */
export async function updateUptimeMonitor<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    projectSlug,
    uptimeMonitorId,
    ...fields
  }: UptimeMonitorParams & UptimeMonitorFields,
  schema: ResponseSchema<T>,
): Promise<T> {
  const body = await core.requestJson(
    origin,
    uptimeMonitorPath({ organizationSlug, projectSlug, uptimeMonitorId }),
    { method: "PUT", body: uptimeMonitorBody(fields) },
  );
  return validateResponse(schema, body);
}

/**
 * Delete an uptime monitor. Sentry answers 202 with no body; a 404 (already
 * gone) is not an error, so repeated deletes succeed.
 */
export async function deleteUptimeMonitor(
  { core, origin }: ApiTarget,
  params: UptimeMonitorParams,
): Promise<void> {
  await core.request(
    origin,
    uptimeMonitorPath(params),
    { method: "DELETE" },
    { allowStatuses: [404] },
  );
}
