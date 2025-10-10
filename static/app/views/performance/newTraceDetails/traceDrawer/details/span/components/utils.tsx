import type {Query} from 'history';

function generateQuerySummaryRoute({base, group}: {base: string; group: string}): string {
  return `${base}/spans/span/${group}/`;
}

export function querySummaryRouteWithQuery({
  base,
  query,
  group,
  projectID,
}: {
  base: string;
  group: string;
  query: Query;
  projectID?: string | string[];
}) {
  const pathname = generateQuerySummaryRoute({
    base,
    group,
  });

  return {
    pathname,
    query: {
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
    },
  };
}

function generateResourceSummaryRoute({
  baseUrl,
  group,
}: {
  baseUrl: string;
  group: string;
}): string {
  return `${baseUrl}/spans/span/${group}/`;
}

export function resourceSummaryRouteWithQuery({
  baseUrl,
  query,
  group,
  projectID,
}: {
  baseUrl: string;
  group: string;
  query: Query;
  projectID?: string | string[];
}) {
  const pathname = generateResourceSummaryRoute({
    baseUrl,
    group,
  });

  return {
    pathname,
    query: {
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
    },
  };
}
