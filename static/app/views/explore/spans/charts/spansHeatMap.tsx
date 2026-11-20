import {useCallback, useMemo, useRef} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryStates} from 'nuqs';

import {Container, Flex} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {getUtcDateString} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {
  HeatMapWidgetVisualization,
  type HeatMapOverlayLine,
  type HeatMapSelectionMenuParams,
  type HeatMapZoomContext,
} from 'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization';
import {HeatMap} from 'sentry/views/dashboards/widgets/heatMapWidget/plottables/heatMap';
import {HEATMAP_RESIZE_DEBOUNCE_MS} from 'sentry/views/dashboards/widgets/heatMapWidget/settings';
import {calculateHeatMapBucketDimensions} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/calculateHeatMapBucketDimensions';
import {mergeMetricUnit} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/mergeMetricUnit';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {
  parseAsChartSelection,
  useChartSelection,
} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';
import {FloatingTriggerMenu} from 'sentry/views/explore/components/attributeBreakdowns/floatingTrigger';
import {heatMapApiOptions} from 'sentry/views/explore/hooks/heatMapApiOptions';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {dateTimeAsHeatMapWindow} from 'sentry/views/explore/metrics/hooks/partitionHeatMapWindows';
import {useQueryParamsQuery} from 'sentry/views/explore/queryParams/context';
import type {CrossEventQueryExtras} from 'sentry/views/explore/queryParams/crossEvent';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {
  isVisualizeFunction,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';
import {HEATMAP_AGGREGATE} from 'sentry/views/explore/utils/heatMapAggregate';
import {
  formatSearchNumber,
  setExploreAttributeBounds,
} from 'sentry/views/explore/utils/setExploreAttributeBounds';
import {SpanFields} from 'sentry/views/insights/types';

import type {HeatMapYBounds} from './useSpansHeatMapOutlierBound';

export const SPANS_HEAT_MAP_Y_AXES = [
  SpanFields.SPAN_DURATION,
  SpanFields.SPAN_SELF_TIME,
] as const;

export type SpansHeatMapYAxis = (typeof SPANS_HEAT_MAP_Y_AXES)[number];

export function canUseSpansHeatMap(organization: Organization) {
  return organization.features.includes('explore-dev-features');
}

export function getSpansHeatMapYAxis(
  visualize: Visualize
): SpansHeatMapYAxis | undefined {
  if (
    !isVisualizeFunction(visualize) ||
    visualize.parsedFunction?.name !== HEATMAP_AGGREGATE
  ) {
    return undefined;
  }
  const attribute = visualize.parsedFunction.arguments[0] || SpanFields.SPAN_DURATION;
  return SPANS_HEAT_MAP_Y_AXES.find(yAxis => yAxis === attribute);
}

export function isSpansHeatMap(visualize: Visualize, organization: Organization) {
  return (
    canUseSpansHeatMap(organization) &&
    !defined(visualize.chartGroup) &&
    defined(getSpansHeatMapYAxis(visualize))
  );
}

interface SpansHeatMapProps {
  chartIndex: number;
  extrapolate: boolean;
  query: string;
  yAxis: SpansHeatMapYAxis;
  caseInsensitive?: CaseInsensitive;
  crossEventQueries?: CrossEventQueryExtras;
  /**
   * Holds the heat map request until the Y-axis bounds are known, so it isn't
   * fetched twice.
   */
  isYBoundsPending?: boolean;
  samplingMode?: SamplingMode;
  yBounds?: HeatMapYBounds;
}

export function SpansHeatMap({
  chartIndex,
  extrapolate,
  query,
  yAxis,
  caseInsensitive,
  crossEventQueries,
  yBounds,
  isYBoundsPending,
  samplingMode,
}: SpansHeatMapProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [, , intervalOptions] = useChartInterval();
  const userQuery = useQueryParamsQuery();
  const {chartSelection, setChartSelection} = useChartSelection();
  const [, setSelectionParams] = useQueryStates(
    {
      query: parseAsString,
      cursor: parseAsString,
      aggregateCursor: parseAsString,
      start: parseAsString,
      end: parseAsString,
      statsPeriod: parseAsString,
      mode: parseAsString,
      table: parseAsString,
      chartSelection: parseAsChartSelection,
    },
    {scroll: false}
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useDimensions({elementRef: containerRef});
  // A leading update keeps the first usable measurement fast; mid-resize churn
  // collapses into a single trailing update once the resize settles.
  const [debouncedDimensions] = useDebouncedValue(dimensions, {
    wait: HEATMAP_RESIZE_DEBOUNCE_MS,
    // The initial zero-sized value must not consume the leading execution.
    leading: dimensions.width > 0 && dimensions.height > 0,
  });

  // Filtering out spans above the clip lets the endpoint derive the Y axis from
  // the remaining spans. The clip is added to the attribute's filters rather
  // than replacing them, so a range the user zoomed into still applies. The user
  // query is wrapped so the clip applies to every branch of an OR.
  let heatMapQuery = query;
  if (yBounds) {
    const clip = `${yAxis}:<${formatSearchNumber(yBounds.yMax)}`;
    heatMapQuery = query.trim() ? `(${query}) ${clip}` : clip;
  }

  const bucketDimensions = calculateHeatMapBucketDimensions(
    selection,
    debouncedDimensions,
    intervalOptions.map(option => option.value)
  );

  const {data, error, isPending, isPlaceholderData} = useQuery({
    ...heatMapApiOptions({
      dataset: DiscoverDatasets.SPANS,
      organization,
      selection,
      timeWindow: dateTimeAsHeatMapWindow(selection.datetime),
      yAxis,
      query: heatMapQuery,
      referrer: 'api.explore.spans-heatmap',
      interval: bucketDimensions?.interval,
      sampling: samplingMode,
      yBuckets: defined(bucketDimensions)
        ? Math.min(bucketDimensions.yBuckets, MAX_Y_BUCKETS)
        : undefined,
      caseInsensitive: Boolean(caseInsensitive),
      extrapolate,
      ...crossEventQueries,
    }),
    select: selectWithMillisecondUnit,
    placeholderData: keepPreviousData,
    enabled: !isYBoundsPending,
  });

  const percentiles = useFetchSpanTimeSeries(
    {
      yAxis: PERCENTILES.map(aggregate => `${aggregate}(${yAxis})` as const),
      query,
      interval: bucketDimensions?.interval ?? undefined,
      sampling: samplingMode,
      enabled: defined(bucketDimensions?.interval),
      caseInsensitive: Boolean(caseInsensitive),
      extrapolate,
      ...crossEventQueries,
    },
    'api.explore.spans-heatmap-percentiles'
  );

  const overlayLines = useMemo<HeatMapOverlayLine[]>(
    () =>
      PERCENTILES.flatMap(aggregate => {
        const timeSeries = percentiles.data?.timeSeries.find(
          series => series.yAxis === `${aggregate}(${yAxis})`
        );
        return timeSeries
          ? [
              {
                name: aggregate,
                values: timeSeries.values.map(({timestamp, value}) => ({
                  timestamp,
                  value,
                })),
              },
            ]
          : [];
      }),
    [percentiles.data, yAxis]
  );

  const plottables = useMemo(
    () => (data ? ([new HeatMap(data)] as [HeatMap]) : null),
    [data]
  );

  // Each selection action has to land in a single URL write, a separate query
  // params write would race and clobber the other changes.
  const handleZoom = useCallback(
    ({timestampStart, timestampEnd, valueMin, valueMax}: HeatMapZoomContext) => {
      setSelectionParams({
        query: setExploreAttributeBounds(userQuery, yAxis, valueMin, valueMax),
        cursor: null,
        aggregateCursor: null,
        start: getUtcDateString(Math.floor(timestampStart / 60_000) * 60_000),
        end: getUtcDateString(Math.ceil(timestampEnd / 60_000) * 60_000),
        statsPeriod: null,
        chartSelection: null,
      });
    },
    [setSelectionParams, userQuery, yAxis]
  );

  const handleCompareAttributeBreakdowns = useCallback(
    ({timestampStart, timestampEnd, valueMin, valueMax}: HeatMapZoomContext) => {
      setSelectionParams({
        mode: Mode.SAMPLES,
        table: Tab.ATTRIBUTE_BREAKDOWNS,
        chartSelection: {
          chartIndex,
          selection: {
            panelId: HEATMAP_SELECTION_PANEL_ID,
            range: [timestampStart, timestampEnd],
          },
          yRange: [valueMin, valueMax],
        },
      });
    },
    [chartIndex, setSelectionParams]
  );

  const renderSelectionMenu = useCallback(
    ({selection: region, clearSelection, hideMenu}: HeatMapSelectionMenuParams) => (
      <FloatingTriggerMenu
        onZoomIn={() => {
          trackAnalytics('explore.floating_trigger.zoom_in', {organization});
          clearSelection();
          handleZoom(region);
        }}
        onCompareAttributeBreakdowns={() => {
          trackAnalytics('explore.floating_trigger.compare_attribute_breakdowns', {
            organization,
          });
          hideMenu();
          handleCompareAttributeBreakdowns(region);
        }}
        onClearSelection={() => {
          clearSelection();
          if (chartSelection?.chartIndex === chartIndex) {
            setChartSelection(null);
          }
        }}
      />
    ),
    [
      chartIndex,
      chartSelection,
      handleCompareAttributeBreakdowns,
      handleZoom,
      organization,
      setChartSelection,
    ]
  );

  let visualization: React.ReactNode;
  if (error) {
    visualization = <Widget.WidgetError error={error} />;
  } else if (isPending || plottables === null) {
    visualization = <HeatMapWidgetVisualization.LoadingPlaceholder />;
  } else if (plottablesCanBeVisualized(plottables)) {
    // Keep the previous cells on screen under a spinner until the new ones arrive.
    visualization = (
      <Container position="relative" height="100%">
        <HeatMapWidgetVisualization
          plottables={plottables}
          overlayLines={overlayLines}
          renderSelectionMenu={renderSelectionMenu}
          showCursor
        />
        {isPlaceholderData ? <LoadingOverlay /> : null}
      </Container>
    );
  } else if (isPlaceholderData) {
    visualization = <HeatMapWidgetVisualization.LoadingPlaceholder />;
  } else {
    visualization = <HeatMapWidgetVisualization.NoData />;
  }

  return (
    <Container ref={containerRef} height="100%">
      {visualization}
    </Container>
  );
}

const HEATMAP_SELECTION_PANEL_ID = 'heatmap';

// Mirrors the backend's MAX_SPANS_Y_BUCKETS. Taller charts would ask for more
// rows than the endpoint returns, and refetch on every height change.
const MAX_Y_BUCKETS = 50;

const PERCENTILES = ['p99', 'p75', 'p50'] as const;

// We don't return a unit right now, the only selectable columns are currently in millis.
function selectWithMillisecondUnit(response: ApiResponse<HeatMapSeries>) {
  return mergeMetricUnit(response.json, DurationUnit.MILLISECOND);
}

// Copied from the metrics heat map. Importing it from there would create an
// import cycle through the Explore toolbar.
function LoadingOverlay() {
  return (
    <Flex position="absolute" inset="0" align="center" justify="center">
      <Container
        position="absolute"
        inset="0"
        background="primary"
        style={{opacity: 0.5}}
      />
      <LoadingIndicator mini />
    </Flex>
  );
}
