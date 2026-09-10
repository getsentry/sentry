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

import {ErrorsQueryLink} from './errorsQueryLink';
import {
  buildErrorsChartQuery,
  buildErrorsEventView,
  hasNoGroupBy,
  resolveChartYAxes,
  type ErrorsQueryData,
} from './errorsQueryUtils';

function ErrorsQueryChart({
  data,
  eventView,
  fields,
  hasTable,
}: {
  data: ErrorsQueryData;
  eventView: ReturnType<typeof buildErrorsEventView>;
  fields: string[];
  hasTable: boolean;
}) {
  // The chart is the total across the period, never a per-group breakdown —
  // the table below is what breaks the results out by group.
  const yAxisFields = resolveChartYAxes(data, fields);
  const query = useQueryEmbedEventsStats(buildErrorsChartQuery(eventView, yAxisFields));

  return (
    <QueryEmbedChart
      emptyMessage={t('No matching errors')}
      hasTable={hasTable}
      isError={query.isError}
      isPending={query.isPending}
      series={query.data ? seriesFromEventsStats(query.data, yAxisFields) : []}
      title={data.title ?? t('Errors over time')}
      unit={toChartUnit(aggregateOutputType(yAxisFields[0]))}
    />
  );
}

export default function ErrorsQueryBlock({data}: {data: ErrorsQueryData}) {
  const eventView = buildErrorsEventView(data);
  const fields = eventView.getFields();
  const isAggregate = data.mode === 'aggregate';
  // An aggregate with no grouping columns collapses to a single row, so the
  // chart already says everything a table would. Every other query keeps its
  // table and gains the chart above it.
  const isChartOnly = isAggregate && hasNoGroupBy(fields);

  const tableQuery = useQueryEmbedEventsTable({
    enabled: !isChartOnly,
    eventView,
    referrer: 'seer-errors-query-embed',
  });

  return (
    <QueryEmbedCard
      badge={<Tag variant="muted">{isAggregate ? t('Aggregate') : t('Events')}</Tag>}
      link={<ErrorsQueryLink data={data} />}
      query={data.query}
      testId={`seer-errors-query-${data.mode}-embed`}
    >
      <ErrorsQueryChart
        data={data}
        eventView={eventView}
        fields={fields}
        hasTable={!isChartOnly}
      />
      {isChartOnly ? null : (
        <QueryEmbedTable
          columns={eventColumns(fields)}
          emptyMessage={t('No matching errors')}
          errorMessage={t('Unable to load errors')}
          isError={tableQuery.isError}
          isPending={tableQuery.isPending}
          rowKey={eventRowKey}
          rows={tableQuery.data?.data ?? []}
        />
      )}
    </QueryEmbedCard>
  );
}
