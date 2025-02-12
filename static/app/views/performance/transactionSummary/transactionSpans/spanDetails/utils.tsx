import type {Query} from 'history';

import type {Organization} from 'sentry/types/organization';
import type {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

function generateSpanDetailsRoute({
  organization,
  spanSlug,
  view,
}: {
  organization: Organization;
  spanSlug: SpanSlug;
  view?: DomainView;
}): string {
  const spanComponent = `${encodeURIComponent(spanSlug.op)}:${spanSlug.group}`;
  return `${getTransactionSummaryBaseUrl(organization, view)}/spans/${spanComponent}/`;
}

export function spanDetailsRouteWithQuery({
  organization,
  transaction,
  query,
  spanSlug,
  projectID,
  view,
}: {
  organization: Organization;
  query: Query;
  spanSlug: SpanSlug;
  transaction: string;
  projectID?: string | string[];
  view?: DomainView;
}) {
  const pathname = generateSpanDetailsRoute({
    organization,
    spanSlug,
    view,
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
  base,
  group,
}: {
  base: string;
  group: string;
}): string {
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

export function generateResourceSummaryRoute({
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

export enum ZoomKeys {
  MIN = 'min',
  MAX = 'max',
  START = 'start',
  END = 'end',
}
