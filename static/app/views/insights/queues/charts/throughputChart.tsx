import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
// Our loadable chart widgets use this to render, so this import is ok
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useTopNSpanMetricsSeries} from 'sentry/views/insights/common/queries/useTopNDiscoverSeries';
import {renameDiscoverSeries} from 'sentry/views/insights/common/utils/renameDiscoverSeries';
import type {Referrer} from 'sentry/views/insights/queues/referrers';
import {FIELD_ALIASES} from 'sentry/views/insights/queues/settings';
import type {SpanQueryFilters} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';

interface Props {
  id: string;
  referrer: Referrer;
  destination?: string;
  error?: Error | null;
  pageFilters?: PageFilters;
}

export function ThroughputChart({id, error, destination, pageFilters, referrer}: Props) {
  const theme = useTheme();

  const search = MutableSearch.fromQueryObject({
    'span.op': '[queue.publish, queue.process]',
  } satisfies SpanQueryFilters);
  const groupBy = SpanFields.SPAN_OP;

  if (destination) {
    search.addFilterValue('messaging.destination.name', destination, false);
  }

  const {
    data,
    error: topNError,
    isLoading,
  } = useTopNSpanMetricsSeries(
    {
      search,
      yAxis: ['epm()'],
      fields: ['epm()', groupBy],
      topN: 2,
      transformAliasToInputFormat: true,
    },
    referrer,
    pageFilters
  );

  const publishData: DiscoverSeries = data.find(
    (d): d is DiscoverSeries => d.seriesName === 'queue.publish'
  ) ?? {data: [], seriesName: 'queue.publish', meta: {fields: {}, units: {}}};

  const processData: DiscoverSeries = data.find(
    (d): d is DiscoverSeries => d.seriesName === 'queue.process'
  ) ?? {data: [], seriesName: 'queue.process', meta: {fields: {}, units: {}}};

  const colors = theme.chart.getColorPalette(2);

  return (
    <InsightsLineChartWidget
      id={id}
      queryInfo={{search, groupBy: [groupBy]}}
      title={t('Published vs Processed')}
      series={[
        renameDiscoverSeries(
          {
            ...publishData,
            color: colors[1],
          },
          'epm() span.op:queue.publish'
        ),
        renameDiscoverSeries(
          {
            ...processData,
            color: colors[2],
          },
          'epm() span.op:queue.process'
        ),
      ]}
      aliases={FIELD_ALIASES}
      isLoading={isLoading}
      error={error ?? topNError}
    />
  );
}
