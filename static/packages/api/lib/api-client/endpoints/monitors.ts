/**
 * Cron monitor endpoints. With a project, reads go to the project's
 * endpoints, otherwise to the organization's. Each wrapper validates the
 * response with the schema the host passes, so the host's schema decides the
 * result type.
 */

import {
  apiPath,
  type ApiTarget,
  applyStatsMixinTimeParams,
  applyTimeParams,
  defaultStatsPeriod,
  parseStatsPeriod,
  type ResponseSchema,
  validateResponse,
  withQuery,
} from "@sentry/api/client";

export type ListMonitorsParams = {
  organizationSlug: string;
  projectSlug?: string;
  environment?: string;
  owner?: string;
  query?: string;
  /** Page size. */
  limit?: number;
};

/** The first page of the organization's cron monitors. */
export async function listMonitors<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    projectSlug,
    environment,
    owner,
    query,
    limit,
  }: ListMonitorsParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const params = new URLSearchParams();
  if (projectSlug) {
    params.append("projectSlug", projectSlug);
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
    withQuery(apiPath`/organizations/${organizationSlug}/monitors/`, params),
  );
  return validateResponse(schema, body);
}

export type MonitorParams = {
  organizationSlug: string;
  projectSlug?: string;
  monitorSlug: string;
  environment?: string;
};

function monitorPath(
  { organizationSlug, projectSlug, monitorSlug }: MonitorParams,
  suffix = "",
): string {
  const path = projectSlug
    ? apiPath`/projects/${organizationSlug}/${projectSlug}/monitors/${monitorSlug}/`
    : apiPath`/organizations/${organizationSlug}/monitors/${monitorSlug}/`;
  return `${path}${suffix}`;
}

function environmentQuery(environment: string | undefined): URLSearchParams {
  const params = new URLSearchParams();
  if (environment) {
    params.append("environment", environment);
  }
  return params;
}

/** One cron monitor. */
export async function getMonitor<T>(
  { core, origin }: ApiTarget,
  params: MonitorParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const body = await core.requestJson(
    origin,
    withQuery(monitorPath(params), environmentQuery(params.environment)),
  );
  return validateResponse(schema, body);
}

/**
 * Schedule deletion of one environment of a cron monitor. Sentry answers 202
 * with no body; a 404 (already gone) is not an error.
 */
export async function deleteMonitorEnvironment(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    projectSlug,
    monitorSlug,
    environment,
  }: MonitorParams & { projectSlug: string; environment: string },
): Promise<void> {
  await core.request(
    origin,
    apiPath`/projects/${organizationSlug}/${projectSlug}/monitors/${monitorSlug}/environments/${environment}/`,
    { method: "DELETE" },
    { allowStatuses: [404] },
  );
}

export type MonitorTimeRangeParams = MonitorParams & {
  /** Relative range such as `24h`. Default: `24h` without `start` or `end`. */
  statsPeriod?: string;
  start?: string;
  end?: string;
};

/** The first page of a cron monitor's check-ins in a time range. */
export async function listMonitorCheckIns<T>(
  { core, origin }: ApiTarget,
  params: MonitorTimeRangeParams & { limit?: number },
  schema: ResponseSchema<T>,
): Promise<T> {
  const query = environmentQuery(params.environment);
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
    withQuery(monitorPath(params, "checkins/"), query),
  );
  return validateResponse(schema, body);
}

/** A cron monitor's check-in counts over a time range. */
export async function getMonitorStats<T>(
  { core, origin }: ApiTarget,
  params: MonitorTimeRangeParams & {
    /** Bucket size in seconds. */
    rollup?: number;
  },
  schema: ResponseSchema<T>,
): Promise<T> {
  const query = environmentQuery(params.environment);
  applyStatsMixinTimeParams(
    query,
    defaultStatsPeriod(params),
    params.start,
    params.end,
    params.rollup,
  );
  const body = await core.requestJson(
    origin,
    withQuery(monitorPath(params, "stats/"), query),
  );
  return validateResponse(schema, body);
}
