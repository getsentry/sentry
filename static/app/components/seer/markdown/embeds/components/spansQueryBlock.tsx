import {IconSpan} from '@sentry/icons/span';

import {QueryEmbedCard} from './queryEmbed/queryEmbedCard';
import {
  QueryEmbedChart,
  chartUnitFromTimeSeries,
  seriesFromEventsStats,
  seriesFromTimeSeries,
  toChartUnit,
} from './queryEmbed/queryEmbedChart';
import {QUERY_EMBED_ROW_LIMIT} from './queryEmbed/queryEmbedConstants';
import {
  useQueryEmbedEventsStats,
  useQueryEmbedEventsTable,
} from './queryEmbed/queryEmbedQueries';
import {
  eventColumns,
  eventRowKey,
  QueryEmbedTable,
} from './queryEmbed/queryEmbedTable';
import {toPageFilters} from './queryEmbedParams';
import {t} from 'sentry/locale';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getSpansQueryTitle} from './spansQueryLink';
import {
  buildSpansChartQuery,
  buildSpansEventView,
  getSpansQueryHref,
  hasNoGroupBy,
  resolveChartYAxes,
  type SpansQueryData,
} from './spansQueryUtils';

function SpansQueryChart({
  data,
  eventView,
  hasTable,
}: {
  data: SpansQueryData;
  eventView: ReturnType<typeof buildSpansEventView>;
  hasTable: boolean;
}) {
  const yAxisFields = resolveChartYAxes(data);
  const hasTransformations =
    data.transformations?.some(pipeline => pipeline.length) ?? false;
  const query = useQueryEmbedEventsStats(
    buildSpansChartQuery(eventView, data, yAxisFields),
    !hasTransformations
  );
  const groupBy = data.mode === 'aggregate' ? data.groupBy?.filter(Boolean) : undefined;
  const transformedQuery = useFetchEventsTimeSeries(
    DiscoverDatasets.SPANS,
    {
      enabled: hasTransformations,
      yAxis: yAxisFields,
      transformations: data.transformations,
      interval: data.interval,
      query: data.query,
      pageFilters: toPageFilters(data),
      groupBy: groupBy?.length ? groupBy : undefined,
      topEvents: groupBy?.length ? QUERY_EMBED_ROW_LIMIT : undefined,
      sort: groupBy?.length ? eventView.sorts[0] : undefined,
    },
    'seer-spans-query-embed'
  );
  const chartQuery = hasTransformations ? transformedQuery : query;
  const timeSeries = (transformedQuery.data?.timeSeries ?? []).filter(
    series => !series.meta.isOther
  );

  return (
    <QueryEmbedChart
      emptyMessage={t('No matching spans')}
      hasTable={hasTable}
      isError={chartQuery.isError}
      isPending={chartQuery.isPending}
      series={
        hasTransformations
          ? seriesFromTimeSeries(timeSeries, data)
          : query.data
            ? seriesFromEventsStats(query.data, yAxisFields)
            : []
      }
      title={data.title ?? t('Spans over time')}
      unit={
        hasTransformations
          ? chartUnitFromTimeSeries(timeSeries)
          : toChartUnit(aggregateOutputType(yAxisFields[0]))
      }
    />
  );
}

export default function SpansQueryBlock({data}: {data: SpansQueryData}) {
  const organization = useOrganization();
  const eventView = buildSpansEventView(data);
  const fields = eventView.getFields();
  // An aggregate with no grouping columns collapses to a single row per
  // y-axis, so the chart already says everything a table would.
  const isChartOnly = hasNoGroupBy(data);

  const tableQuery = useQueryEmbedEventsTable({
    enabled: !isChartOnly,
    eventView,
    referrer: 'seer-spans-query-embed',
  });

  return (
    <QueryEmbedCard
      href={getSpansQueryHref(data, organization)}
      icon={IconSpan}
      linkLabel={t('View Spans')}
      query={data.query}
      table={
        isChartOnly ? null : (
          <QueryEmbedTable
            columns={eventColumns(fields, tableQuery.data?.meta)}
            emptyMessage={t('No matching spans')}
            errorMessage={t('Unable to load spans')}
            isError={tableQuery.isError}
            isPending={tableQuery.isPending}
            rowKey={eventRowKey}
            rows={tableQuery.data?.data ?? []}
          />
        )
      }
      testId={`seer-spans-query-${data.mode}-embed`}
      title={getSpansQueryTitle(data)}
    >
      <SpansQueryChart data={data} eventView={eventView} hasTable={!isChartOnly} />
    </QueryEmbedCard>
  );
}
