import {IconList} from '@sentry/icons/list';

import {QueryEmbedCard} from './queryEmbed/queryEmbedCard';
import {useQueryEmbedEventsTable} from './queryEmbed/queryEmbedQueries';
import {
  eventColumns,
  eventRowKey,
  QueryEmbedTable,
  type QueryEmbedColumn,
} from './queryEmbed/queryEmbedTable';
import {QueryEmbedTimeSeries} from './queryEmbed/queryEmbedTimeSeries';
import {t} from 'sentry/locale';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

import {LogSeverityDot, LogTimestamp} from './log/logRowParts';
import {getLogsQueryTitle} from './logsQueryLink';
import {
  buildLogsEventView,
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
      href={getLogsQueryHref(data, organization)}
      icon={IconList}
      linkLabel={t('View Logs')}
      query={data.query}
      table={
        isChartOnly ? null : (
          <QueryEmbedTable
            columns={logsQueryColumns(data, tableQuery.data?.meta)}
            emptyMessage={t('No matching logs')}
            errorMessage={t('Unable to load logs')}
            isError={tableQuery.isError}
            isPending={tableQuery.isPending}
            rowKey={eventRowKey}
            rows={tableQuery.data?.data ?? []}
          />
        )
      }
      testId={`seer-logs-query-${data.mode}-embed`}
      title={getLogsQueryTitle(data)}
    >
      <QueryEmbedTimeSeries
        data={data}
        dataset={DiscoverDatasets.OURLOGS}
        emptyMessage={t('No matching logs')}
        hasTable={!isChartOnly}
        referrer="seer-logs-query-embed"
        sort={eventView.sorts[0]}
        yAxes={resolveLogsYAxes(data)}
      />
    </QueryEmbedCard>
  );
}
