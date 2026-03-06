import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import type {Series, SeriesDataUnit} from 'sentry/types/echarts';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {DisplayType, WidgetType, type Widget} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {ConfidenceFooter as LogsConfidenceFooter} from 'sentry/views/explore/logs/confidenceFooter';
import {ConfidenceFooter as MetricsConfidenceFooter} from 'sentry/views/explore/metrics/confidenceFooter';
import {ConfidenceFooter as SpansConfidenceFooter} from 'sentry/views/explore/spans/charts/confidenceFooter';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';

import {useWidgetRawCounts} from './hooks/useWidgetRawCounts';
import type {GenericWidgetQueriesResult} from './genericWidgetQueries';

type Props = {
  loading: boolean;
  series: Array<Series & {fieldName?: string}>;
  timeseriesResults: GenericWidgetQueriesResult['timeseriesResults'];
  widget: Widget;
  yAxis: string;
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  isSampled?: boolean | null;
  sampleCount?: number;
  selection?: PageFilters;
};

export function WidgetCardConfidenceFooter({
  confidence,
  dataScanned,
  isSampled,
  loading,
  sampleCount,
  selection: selectionProp,
  series,
  timeseriesResults,
  widget,
  yAxis,
}: Props) {
  const {selection: pageFilterSelection} = usePageFilters();
  const selection = selectionProp ?? pageFilterSelection;
  const rawCounts = useWidgetRawCounts({selection, widget});
  const hasOtherSeries = timeseriesResults?.some(({seriesName}) =>
    seriesName?.match(/(?:.* : Other)$|^Other$/)
  );

  const topEventsCountExcludingOther =
    timeseriesResults?.length && widget.queries[0]?.columns.length
      ? Math.floor(timeseriesResults.length / widget.queries[0]?.aggregates.length) -
        (hasOtherSeries ? 1 : 0)
      : undefined;

  const isTopN =
    defined(topEventsCountExcludingOther) && topEventsCountExcludingOther > 1;
  const footerSeries = toFooterTimeSeries(series, dataScanned);
  const samplingMeta = hasSeriesSamplingMetadata(footerSeries)
    ? determineSeriesSampleCountAndIsSampled(footerSeries, isTopN)
    : undefined;
  const footerConfidence = confidence ?? combineConfidenceForSeries(footerSeries);
  const footerSampleCount = defined(sampleCount)
    ? sampleCount
    : samplingMeta?.sampleCount;
  const footerIsSampled = defined(isSampled) ? isSampled : samplingMeta?.isSampled;
  const footerDataScanned = dataScanned ?? samplingMeta?.dataScanned;
  const hasUserQuery = widget.queries.some(
    query => (query.conditions ?? '').trim().length > 0
  );
  const userQuery =
    widget.queries.find(query => (query.conditions ?? '').trim().length > 0)
      ?.conditions ?? '';
  const footerChartInfo: ChartInfo = {
    chartType: getExploreChartType(widget.displayType),
    series: footerSeries,
    timeseriesResult: {isPending: loading} as ChartInfo['timeseriesResult'],
    yAxis,
    confidence: footerConfidence,
    dataScanned: footerDataScanned,
    isSampled: footerIsSampled,
    sampleCount: footerSampleCount,
    topEvents: topEventsCountExcludingOther,
  };

  if (widget.widgetType === WidgetType.SPANS) {
    return (
      <SpansConfidenceFooter
        confidence={footerChartInfo.confidence}
        dataScanned={footerChartInfo.dataScanned}
        isSampled={footerChartInfo.isSampled}
        isLoading={loading}
        rawSpanCounts={rawCounts ?? undefined}
        sampleCount={footerChartInfo.sampleCount}
        topEvents={footerChartInfo.topEvents}
        userQuery={userQuery}
      />
    );
  }

  if (widget.widgetType === WidgetType.TRACEMETRICS && rawCounts) {
    return (
      <MetricsConfidenceFooter
        chartInfo={footerChartInfo}
        hasUserQuery={hasUserQuery}
        isLoading={loading}
        rawMetricCounts={rawCounts}
      />
    );
  }

  if (widget.widgetType === WidgetType.LOGS && rawCounts) {
    return (
      <LogsConfidenceFooter
        chartInfo={footerChartInfo}
        hasUserQuery={hasUserQuery}
        isLoading={loading}
        rawLogCounts={rawCounts}
      />
    );
  }

  return null;
}

function toFooterTimeSeries(
  series: Array<Series & {fieldName?: string}>,
  dataScanned?: 'full' | 'partial'
): TimeSeries[] {
  return series.map((seriesEntry, seriesIndex) => {
    const values = seriesEntry.data.map((datum, pointIndex) => {
      const samplingDatum = datum as SeriesDataUnit & {
        confidence?: Confidence;
        sampleCount?: number | null;
        sampleRate?: number | null;
      };

      const numericTimestamp =
        typeof samplingDatum.name === 'number'
          ? samplingDatum.name
          : new Date(samplingDatum.name).getTime();

      return {
        timestamp: Number.isFinite(numericTimestamp)
          ? numericTimestamp
          : seriesIndex * 1000 + pointIndex,
        value: samplingDatum.value,
        confidence: samplingDatum.confidence,
        sampleCount: samplingDatum.sampleCount,
        sampleRate: samplingDatum.sampleRate,
      };
    });

    const interval =
      values.length >= 2 ? Math.max(0, values[1]!.timestamp - values[0]!.timestamp) : 0;

    return {
      yAxis: seriesEntry.seriesName,
      values,
      meta: {
        interval,
        valueType: 'number',
        valueUnit: null,
        dataScanned,
      },
    };
  });
}

function hasSeriesSamplingMetadata(series: TimeSeries[]) {
  return series.some(
    seriesEntry =>
      defined(seriesEntry.meta.dataScanned) ||
      seriesEntry.values.some(
        value => defined(value.sampleCount) || defined(value.sampleRate)
      )
  );
}

function getExploreChartType(displayType: DisplayType) {
  switch (displayType) {
    case DisplayType.BAR:
      return ChartType.BAR;
    case DisplayType.AREA:
    case DisplayType.TOP_N:
      return ChartType.AREA;
    case DisplayType.LINE:
    default:
      return ChartType.LINE;
  }
}
