import {Query} from 'history';

import {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';

export function generateSpanDetailsRoute({
  orgSlug,
  spanSlug,
}: {
  orgSlug: String;
  spanSlug: SpanSlug;
}): string {
  const spanComponent = `${encodeURIComponent(spanSlug.op)}:${spanSlug.group}`;
  return `/organizations/${orgSlug}/performance/summary/spans/${spanComponent}/`;
}

export function spanDetailsRouteWithQuery({
  orgSlug,
  transaction,
  query,
  spanSlug,
  projectID,
}: {
  orgSlug: string;
  query: Query;
  spanSlug: SpanSlug;
  transaction: string;
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

export enum ZoomKeys {
  MIN = 'min',
  MAX = 'max',
}
