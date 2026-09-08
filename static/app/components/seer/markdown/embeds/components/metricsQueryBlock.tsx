import {Tag} from '@sentry/scraps/badge';

import {QueryEmbedCard} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedCard';
import {
  chartUnitFromTimeSeries,
  QueryEmbedChart,
  seriesFromTimeSeries,
} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedChart';
import {QUERY_EMBED_ROW_LIMIT} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedConstants';
import {useQueryEmbedEventsTable} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedQueries';
import {
  eventColumns,
  eventRowKey,
  QueryEmbedTable,
} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedTable';
import {toPageFilters} from 'sentry/components/seer/markdown/embeds/components/queryEmbedParams';
import {t} from 'sentry/locale';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

import {MetricsQueryLink} from './metricsQueryLink';
import {
  buildMetricsEventView,
  getMetricsQueryFields,
  resolveMetricYAxes,
  type MetricsQueryData,
} from './metricsQueryUtils';

/** An aggregate that groups by nothing collapses to one row per y-axis. */
function hasNoGroupBy(data: MetricsQueryData): boolean {
  return data.mode === 'aggregate' && !(data.groupBy ?? []).some(Boolean);
}

function MetricsQueryChart({
  data,
  hasTable,
}: {
  data: MetricsQueryData;
  hasTable: boolean;
}) {
  const groupBy = (data.groupBy ?? []).filter(Boolean);

  // The metric's identity rides in the y-axis arguments, so the search string
  // stays the user's own predicate — unlike the samples table, which has no
  // aggregate to carry it.
  const query = useFetchEventsTimeSeries(
    DiscoverDatasets.TRACEMETRICS,
    {
      yAxis: resolveMetricYAxes(data),
      query: data.query,
      groupBy: groupBy.length > 0 ? groupBy : undefined,
      topEvents: groupBy.length > 0 ? QUERY_EMBED_ROW_LIMIT : undefined,
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
      series={seriesFromTimeSeries(timeSeries)}
      title={data.title ?? data.name}
      unit={chartUnitFromTimeSeries(timeSeries)}
    />
  );
}

export default function MetricsQueryBlock({data}: {data: MetricsQueryData}) {
  const eventView = buildMetricsEventView(data);
  const isChartOnly = hasNoGroupBy(data);

  const tableQuery = useQueryEmbedEventsTable({
    enabled: !isChartOnly,
    eventView,
    referrer: 'seer-metrics-query-embed',
  });

  return (
    <QueryEmbedCard
      badge={
        <Tag variant="muted">
          {data.mode === 'aggregate' ? t('Aggregate') : t('Samples')}
        </Tag>
      }
      link={<MetricsQueryLink data={data} />}
      query={data.query}
      testId={`seer-metrics-query-${data.mode}-embed`}
    >
      <MetricsQueryChart data={data} hasTable={!isChartOnly} />
      {isChartOnly ? null : (
        <QueryEmbedTable
          columns={eventColumns(getMetricsQueryFields(data))}
          emptyMessage={t('No matching metric values')}
          errorMessage={t('Unable to load metric values')}
          isError={tableQuery.isError}
          isPending={tableQuery.isPending}
          rowKey={eventRowKey}
          rows={tableQuery.data?.data ?? []}
        />
      )}
    </QueryEmbedCard>
  );
}
