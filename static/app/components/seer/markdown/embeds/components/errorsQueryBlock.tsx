import {skipToken, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {ChartContent} from 'sentry/components/seer/markdown/embeds/components/chart';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {aggregateOutputType, getAggregateAlias} from 'sentry/utils/discover/fields';
import {formatNumber} from 'sentry/utils/number/formatNumber';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  isEventsStats,
  isMultiSeriesEventsStats,
} from 'sentry/views/dashboards/utils/isEventsStats';
import {transformEventsStatsToSeries} from 'sentry/views/dashboards/utils/transformEventsStatsToSeries';

import {ErrorsQueryLink} from './errorsQueryLink';
import {
  buildErrorsChartQuery,
  buildErrorsEventView,
  hasNoGroupBy,
  resolveChartYAxes,
  toChartUnit,
  type ErrorsQueryData,
} from './errorsQueryUtils';

const ROW_LIMIT = 5;

// Matches the height `ChartContent` renders into, so the chart's loading state
// holds the block's shape instead of collapsing it.
const CHART_HEIGHT = '220px';

interface ErrorsQueryBlockProps {
  data: ErrorsQueryData;
}

function formatCellValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '—';
  }

  if (typeof value === 'number') {
    return String(formatNumber(value));
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString();
  }

  return JSON.stringify(value) ?? '—';
}

function chartSeriesFromStatsResponse(
  responseData: EventsStats | MultiSeriesEventsStats,
  yAxisFields: string[]
) {
  if (isEventsStats(responseData)) {
    const field = yAxisFields[0] ?? t('Count');
    return [transformEventsStatsToSeries(responseData, field, field)];
  }

  if (isMultiSeriesEventsStats(responseData)) {
    return Object.entries(responseData)
      .filter(([key]) => key !== 'order')
      .map(([seriesName, stats]) =>
        transformEventsStatsToSeries(stats, seriesName, seriesName)
      );
  }

  return [];
}

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
  const organization = useOrganization();

  // The chart is the total across the period, never a per-group breakdown —
  // the table below is what breaks the results out by group.
  const yAxisFields = resolveChartYAxes(data, fields);

  const query = useQuery({
    ...apiOptions.as<EventsStats | MultiSeriesEventsStats>()(
      '/organizations/$organizationIdOrSlug/events-stats/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: buildErrorsChartQuery(eventView, yAxisFields),
        staleTime: 30_000,
      }
    ),
    retry: false,
  });

  if (query.isPending) {
    return (
      <Flex align="center" height={CHART_HEIGHT} justify="center" width="100%">
        <LoadingIndicator />
      </Flex>
    );
  }

  if (query.isError) {
    return (
      <Alert role="alert" variant="danger">
        {t('Unable to load chart data')}
      </Alert>
    );
  }

  const series = chartSeriesFromStatsResponse(query.data, yAxisFields).map(item => ({
    label: item.seriesName,
    data: item.data.map(point => ({
      x: new Date(point.name).toISOString(),
      y: point.value,
    })),
  }));

  if (series.every(item => item.data.length === 0)) {
    // When a table follows, its own empty state already says this — drop the
    // chart rather than repeat the message.
    return hasTable ? null : (
      <Alert role="alert" variant="muted">
        {t('No matching errors')}
      </Alert>
    );
  }

  return (
    <ChartContent
      data={{
        title: data.title ?? t('Errors over time'),
        visualization: 'line',
        x_axis: 'time',
        y_axis_unit: toChartUnit(aggregateOutputType(yAxisFields[0])),
        series,
      }}
      showHeader={false}
    />
  );
}

export default function ErrorsQueryBlock({data}: ErrorsQueryBlockProps) {
  const organization = useOrganization();
  const eventView = buildErrorsEventView(data);
  const fields = eventView.getFields();
  const isAggregate = data.mode === 'aggregate';
  // An aggregate with no grouping columns collapses to a single row, so the
  // chart already says everything a table would. Every other query keeps its
  // table and gains the chart above it.
  const isChartOnly = isAggregate && hasNoGroupBy(fields);

  const tableQuery = useQuery({
    ...apiOptions.as<TableData>()('/organizations/$organizationIdOrSlug/events/', {
      path: isChartOnly ? skipToken : {organizationIdOrSlug: organization.slug},
      query: {
        ...eventView.generateQueryStringObject(),
        per_page: ROW_LIMIT,
        referrer: 'seer-errors-query-embed',
      },
      staleTime: 30_000,
    }),
    retry: false,
  });

  const columns = fields.map((field, index) => ({
    key: field,
    width: index === 0 ? 'minmax(0, 2fr)' : 'minmax(0, 1fr)',
  }));

  return (
    <Container
      as="section"
      background="primary"
      border="primary"
      data-test-id={`seer-errors-query-${data.mode}-embed`}
      margin="lg 0"
      padding="lg"
      radius="md"
      width="100%"
    >
      <Stack gap="md">
        <Flex align="center" gap="md" justify="between">
          <ErrorsQueryLink data={data} />
          <Tag variant="muted">{isAggregate ? t('Aggregate') : t('Events')}</Tag>
        </Flex>
        {data.query ? <ProvidedFormattedQuery query={data.query} /> : null}
        <ErrorsQueryChart
          data={data}
          eventView={eventView}
          fields={fields}
          hasTable={!isChartOnly}
        />
        {isChartOnly ? null : (
          <SimpleTable
            columns={columns}
            header={
              <SimpleTable.HeaderRow>
                {fields.map(field => (
                  <SimpleTable.HeaderCell key={field}>
                    <Text ellipsis>{field}</Text>
                  </SimpleTable.HeaderCell>
                ))}
              </SimpleTable.HeaderRow>
            }
          >
            {tableQuery.isPending ? (
              <SimpleTable.Loading />
            ) : tableQuery.isError ? (
              <SimpleTable.Empty>{t('Unable to load errors')}</SimpleTable.Empty>
            ) : tableQuery.data.data.length === 0 ? (
              <SimpleTable.Empty>{t('No matching errors')}</SimpleTable.Empty>
            ) : (
              tableQuery.data.data.slice(0, ROW_LIMIT).map((row, rowIndex) => (
                <SimpleTable.Row key={row.id ?? rowIndex}>
                  {fields.map(field => (
                    <SimpleTable.RowCell key={field}>
                      <Text ellipsis>
                        {formatCellValue(row[field] ?? row[getAggregateAlias(field)])}
                      </Text>
                    </SimpleTable.RowCell>
                  ))}
                </SimpleTable.Row>
              ))
            )}
          </SimpleTable>
        )}
      </Stack>
    </Container>
  );
}
