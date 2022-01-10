import {Query} from 'history';

import {SpanSlug} from '../types';

export function generateSpanDetailsRoute({
  orgSlug,
  spanSlug,
}: {
  orgSlug: String;
  spanSlug: SpanSlug;
}): string {
  return `/organizations/${orgSlug}/performance/summary/spans/${spanSlug.op}:${spanSlug.group}/`;
}

export function spanDetailsRouteWithQuery({
  orgSlug,
  transaction,
  query,
  spanSlug,
  projectID,
}: {
  orgSlug: string;
  transaction: string;
  query: Query;
  spanSlug: SpanSlug;
  projectID?: string | string[];
}) {
  const pathname = generateSpanDetailsRoute({
    orgSlug,
    spanSlug,
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
