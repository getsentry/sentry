import {IconSpan} from '@sentry/icons/span';

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

import {getSpansQueryTitle} from './spansQueryLink';
import {
  buildSpansEventView,
  getSpansQueryHref,
  hasNoGroupBy,
  resolveChartYAxes,
  type SpansQueryData,
} from './spansQueryUtils';

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
      <QueryEmbedTimeSeries
        data={data}
        dataset={DiscoverDatasets.SPANS}
        emptyMessage={t('No matching spans')}
        hasTable={!isChartOnly}
        referrer="seer-spans-query-embed"
        sort={eventView.sorts[0]}
        yAxes={resolveChartYAxes(data)}
      />
    </QueryEmbedCard>
  );
}
