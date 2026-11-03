import {IconGraph} from '@sentry/icons/graph';

import {QueryEmbedCard} from './queryEmbed/queryEmbedCard';
import {useQueryEmbedEventsTable} from './queryEmbed/queryEmbedQueries';
import {
  eventColumns,
  eventRowKey,
  QueryEmbedTable,
} from './queryEmbed/queryEmbedTable';
import {QueryEmbedTimeSeries} from './queryEmbed/queryEmbedTimeSeries';
import {t} from 'sentry/locale';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getMetricsQueryTitle} from './metricsQueryLink';
import {
  buildMetricsEventView,
  getMetricsQueryFields,
  getMetricsQueryHref,
  resolveMetricYAxes,
  type MetricsQueryData,
} from './metricsQueryUtils';

/** An aggregate that groups by nothing collapses to one row per y-axis. */
function hasNoGroupBy(data: MetricsQueryData): boolean {
  return data.mode === 'aggregate' && !(data.groupBy ?? []).some(Boolean);
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
      <QueryEmbedTimeSeries
        data={data}
        dataset={DiscoverDatasets.TRACEMETRICS}
        emptyMessage={t('No matching metric values')}
        hasTable={!isChartOnly}
        referrer="seer-metrics-query-embed"
        sort={eventView.sorts[0]}
        yAxes={resolveMetricYAxes(data)}
      />
    </QueryEmbedCard>
  );
}
