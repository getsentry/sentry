import {Query} from 'history';

export function generateAnomaliesRoute({orgSlug}: {orgSlug: String}): string {
  return `/organizations/${orgSlug}/performance/summary/anomalies/`;
}

export function anomaliesRouteWithQuery({
  orgSlug,
  transaction,
  projectID,
  query,
}: {
  orgSlug: string;
  transaction: string;
  query: Query;
  projectID?: string | string[];
}) {
  const pathname = generateAnomaliesRoute({
    orgSlug,
  });

  return {
    pathname,
    query: {
      transaction,
      project: projectID,
      environment: query.environment,
      statsPeriod: query.statsPeriod,
      start: query.start,
      end: query.end,
      query: query.query,
    },
  };
}
