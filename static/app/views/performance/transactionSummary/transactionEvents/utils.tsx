import {Query} from 'history';

export function eventsRouteWithQuery({
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
  const pathname = `/organizations/${orgSlug}/performance/summary/events/`;
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
