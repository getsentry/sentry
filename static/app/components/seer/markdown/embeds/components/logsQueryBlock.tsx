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
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

import {LogsQueryLink} from './logsQueryLink';
import {
  buildLogsEventView,
  getLogsGroupBy,
  getLogsQueryFields,
  hasNoGroupBy,
  resolveLogsYAxes,
  type LogsQueryData,
} from './logsQueryUtils';

function LogsQueryChart({
  data,
  hasTable,
  sort,
}: {
  data: LogsQueryData;
  hasTable: boolean;
  sort: Sort | undefined;
}) {
  const groupBy = getLogsGroupBy(data);

  // Logs charts through `/events-timeseries/` like the Logs page itself, not
  // the `/events-stats/` endpoint the Discover-backed embeds use.
  const query = useFetchEventsTimeSeries(
    DiscoverDatasets.OURLOGS,
    {
      yAxis: resolveLogsYAxes(data),
      query: data.query,
      groupBy: groupBy.length > 0 ? groupBy : undefined,
      topEvents: groupBy.length > 0 ? QUERY_EMBED_ROW_LIMIT : undefined,
      // `topEvents` ranks the groups it keeps by this sort, so handing it the
      // table's own sort is what makes the legend describe the rows below it.
      // Without it the two rank differently and the series stop lining up.
      sort: groupBy.length > 0 ? sort : undefined,
      pageFilters: toPageFilters(data),
    },
    'seer-logs-query-embed'
  );

  const timeSeries = query.data?.timeSeries ?? [];

  return (
    <QueryEmbedChart
      emptyMessage={t('No matching logs')}
      hasTable={hasTable}
      isError={query.isError}
      isPending={query.isPending}
      series={seriesFromTimeSeries(timeSeries)}
      title={data.title ?? t('Logs over time')}
      unit={chartUnitFromTimeSeries(timeSeries)}
    />
  );
}

export default function LogsQueryBlock({data}: {data: LogsQueryData}) {
  const eventView = buildLogsEventView(data);
  const isChartOnly = hasNoGroupBy(data);

  const tableQuery = useQueryEmbedEventsTable({
    enabled: !isChartOnly,
    eventView,
    referrer: 'seer-logs-query-embed',
  });

  return (
    <QueryEmbedCard
      badge={
        <Tag variant="muted">
          {data.mode === 'aggregate' ? t('Aggregate') : t('Logs')}
        </Tag>
      }
      link={<LogsQueryLink data={data} />}
      query={data.query}
      testId={`seer-logs-query-${data.mode}-embed`}
    >
      <LogsQueryChart data={data} hasTable={!isChartOnly} sort={eventView.sorts[0]} />
      {isChartOnly ? null : (
        <QueryEmbedTable
          columns={eventColumns(getLogsQueryFields(data))}
          emptyMessage={t('No matching logs')}
          errorMessage={t('Unable to load logs')}
          isError={tableQuery.isError}
          isPending={tableQuery.isPending}
          rowKey={eventRowKey}
          rows={tableQuery.data?.data ?? []}
        />
      )}
    </QueryEmbedCard>
  );
}
