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
  type QueryEmbedColumn,
} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedTable';
import {toPageFilters} from 'sentry/components/seer/markdown/embeds/components/queryEmbedParams';
import {IconList} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

import {LogSeverityDot, LogTimestamp} from './log/logRowParts';
import {getLogsQueryTitle} from './logsQueryLink';
import {
  buildLogsEventView,
  getLogsGroupBy,
  getLogsQueryFields,
  getLogsQueryHref,
  hasNoGroupBy,
  resolveLogsYAxes,
  type LogsQueryData,
} from './logsQueryUtils';

type LogRow = Record<string, unknown>;

/**
 * Samples read like the logs table: a severity dot, then the timestamp, then
 * whatever else Seer asked for. Aggregates are grouped counts with no one log
 * behind a row, so they keep the plain columns.
 */
function logsQueryColumns(
  data: LogsQueryData,
  meta: EventsMetaType | undefined
): Array<QueryEmbedColumn<LogRow>> {
  const fields = getLogsQueryFields(data);
  if (data.mode !== 'samples') {
    return eventColumns(fields, meta);
  }

  return [
    {
      key: 'severity-dot',
      label: '',
      resizable: false,
      width: 'max-content',
      render: row => (
        <LogSeverityDot
          severity={row[OurLogKnownFieldKey.SEVERITY]}
          severityNumber={row[OurLogKnownFieldKey.SEVERITY_NUMBER]}
        />
      ),
    },
    {
      key: OurLogKnownFieldKey.TIMESTAMP,
      width: 'max-content',
      render: row => (
        <LogTimestamp
          timestamp={row[OurLogKnownFieldKey.TIMESTAMP]}
          timestampPrecise={row[OurLogKnownFieldKey.TIMESTAMP_PRECISE]}
        />
      ),
    },
    ...eventColumns<LogRow>(
      fields.filter(field => field !== OurLogKnownFieldKey.TIMESTAMP),
      meta
    ),
  ];
}

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
  const organization = useOrganization();
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
      href={getLogsQueryHref(data, organization)}
      icon={IconList}
      linkLabel={t('View Logs')}
      query={data.query}
      testId={`seer-logs-query-${data.mode}-embed`}
      title={getLogsQueryTitle(data)}
    >
      <LogsQueryChart data={data} hasTable={!isChartOnly} sort={eventView.sorts[0]} />
      {isChartOnly ? null : (
        <QueryEmbedTable
          columns={logsQueryColumns(data, tableQuery.data?.meta)}
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
