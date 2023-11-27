import {Query} from 'history';

import {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';

export function generateSpanDetailsRoute({
  orgSlug,
  spanSlug,
}: {
  orgSlug: string;
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

export function generateQuerySummaryRoute({
  orgSlug,
  group,
}: {
  group: string;
  orgSlug: string;
}): string {
  return `/organizations/${orgSlug}/performance/database/spans/span/${group}/`;
}

export function querySummaryRouteWithQuery({
  orgSlug,
  query,
  group,
  projectID,
}: {
  group: string;
  orgSlug: string;
  query: Query;
  projectID?: string | string[];
}) {
  const pathname = generateQuerySummaryRoute({
    orgSlug,
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

export function generateResourceSummaryRoute({
  orgSlug,
  group,
}: {
  group: string;
  orgSlug: string;
}): string {
  return `/organizations/${orgSlug}/performance/browser/resources/spans/span/${group}/`;
}

export function resourceSummaryRouteWithQuery({
  orgSlug,
  query,
  group,
  projectID,
}: {
  group: string;
  orgSlug: string;
  query: Query;
  projectID?: string | string[];
}) {
  const pathname = generateResourceSummaryRoute({
    orgSlug,
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

export enum ZoomKeys {
  MIN = 'min',
  MAX = 'max',
}
