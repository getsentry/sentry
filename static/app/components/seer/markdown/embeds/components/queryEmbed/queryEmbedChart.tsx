import {Alert} from '@sentry/scraps/alert';
import {Flex} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ChartContent} from 'sentry/components/seer/markdown/embeds/components/chart';
import type {ChartUnit} from 'sentry/components/seer/markdown/embeds/components/chartTypes';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {t} from 'sentry/locale';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {
  isEventsStats,
  isMultiSeriesEventsStats,
} from 'sentry/views/dashboards/utils/isEventsStats';
import {transformEventsStatsToSeries} from 'sentry/views/dashboards/utils/transformEventsStatsToSeries';

/**
 * Matches the height `ChartContent` renders into, so the chart's loading state
 * holds the block's shape instead of collapsing it.
 */
const CHART_HEIGHT = '220px';

type ChartSeries = EmbedOutput<'chart'>['series'];

export function toChartUnit(outputType: AggregationOutputType): ChartUnit {
  switch (outputType) {
    case 'duration':
      return 'duration';
    case 'percentage':
      return 'percentage';
    case 'size':
      return 'bytes';
    default:
      return 'number';
  }
}

/**
 * Adapts an `/organizations/$org/events-stats/` response, whose series arrive
 * as raw count tuples that still need transforming.
 */
export function seriesFromEventsStats(
  responseData: EventsStats | MultiSeriesEventsStats,
  yAxisFields: string[]
): ChartSeries {
  const transformed = isEventsStats(responseData)
    ? [
        transformEventsStatsToSeries(
          responseData,
          yAxisFields[0] ?? t('Count'),
          yAxisFields[0] ?? t('Count')
        ),
      ]
    : isMultiSeriesEventsStats(responseData)
      ? // A grouped query comes back keyed by group name — one entry per top
        // group — and a multi-axis query keyed by aggregate. Either way the
        // key is the label.
        Object.entries(responseData)
          .filter(([key]) => key !== 'order')
          .map(([seriesName, stats]) =>
            transformEventsStatsToSeries(stats, seriesName, seriesName)
          )
      : [];

  return transformed.map(item => ({
    label: item.seriesName,
    data: item.data.map(point => ({
      x: new Date(point.name).toISOString(),
      y: point.value,
    })),
  }));
}

interface QueryEmbedChartProps {
  emptyMessage: string;
  /**
   * Whether a table follows. Its own empty state already says there were no
   * results, so an empty chart drops out rather than repeating the message.
   */
  hasTable: boolean;
  isError: boolean;
  isPending: boolean;
  series: ChartSeries;
  title: string;
  unit: ChartUnit;
}

/** The timeseries preview every charting query embed shares. */
export function QueryEmbedChart({
  emptyMessage,
  hasTable,
  isError,
  isPending,
  series,
  title,
  unit,
}: QueryEmbedChartProps) {
  if (isPending) {
    return (
      <Flex align="center" height={CHART_HEIGHT} justify="center" width="100%">
        <LoadingIndicator />
      </Flex>
    );
  }

  if (isError) {
    return (
      <Alert role="alert" variant="danger">
        {t('Unable to load chart data')}
      </Alert>
    );
  }

  if (series.every(item => item.data.length === 0)) {
    return hasTable ? null : (
      <Alert role="alert" variant="muted">
        {emptyMessage}
      </Alert>
    );
  }

  return (
    <ChartContent
      data={{
        title,
        visualization: 'line',
        x_axis: 'time',
        y_axis_unit: unit,
        series,
      }}
      showHeader={false}
    />
  );
}
