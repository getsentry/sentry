import trimStart from 'lodash/trimStart';

import {t} from 'sentry/locale';
import type {DateString, PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {statsPeriodToDays} from 'sentry/utils/duration/statsPeriodToDays';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {
  DerivedStatusFields,
  DISABLED_SORT,
  FIELD_TO_METRICS_EXPRESSION,
} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import {
  requiresCustomReleaseSorting,
  resolveDerivedStatusFields,
} from 'sentry/views/dashboards/widgetCard/releaseWidgetQueries';

const METRICS_BACKED_SESSIONS_START_DATE = new Date('2022-07-12');

const RATE_FUNCTIONS = [
  'unhealthy_rate',
  'abnormal_rate',
  'errored_rate',
  'unhandled_rate',
  'crash_rate',
];

/**
 * This is the maximum number of data points that can be returned by the metrics API.
 * Should be kept in sync with MAX_POINTS constant in backend
 * @file src/sentry/snuba/metrics/utils.py
 */
const MAX_POINTS = 10000;

function fieldsToDerivedMetrics(field: string): string {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return FIELD_TO_METRICS_EXPRESSION[field] ?? field;
}

/**
 * This is used to decide the "limit" parameter for the release health request.
 * This limit is actually passed to the "per_page" parameter of the request.
 * The limit is determined by the following formula: limit < MAX_POINTS / numberOfIntervals.
 * This is to prevent the "requested intervals is too granular for per_page..." error from the backend.
 */
function getCustomReleaseSortLimit(
  period: string | null,
  start?: DateString,
  end?: DateString,
  interval?: string
) {
  const periodInDays = statsPeriodToDays(period, start, end);
  const intervalInDays = statsPeriodToDays(interval);
  const numberOfIntervals = periodInDays / intervalInDays;
  const limit = Math.floor(MAX_POINTS / numberOfIntervals) - 1;
  if (limit < 1 || limit > 100) {
    return 100;
  }
  return limit;
}

export function getReleasesRequestData(
  includeSeries: number,
  includeTotals: number,
  query: WidgetQuery,
  organization: Organization,
  pageFilters: PageFilters,
  interval?: string,
  limit?: number,
  cursor?: string
) {
  const {environments, projects, datetime} = pageFilters;
  const {start, end, period} = datetime;

  let showIncompleteDataAlert = false;

  if (start) {
    let startDate: Date | undefined = undefined;
    if (typeof start === 'string') {
      startDate = new Date(start);
    } else {
      startDate = start;
    }
    showIncompleteDataAlert = startDate < METRICS_BACKED_SESSIONS_START_DATE;
  } else if (period) {
    const periodInDays = statsPeriodToDays(period);
    const current = new Date();
    const prior = new Date(new Date().setDate(current.getDate() - periodInDays));
    showIncompleteDataAlert = prior < METRICS_BACKED_SESSIONS_START_DATE;
  }

  if (showIncompleteDataAlert) {
    throw new Error(
      t(
        'Releases data is only available from Jul 12. Please retry your query with a more recent date range.'
      )
    );
  }

  // Only time we need to use sessions API is when session.status is requested
  // as a group by, or we are using a rate function.
  const useSessionAPI =
    query.columns.includes('session.status') ||
    Boolean(
      query.fields?.some(field =>
        RATE_FUNCTIONS.some(rateFunction => field.startsWith(rateFunction))
      )
    );
  const isCustomReleaseSorting = requiresCustomReleaseSorting(query);
  const isDescending = query.orderby.startsWith('-');
  const rawOrderby = trimStart(query.orderby, '-');
  const unsupportedOrderby =
    DISABLED_SORT.includes(rawOrderby) || useSessionAPI || rawOrderby === 'release';
  const columns = query.columns;

  const {aggregates, injectedFields} = resolveDerivedStatusFields(
    query.aggregates,
    query.orderby,
    useSessionAPI
  );

  if (useSessionAPI) {
    const sessionAggregates = aggregates.filter(
      agg => !Object.values(DerivedStatusFields).includes(agg as DerivedStatusFields)
    );
    return {
      field: sessionAggregates,
      orgSlug: organization.slug,
      end,
      environment: environments,
      groupBy: columns,
      limit,
      orderBy: '', // Orderby not supported with session.status
      interval,
      project: projects,
      query: query.conditions,
      start,
      statsPeriod: period,
      cursor,
      useSessionAPI,
    };
  }

  const requestData = {
    field: aggregates.map(fieldsToDerivedMetrics),
  };

  if (
    rawOrderby &&
    !unsupportedOrderby &&
    !aggregates.includes(rawOrderby) &&
    !columns.includes(rawOrderby)
  ) {
    requestData.field = [...requestData.field, fieldsToDerivedMetrics(rawOrderby)];
    if (!injectedFields.includes(rawOrderby)) {
      injectedFields.push(rawOrderby);
    }
  }

  return {
    field: requestData.field,
    orgSlug: organization.slug,
    end,
    environment: environments,
    groupBy: columns.map(fieldsToDerivedMetrics),
    limit:
      columns.length === 0
        ? 1
        : isCustomReleaseSorting
          ? getCustomReleaseSortLimit(period, start, end, interval)
          : limit,
    orderBy: unsupportedOrderby
      ? ''
      : isDescending
        ? `-${fieldsToDerivedMetrics(rawOrderby)}`
        : fieldsToDerivedMetrics(rawOrderby),
    interval,
    project: projects,
    query: query.conditions,
    start,
    statsPeriod: period,
    cursor,
    includeSeries,
    includeTotals,
    useSessionAPI,
  };
}
