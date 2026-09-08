import {Tag} from '@sentry/scraps/badge';

import {QueryEmbedCard} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedCard';
import {
  QueryEmbedChart,
  seriesFromEventsStats,
  toChartUnit,
} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedChart';
import {
  useQueryEmbedEventsStats,
  useQueryEmbedEventsTable,
} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedQueries';
import {
  eventColumns,
  eventRowKey,
  QueryEmbedTable,
} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedTable';
import {t} from 'sentry/locale';
import {aggregateOutputType} from 'sentry/utils/discover/fields';

import {SpansQueryLink} from './spansQueryLink';
import {
  buildSpansChartQuery,
  buildSpansEventView,
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
  const query = useQueryEmbedEventsStats(
    buildSpansChartQuery(eventView, data, yAxisFields)
  );

  return (
    <QueryEmbedChart
      emptyMessage={t('No matching spans')}
      hasTable={hasTable}
      isError={query.isError}
      isPending={query.isPending}
      series={query.data ? seriesFromEventsStats(query.data, yAxisFields) : []}
      title={data.title ?? t('Spans over time')}
      unit={toChartUnit(aggregateOutputType(yAxisFields[0]))}
    />
  );
}

export default function SpansQueryBlock({data}: {data: SpansQueryData}) {
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
      badge={
        <Tag variant="muted">
          {data.mode === 'aggregate' ? t('Aggregate') : t('Spans')}
        </Tag>
      }
      link={<SpansQueryLink data={data} />}
      query={data.query}
      testId={`seer-spans-query-${data.mode}-embed`}
    >
      <SpansQueryChart data={data} eventView={eventView} hasTable={!isChartOnly} />
      {isChartOnly ? null : (
        <QueryEmbedTable
          columns={eventColumns(fields)}
          emptyMessage={t('No matching spans')}
          errorMessage={t('Unable to load spans')}
          isError={tableQuery.isError}
          isPending={tableQuery.isPending}
          rowKey={eventRowKey}
          rows={tableQuery.data?.data ?? []}
        />
      )}
    </QueryEmbedCard>
  );
}
