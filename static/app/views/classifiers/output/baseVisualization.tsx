import {Container} from '@sentry/scraps/layout';

import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {Referrer} from 'sentry/views/classifiers/constants';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import {getResultField} from 'sentry/views/classifiers/utils';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import type {ContinuousTimeSeries} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/continuousTimeSeries';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ChartType} from 'sentry/views/insights/common/components/chartTypes';

interface ClassifierTimeSeriesOptions {
  interval: string | undefined;
  pageFilters: PageFilters;
  query: string;
  enabled?: boolean;
}

export function useClassifierTimeSeries(
  classifier: TelemetryClassifier,
  {enabled, interval, pageFilters, query}: ClassifierTimeSeriesOptions
) {
  return useFetchEventsTimeSeries(
    DiscoverDatasets.ENRICHMENT_ATTRIBUTES,
    {
      yAxis: `count(${getResultField(classifier.resultAttribute)})`,
      query,
      interval,
      pageFilters,
      enabled,
    },
    Referrer.DETAIL_INSTANCES_CHART
  );
}

export function toPlottable(
  chartType: ChartType,
  timeSeries: TimeSeries | undefined,
  {alias, color}: {alias: string; color?: string}
) {
  if (!timeSeries) {
    return null;
  }
  const PlottableConstructor =
    chartType === ChartType.LINE ? Line : chartType === ChartType.AREA ? Area : Bars;
  return new PlottableConstructor(timeSeries, {
    alias,
    color,
    name: alias,
    stack: 'results',
  });
}

interface BaseClassifierVisualizationProps {
  error: Error | null;
  isPending: boolean;
  pageFilters: PageFilters;
  plottables: Array<ContinuousTimeSeries | null>;
  showLegend: boolean;
}

export function BaseClassifierVisualization({
  error,
  isPending,
  pageFilters,
  plottables: maybePlottables,
  showLegend,
}: BaseClassifierVisualizationProps) {
  const plottables = maybePlottables.filter(defined);
  if (isPending) {
    return <TimeSeriesWidgetVisualization.LoadingPlaceholder />;
  }
  if (error) {
    return (
      <Container position="absolute" inset={0}>
        <Widget.WidgetError error={error} />
      </Container>
    );
  }
  if (!plottables.some(({timeSeries}) => timeSeries.values.some(item => !!item.value))) {
    return <TimeSeriesWidgetVisualization.NoData />;
  }
  return (
    <TimeSeriesWidgetVisualization
      pageFilters={pageFilters}
      disableZoom
      showLegend={showLegend ? 'always' : 'never'}
      plottables={plottables}
    />
  );
}
