import {IconGraph} from '@sentry/icons/graph';

import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {useOrganization} from 'sentry/utils/useOrganization';

import {QueryEmbedCard} from './queryEmbed/queryEmbedCard';
import {
  chartUnitFromTimeSeries,
  QueryEmbedChart,
  seriesFromTimeSeries,
} from './queryEmbed/queryEmbedChart';
import {QUERY_EMBED_ROW_LIMIT} from './queryEmbed/queryEmbedConstants';
import {
  useHasUnsupportedQueryTransformations,
  useQueryEmbedEventsTable,
} from './queryEmbed/queryEmbedQueries';
import {eventColumns, eventRowKey, QueryEmbedTable} from './queryEmbed/queryEmbedTable';
import {getMetricsQueryTitle} from './metricsQueryLink';
import {
  buildMetricsEventView,
  getMetricsQueryFields,
  getMetricsQueryHref,
  resolveMetricYAxes,
  type MetricsQueryData,
} from './metricsQueryUtils';
import {toPageFilters} from './queryEmbedParams';

/** An aggregate that groups by nothing collapses to one row per y-axis. */
function hasNoGroupBy(data: MetricsQueryData): boolean {
  return data.mode === 'aggregate' && !(data.groupBy ?? []).some(Boolean);
}

function MetricsQueryChart({
  data,
  hasTable,
  sort,
}: {
  data: MetricsQueryData;
  hasTable: boolean;
  sort: Sort | undefined;
}) {
  const groupBy = (data.groupBy ?? []).filter(Boolean);
  const unsupportedTransformations = useHasUnsupportedQueryTransformations(
    data.transformations
  );

  // The metric's identity rides in the y-axis arguments, so the search string
  // stays the user's own predicate — unlike the samples table, which has no
  // aggregate to carry it.
  const query = useFetchEventsTimeSeries(
    DiscoverDatasets.TRACEMETRICS,
    {
      enabled: !unsupportedTransformations,
      yAxis: resolveMetricYAxes(data),
      transformations: data.transformations,
      interval: data.interval,
      query: data.query,
      groupBy: groupBy.length > 0 ? groupBy : undefined,
      topEvents: groupBy.length > 0 ? QUERY_EMBED_ROW_LIMIT : undefined,
      sort: groupBy.length > 0 ? sort : undefined,
      pageFilters: toPageFilters(data),
    },
    'seer-metrics-query-embed'
  );

  const timeSeries = query.data?.timeSeries ?? [];

  return (
    <QueryEmbedChart
      emptyMessage={t('No matching metric values')}
      hasTable={hasTable}
      isError={query.isError}
      isPending={query.isPending}
      series={seriesFromTimeSeries(timeSeries, data)}
      title={data.title ?? data.name}
      unit={chartUnitFromTimeSeries(timeSeries)}
      unsupportedTransformations={unsupportedTransformations}
    />
  );
}

export default function MetricsQueryBlock({data}: {data: MetricsQueryData}) {
  const organization = useOrganization();
  const eventView = buildMetricsEventView(data);
  const isChartOnly = hasNoGroupBy(data);

  const tableQuery = useQueryEmbedEventsTable({
    enabled: !isChartOnly,
    eventView,
    referrer: 'seer-metrics-query-embed',
  });

  return (
    <QueryEmbedCard
      href={getMetricsQueryHref(data, organization)}
      icon={IconGraph}
      linkLabel={t('View Metrics')}
      query={data.query}
      table={
        isChartOnly ? null : (
          <QueryEmbedTable
            columns={eventColumns(getMetricsQueryFields(data), tableQuery.data?.meta)}
            emptyMessage={t('No matching metric values')}
            errorMessage={t('Unable to load metric values')}
            isError={tableQuery.isError}
            isPending={tableQuery.isPending}
            rowKey={eventRowKey}
            rows={tableQuery.data?.data ?? []}
          />
        )
      }
      testId={`seer-metrics-query-${data.mode}-embed`}
      title={getMetricsQueryTitle(data)}
    >
      <MetricsQueryChart data={data} hasTable={!isChartOnly} sort={eventView.sorts[0]} />
    </QueryEmbedCard>
  );
}
