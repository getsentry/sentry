import {
  toAggregateFields,
  toMode,
  toPageFilters,
} from 'sentry/components/seer/markdown/embeds/components/queryEmbedParams';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import type {NewQuery, Organization} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {getLogsUrl} from 'sentry/views/explore/logs/utils';

export type LogsQueryData = EmbedOutput<'logsQuery'>;

/**
 * What the Logs page charts when a query names no aggregate of its own.
 * Kept in step with `DEFAULT_LOGS_TIMESERIES_Y_AXIS`.
 */
const DEFAULT_AGGREGATE = 'count(message)';

export function getLogsGroupBy(data: LogsQueryData): string[] {
  return data.mode === 'aggregate' ? (data.groupBy ?? []).filter(Boolean) : [];
}

/**
 * An aggregate logs query that groups by nothing collapses to a single
 * `count(message)` row, which reads better as a chart than a one-row table.
 */
export function hasNoGroupBy(data: LogsQueryData): boolean {
  return data.mode === 'aggregate' && getLogsGroupBy(data).length === 0;
}

export function resolveLogsYAxes(data: LogsQueryData): string[] {
  return data.yAxes?.length ? data.yAxes : [DEFAULT_AGGREGATE];
}

export function getLogsQueryFields(data: LogsQueryData): string[] {
  if (data.mode === 'samples') {
    return data.fields?.length ? data.fields : defaultLogFields();
  }

  // The aggregates table lists the grouping columns followed by the
  // aggregates, the same shape `getLogsAggregatesFields` builds.
  return Array.from(new Set([...getLogsGroupBy(data), ...resolveLogsYAxes(data)]));
}

export function buildLogsEventView(data: LogsQueryData): EventView {
  const fields = getLogsQueryFields(data);
  const query: NewQuery = {
    id: undefined,
    name: data.title ?? 'Logs',
    fields,
    orderby: [
      data.sort ?? (data.mode === 'aggregate' ? `-${fields.at(-1)}` : '-timestamp'),
    ],
    query: data.query,
    version: 2,
    dataset: DiscoverDatasets.OURLOGS,
  };

  return EventView.fromNewQueryWithPageFilters(query, toPageFilters(data));
}

export function getLogsQueryHref(
  data: LogsQueryData,
  organization: Organization
): string {
  const {query, mode, sort, fields, groupBy, yAxes} = data;

  return getLogsUrl({
    organization,
    selection: toPageFilters(data),
    query,
    mode: toMode(mode),
    field: fields,
    sortBy: sort,
    aggregateFields: toAggregateFields({groupBy, yAxes}),
  });
}
