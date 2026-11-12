import {useMemo, useRef} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {defined} from 'sentry/utils/defined';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {AggregationKey} from 'sentry/utils/fields';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {HeatMapWidgetVisualization} from 'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization';
import {HeatMap} from 'sentry/views/dashboards/widgets/heatMapWidget/plottables/heatMap';
import {calculateHeatMapBucketDimensions} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/calculateHeatMapBucketDimensions';
import {mergeMetricUnit} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/mergeMetricUnit';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {heatMapApiOptions} from 'sentry/views/explore/hooks/heatMapApiOptions';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {dateTimeAsHeatMapWindow} from 'sentry/views/explore/metrics/hooks/partitionHeatMapWindows';
import {
  isVisualizeEquation,
  isVisualizeFunction,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chartTypes';
import {SpanFields} from 'sentry/views/insights/types';

export const SPANS_HEAT_MAP_Y_AXES = [
  SpanFields.SPAN_DURATION,
  SpanFields.SPAN_SELF_TIME,
];

export function canUseSpansHeatMap(organization: Organization) {
  return organization.features.includes('explore-dev-features');
}

export function getSpansHeatMapYAxis(visualize: Visualize): string | undefined {
  if (
    !isVisualizeFunction(visualize) ||
    visualize.parsedFunction?.name !== AggregationKey.COUNT
  ) {
    return undefined;
  }
  const attribute = visualize.parsedFunction.arguments[0] || SpanFields.SPAN_DURATION;
  return SPANS_HEAT_MAP_Y_AXES.find(yAxis => yAxis === attribute);
}

export function getSpansHeatMapDisabledReason(visualize: Visualize): string | undefined {
  if (isVisualizeEquation(visualize)) {
    return t('Heatmaps are not available for equations.');
  }
  if (!defined(getSpansHeatMapYAxis(visualize))) {
    return t('Heatmaps are only available for count.');
  }
  return undefined;
}

export function isSpansHeatMap(visualize: Visualize, organization: Organization) {
  if (
    !canUseSpansHeatMap(organization) ||
    defined(visualize.chartGroup) ||
    !defined(getSpansHeatMapYAxis(visualize))
  ) {
    return false;
  }
  return visualize.hasSelectedChartType
    ? visualize.chartType === ChartType.HEATMAP
    : true;
}

interface SpansHeatMapProps {
  query: string;
  yAxis: string;
  samplingMode?: SamplingMode;
}

export function SpansHeatMap({query, yAxis, samplingMode}: SpansHeatMapProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [, , intervalOptions] = useChartInterval();
  const containerRef = useRef<HTMLDivElement>(null);
  const {width, height} = useDimensions({elementRef: containerRef});

  const bucketDimensions = calculateHeatMapBucketDimensions(
    selection,
    {width, height},
    intervalOptions.map(option => option.value)
  );

  const {data, error, isPending} = useQuery({
    ...heatMapApiOptions({
      dataset: DiscoverDatasets.SPANS,
      organization,
      selection,
      timeWindow: dateTimeAsHeatMapWindow(selection.datetime),
      yAxis,
      query,
      referrer: 'api.explore.spans-heatmap',
      interval: bucketDimensions?.interval,
      sampling: samplingMode,
      yBuckets: bucketDimensions?.yBuckets,
    }),
    select: selectWithMillisecondUnit,
  });

  const plottables = useMemo(
    () => (data ? ([new HeatMap(data)] as [HeatMap]) : null),
    [data]
  );

  let visualization: React.ReactNode;
  if (error) {
    visualization = <Widget.WidgetError error={error} />;
  } else if (isPending || plottables === null) {
    visualization = <HeatMapWidgetVisualization.LoadingPlaceholder />;
  } else if (plottablesCanBeVisualized(plottables)) {
    visualization = <HeatMapWidgetVisualization plottables={plottables} />;
  } else {
    visualization = <HeatMapWidgetVisualization.NoData />;
  }

  return (
    <Container ref={containerRef} height="100%">
      {visualization}
    </Container>
  );
}

// We don't return a unit right now, the only selectable columns are currently in millis.
function selectWithMillisecondUnit(response: ApiResponse<HeatMapSeries>) {
  return mergeMetricUnit(response.json, DurationUnit.MILLISECOND);
}
