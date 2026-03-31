import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import {mergeRefs} from '@react-aria/utils';
import * as Sentry from '@sentry/react';
import type {SeriesOption, YAXisComponentOption} from 'echarts';
import type {
  TooltipFormatterCallback,
  TopLevelFormatterParams,
} from 'echarts/types/dist/shared';
import groupBy from 'lodash/groupBy';
import mapValues from 'lodash/mapValues';
import sum from 'lodash/sum';

import {Container, Flex} from '@sentry/scraps/layout';

import {BaseChart} from 'sentry/components/charts/baseChart';
import {ChartLegend} from 'sentry/components/charts/chartLegend';
import type {LegendItem} from 'sentry/components/charts/chartLegend';
import {getFormatter} from 'sentry/components/charts/components/tooltip';
import {
  useChartXRangeSelection,
  type ChartXRangeSelectionProps,
} from 'sentry/components/charts/useChartXRangeSelection';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import {isChartHovered, truncationFormatter} from 'sentry/components/charts/utils';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {
  EChartClickHandler,
  EChartDataZoomHandler,
  EChartDownplayHandler,
  EChartHighlightHandler,
  ReactEchartsRef,
} from 'sentry/types/echarts';
import {defined, escape} from 'sentry/utils';
import {uniq} from 'sentry/utils/array/uniq';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {RangeMap, type Range} from 'sentry/utils/number/rangeMap';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useWidgetSyncContext} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {getAxisRange, type AxisRange} from 'sentry/views/dashboards/utils/axisRange';
import {NO_PLOTTABLE_VALUES} from 'sentry/views/dashboards/widgets/common/settings';
import type {
  LegendSelection,
  Release,
} from 'sentry/views/dashboards/widgets/common/types';
import {WidgetLoadingPanel} from 'sentry/views/dashboards/widgets/common/widgetLoadingPanel';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useReleaseBubbles} from 'sentry/views/releases/releaseBubbles/useReleaseBubbles';
import {makeReleaseDrawerPathname} from 'sentry/views/releases/utils/pathnames';

import {formatTooltipValue} from './formatters/formatTooltipValue';
import {formatXAxisTimestamp} from './formatters/formatXAxisTimestamp';
import {formatYAxisValue} from './formatters/formatYAxisValue';
import type {Plottable} from './plottables/plottable';
import {ReleaseSeries} from './releaseSeries';
import {FALLBACK_TYPE, FALLBACK_UNIT_FOR_FIELD_TYPE} from './settings';
import {TimeSeriesWidgetYAxis} from './timeSeriesWidgetYAxis';

const {error, warn} = Sentry.logger;

export interface TimeSeriesWidgetVisualizationProps extends Partial<LoadableChartWidgetProps> {
  /**
   * An array of `Plottable` objects. This can be any object that implements the `Plottable` interface.
   */
  plottables: Plottable[];
  /**
   * Sets the range of the Y axis.
   *
   * - `auto`: The Y axis starts at 0, and ends at the maximum value of the data.
   * - `dataMin`: The Y axis starts at the minimum value of the data, and ends at the maximum value of the data.
   * Default: `auto`
   */
  axisRange?: AxisRange;

  /**
   * Reference to the chart instance
   */
  chartRef?: React.Ref<ReactEchartsRef>;
  /**
   * The props for the chart x range selection on drag.
   */
  chartXRangeSelection?: Partial<ChartXRangeSelectionProps>;

  /**
   * A mapping of time series field name to boolean. If the value is `false`, the series is hidden from view
   */
  legendSelection?: LegendSelection;

  /**
   * Callback that returns an updated `LegendSelection` after a user manipulations the selection via the legend
   */
  onLegendSelectionChange?: (selection: LegendSelection) => void;

  /**
   * Callback that returns an updated ECharts zoom selection. If omitted, the default behavior is to update the URL with updated `start` and `end` query parameters.
   */
  onZoom?: EChartDataZoomHandler;

  ref?: React.Ref<ReactEchartsRef>;

  /**
   * Array of `Release` objects. If provided, they are plotted on line and area visualizations as vertical lines
   */
  releases?: Release[];

  /**
   * Defines the legend's visibility.
   *
   * - `auto`: Show the legend if there are multiple series.
   * - `never`: Never show the legend.
   *
   * Default: `auto`
   */
  showLegend?: 'auto' | 'never' | 'always';

  /**
   * Defines the X axis visibility. Note that hiding the X axis also hides release bubbles.
   *
   * - `auto`: Show the X axis.
   * - `never`: Hide the X axis.
   *
   * Default: `auto`
   */
  showXAxis?: 'auto' | 'never';
}

export function TimeSeriesWidgetVisualization(props: TimeSeriesWidgetVisualizationProps) {
  if (props.plottables.every(plottable => plottable.isEmpty)) {
    throw new Error(NO_PLOTTABLE_VALUES);
  }

  // TODO: It would be polite to also scan for gaps (i.e., the items don't all
  // have the same difference in `timestamp`s) even though this is rare, since
  // the backend zerofills the data

  const chartRef = useRef<ReactEchartsRef | null>(null);
  const unregisterRef = useRef<(() => void) | null>(null);
  const {register: registerWithWidgetSyncContext, groupName} = useWidgetSyncContext();

  useEffect(() => {
    return () => {
      unregisterRef.current?.();
    };
  }, []);

  const pageFilters = usePageFilters();
  const {start, end, period, utc} =
    props.pageFilters?.datetime || pageFilters.selection.datetime;

  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const hasReleaseBubbles =
    props.showReleaseAs !== 'none' && props.showReleaseAs === 'bubble';

  const {
    onDataZoom,
    onChartReady: onChartReadyZoom,
    ...chartZoomProps
  } = useChartZoom({
    saveOnZoom: true,
  });

  const {brush, onBrushEnd, onBrushStart, toolBox, ActionMenu} = useChartXRangeSelection({
    chartRef,
    deps: [props.plottables],
    disabled: true,
    chartsGroupName: groupName,
    ...props.chartXRangeSelection,
  });

  const plottablesByType = groupBy(props.plottables, plottable => plottable.dataType);

  // Get unique axis types in order of first appearance, treating the first
  // aggregate as primary. This avoids axis flipping when thresholds or other
  // plottables inflate the count of a particular data type.
  const axisTypes: string[] = [];
  for (const plottable of props.plottables) {
    if (plottable.dataType && !axisTypes.includes(plottable.dataType)) {
      axisTypes.push(plottable.dataType);
    }
  }

  // Partition the types between the two axes
  let leftYAxisDataTypes: string[] = [];
  let rightYAxisDataTypes: string[] = [];

  if (axisTypes.length === 1) {
    // The simplest case, there is just one type. Assign it to the left axis
    leftYAxisDataTypes = axisTypes;
  } else if (axisTypes.length === 2) {
    // Also a simple case. If there are only two types, split them evenly
    leftYAxisDataTypes = axisTypes.slice(0, 1);
    rightYAxisDataTypes = axisTypes.slice(1, 2);
  } else if (axisTypes.length > 2 && axisTypes.at(0) === FALLBACK_TYPE) {
    // There are multiple types, and the first one is the fallback. Don't
    // bother creating a second fallback axis, plot everything on the left
    leftYAxisDataTypes = axisTypes;
  } else {
    // There are multiple types. Assign the first type to the left axis,
    // the rest to the right axis
    leftYAxisDataTypes = axisTypes.slice(0, 1);
    rightYAxisDataTypes = axisTypes.slice(1);
  }

  // The left Y axis might be responsible for 1 or more types. If there's just
  // one, use that type. If it's responsible for more than 1 type, use the
  // fallback type
  const leftYAxisType =
    leftYAxisDataTypes.length === 1 ? leftYAxisDataTypes.at(0)! : FALLBACK_TYPE;

  // The right Y axis might be responsible for 0, 1, or more types. If there are
  // none, don't set a type at all. If there is 1, use that type. If there are
  // two or more, use fallback type
  const rightYAxisType =
    rightYAxisDataTypes.length === 0
      ? undefined
      : rightYAxisDataTypes.length === 1
        ? rightYAxisDataTypes.at(0)
        : FALLBACK_TYPE;

  // Create a map of used units by plottable data type
  const unitsByType = mapValues(plottablesByType, plottables =>
    uniq(plottables.map(plottable => plottable.dataUnit))
  );

  // Narrow down to just one unit for each plottable data type
  const unitForType = mapValues(unitsByType, (relevantUnits, type) => {
    if (relevantUnits.length === 1) {
      // All plottables of this type have the same unit
      return relevantUnits[0]!;
    }

    if (relevantUnits.length === 0) {
      // None of the plottables of this type supplied a unit
      return FALLBACK_UNIT_FOR_FIELD_TYPE[type as AggregationOutputType];
    }

    // Plottables of this type has mismatched units. Return a fallback. It
    // would also be acceptable to return the unit of the _first_ plottable,
    // probably
    return FALLBACK_UNIT_FOR_FIELD_TYPE[type as AggregationOutputType];
  });

  const axisRangeProp = getAxisRange(props.axisRange) ?? 'auto';

  const leftYAxis = TimeSeriesWidgetYAxis(
    {
      axisLabel: {
        formatter: (value: number) =>
          formatYAxisValue(value, leftYAxisType, unitForType[leftYAxisType] ?? undefined),
      },
      position: 'left',
    },
    leftYAxisType,
    axisRangeProp
  );

  const rightYAxis = rightYAxisType
    ? TimeSeriesWidgetYAxis(
        {
          axisLabel: {
            formatter: (value: number) =>
              formatYAxisValue(
                value,
                rightYAxisType,
                unitForType[rightYAxisType] ?? undefined
              ),
          },
          position: 'right',
        },
        rightYAxisType,
        axisRangeProp
      )
    : undefined;

  // Set up a fallback palette for any plottable without a color
  const paletteSize = props.plottables.filter(plottable => plottable.needsColor).length;

  const palette = useMemo(
    () => (paletteSize > 0 ? theme.chart.getColorPalette(paletteSize - 1) : []),
    [paletteSize, theme.chart]
  );

  // Create a lookup of series names (given to ECharts) to labels (from
  // Plottable). This makes it easier to look up alises when rendering tooltips
  // and legends
  const aliases = Object.fromEntries(
    props.plottables.map(plottable => [plottable.name, plottable.label])
  );

  // Create tooltip formatter
  const formatTooltip: TooltipFormatterCallback<TopLevelFormatterParams> = (
    params,
    asyncTicket
  ) => {
    // Only show the tooltip of the current chart. Otherwise, all tooltips
    // in the chart group appear.
    if (!isChartHovered(chartRef?.current)) {
      return '';
    }

    let deDupedParams = params;

    if (Array.isArray(params)) {
      // We split each series into a complete and incomplete series, and they
      // have the same name. The two series overlap at one point on the chart,
      // to create a continuous line. This code prevents both series from
      // showing up on the tooltip
      const uniqueSeries = new Set<string>();

      deDupedParams = params.filter(param => {
        // Filter null values from tooltip
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        if (param.value[1] === null) {
          return false;
        }

        // @ts-expect-error TS(2345): Argument of type 'string | undefined' is not assig... Remove this comment to see the full error message
        if (uniqueSeries.has(param.seriesName)) {
          return false;
        }

        // @ts-expect-error TS(2345): Argument of type 'string | undefined' is not assig... Remove this comment to see the full error message
        uniqueSeries.add(param.seriesName);
        return true;
      });
    }

    return getFormatter({
      isGroupedByDate: true,
      showTimeInTooltip: true,
      nameFormatter: function (seriesName, nameFormatterParams) {
        if (!nameFormatterParams) {
          return seriesName;
        }

        if (
          nameFormatterParams.seriesType === 'scatter' &&
          Array.isArray(nameFormatterParams.data)
        ) {
          // For scatter series, the third point in the `data` array should be the sample's ID
          const sampleId = nameFormatterParams.data.at(2);
          return defined(sampleId) ? sampleId.toString() : seriesName;
        }

        const alias = aliases[seriesName];
        if (alias) {
          // The alias value comes from `plottable.label` and is not
          // HTML-escaped. Escape it for safe insertion into raw HTML
          // tooltip strings.
          return escape(truncationFormatter(alias, true, false));
        }
        // `seriesName` is already HTML-escaped by `getFormatter`, so
        // skip escaping to avoid double-encoding (e.g., `>` → `&gt;`
        // → `&amp;gt;`).
        return truncationFormatter(seriesName, true, false);
      },
      valueFormatter: function (value, _field, valueFormatterParams) {
        // Use the series to figure out the corresponding `Plottable`, and get the field type. From that, use whichever unit we chose for that field type.

        if (!valueFormatterParams || !defined(valueFormatterParams?.seriesIndex)) {
          // The series might be missing if this is a formatter for a mark line.
          // We don't currently handle this, so this behaviour is just here for
          // safety. The series index might be missing in unknown circumstances
          warn(
            '`TimeSeriesWidgetVisualization` could not format value due to missing `Series` information',
            {
              seriesName: valueFormatterParams?.seriesName,
              seriesType: valueFormatterParams?.seriesType,
            }
          );
          return value.toLocaleString();
        }

        const correspondingPlottable = seriesIndexToPlottableRangeMap.get(
          valueFormatterParams.seriesIndex
        );

        const fieldType = correspondingPlottable?.dataType ?? FALLBACK_TYPE;

        return escape(
          formatTooltipValue(value, fieldType, unitForType[fieldType] ?? undefined)
        );
      },
      truncate: false,
      utc: utc ?? false,
    })(deDupedParams, asyncTicket);
  };

  const yAxes: YAXisComponentOption[] = [leftYAxis, rightYAxis].filter(axis => !!axis);

  // find min/max timestamp of *all* timeSeries
  const allBoundaries = props.plottables
    .flatMap(plottable => [plottable.start, plottable.end])
    .toSorted();
  const earliestTimeStamp = allBoundaries.at(0);
  const latestTimeStamp = allBoundaries.at(-1);

  const {
    connectReleaseBubbleChartRef,
    releaseBubbleSeries,
    releaseBubbleXAxis,
    releaseBubbleGrid,
    releaseBubbleYAxis,
  } = useReleaseBubbles({
    chartId: props.id,
    minTime: earliestTimeStamp ? new Date(earliestTimeStamp).getTime() : undefined,
    maxTime: latestTimeStamp ? new Date(latestTimeStamp).getTime() : undefined,
    releases: hasReleaseBubbles
      ? props.releases?.map(({timestamp, version}) => ({date: timestamp, version}))
      : [],
    yAxisIndex: yAxes.length,
  });

  if (releaseBubbleYAxis) {
    yAxes.push(releaseBubbleYAxis);
  }

  const releaseSeries =
    props.releases && props.showReleaseAs !== 'none'
      ? hasReleaseBubbles
        ? releaseBubbleSeries
        : ReleaseSeries(
            theme,
            props.releases,
            function onReleaseClick(release: Release) {
              navigate(
                makeReleaseDrawerPathname({
                  location,
                  release: release.version,
                  source: 'time-series-widget',
                })
              );
            },
            utc ?? false
          )
      : null;

  const hasReleaseBubblesSeries = hasReleaseBubbles && releaseSeries;

  const handleChartRef = useCallback(
    (e: ReactEchartsRef | null) => {
      if (!e?.getEchartsInstance) {
        return;
      }

      for (const plottable of props.plottables) {
        plottable.handleChartRef?.(e);
      }

      if (hasReleaseBubblesSeries) {
        connectReleaseBubbleChartRef(e);
      }
    },
    [hasReleaseBubblesSeries, connectReleaseBubbleChartRef, props.plottables]
  );

  const handleChartReady = useCallback(
    (instance: echarts.ECharts) => {
      onChartReadyZoom(instance);
      unregisterRef.current?.();
      unregisterRef.current = registerWithWidgetSyncContext(instance);
    },
    [onChartReadyZoom, registerWithWidgetSyncContext]
  );

  const showXAxisProp = props.showXAxis ?? 'auto';
  const showXAxis = showXAxisProp === 'auto';

  const xAxis = showXAxis
    ? {
        animation: false,
        axisLabel: {
          padding: [0, 10, 0, 10],
          width: 60,
          formatter: (value: number) => {
            return formatXAxisTimestamp(value, {utc: utc ?? undefined});
          },
        },
        splitNumber: 5,
        ...releaseBubbleXAxis,
      }
    : HIDDEN_X_AXIS;

  // Hiding the X axis removes all chart elements under the X axis line. This
  // will cut off the bottom of the lowest Y axis label. To create space for
  // that label, add some grid padding.
  const xAxisGrid = showXAxis ? {} : {bottom: 5};

  let visibleSeriesCount = props.plottables.length;
  if (releaseSeries) {
    visibleSeriesCount += 1;
  }

  const showLegendProp = props.showLegend ?? 'auto';
  const showLegend =
    (showLegendProp !== 'never' && visibleSeriesCount > 1) || showLegendProp === 'always';

  const thresholdMaxOffset = 10;

  // Keep track of which `Series[]` indexes correspond to which `Plottable` so
  // we can look up the types in the tooltip. We need this so we can find the
  // plottable responsible for a given value in the tooltip formatter. The only
  // tool ECharts gives us is the `seriesIndex` properly. Any given `Plottable`
  // can be mapped to 1 or more `Series`, so we need to maintain a reverse
  // lookup
  let seriesIndex = 0;
  const seriesIndexToPlottableMapRanges: Array<Range<Plottable>> = [];

  // Keep track of what color in the chosen palette we're assigning
  let seriesColorIndex = 0;
  const seriesFromPlottables: SeriesOption[] = props.plottables.flatMap(plottable => {
    let color: string | undefined;

    if (plottable.needsColor) {
      // For any timeseries in need of a color, pull from the chart palette
      color = palette[seriesColorIndex % palette.length]!; // Mod the index in case the number of plottables exceeds the palette length
      seriesColorIndex += 1;
    }

    let yAxisPosition: 'left' | 'right' = 'left';

    if (leftYAxisDataTypes.includes(plottable.dataType)) {
      // This plottable is assigned to the left axis
      yAxisPosition = 'left';
    } else if (rightYAxisDataTypes.includes(plottable.dataType)) {
      // This plottable is assigned to the right axis
      yAxisPosition = 'right';
    } else {
      // This plottable's type isn't assignned to either axis! Mysterious.
      // There's no graceful way to handle this.
      Sentry.withScope(scope => {
        const message =
          '`TimeSeriesWidgetVisualization` Could not assign Plottable to an axis';

        scope.setFingerprint(['could-not-assign-plottable-to-an-axis']);
        Sentry.captureException(new Error(message));

        error(message, {
          dataType: plottable.dataType,
          leftAxisType: leftYAxisType,
          rightAxisType: rightYAxisType,
        });
      });
    }

    // TODO: Type checking would be welcome here, but `plottingOptions` is unknown, since it depends on the implementation of the `Plottable` interface
    const seriesOfPlottable = plottable.toSeries({
      color,
      yAxisPosition,
      unit: unitForType[plottable.dataType ?? FALLBACK_TYPE],
      theme,
      maxOffset: thresholdMaxOffset,
    });

    seriesIndexToPlottableMapRanges.push({
      min: seriesIndex,
      max: seriesIndex + seriesOfPlottable.length,
      value: plottable,
    });
    seriesIndex += seriesOfPlottable.length;

    return seriesOfPlottable;
  });

  const seriesIndexToPlottableRangeMap = new RangeMap<Plottable>(
    seriesIndexToPlottableMapRanges
  );

  // Local legend selection state used when the parent doesn't manage it
  const [localLegendSelection, setLocalLegendSelection] = useState<
    Record<string, boolean>
  >({});
  const legendSelection = props.legendSelection ?? localLegendSelection;
  const {onLegendSelectionChange} = props;
  const handleLegendSelectionChange = useCallback(
    (selection: Record<string, boolean>) => {
      setLocalLegendSelection(selection);
      onLegendSelectionChange?.(selection);
    },
    [onLegendSelectionChange]
  );

  // Build legend items by extracting colors from the generated ECharts
  // series. This is the single source of truth for color — we avoid
  // re-deriving palette assignments so legend swatches can never diverge
  // from the actual chart series. Some plottables (e.g. Samples) use a
  // callback function for itemStyle.color; in that case we fall back to
  // a neutral theme color for the legend swatch.
  const chartLegendItems: LegendItem[] = props.plottables.map(plottable => {
    const series = seriesFromPlottables.find(s => s.name === plottable.name);
    const seriesColor =
      (series as {color?: unknown})?.color ??
      (series as {itemStyle?: {color?: unknown}})?.itemStyle?.color;
    const color = typeof seriesColor === 'string' ? seriesColor : theme.colors.gray300;
    return {
      name: plottable.name,
      label: plottable.label,
      color,
    };
  });

  if (releaseSeries) {
    const releaseName = typeof releaseSeries.name === 'string' ? releaseSeries.name : '';
    const releaseColor =
      typeof releaseSeries.color === 'string' ? releaseSeries.color : '';
    chartLegendItems.push({
      name: releaseName,
      label: releaseName,
      color: releaseColor,
    });
  }

  const allSeries = [...seriesFromPlottables, releaseSeries].filter(defined);

  const runHandler = (
    batch: {dataIndex: number; seriesIndex?: number},
    handlerName: 'onClick' | 'onHighlight' | 'onDownplay'
  ): void => {
    if (batch.seriesIndex === undefined) {
      return;
    }

    const affectedRange = seriesIndexToPlottableRangeMap.getRange(batch.seriesIndex);
    const affectedPlottable = affectedRange?.value;

    if (
      !defined(affectedRange) ||
      !defined(affectedPlottable) ||
      !defined(affectedPlottable[handlerName])
    ) {
      return;
    }

    affectedPlottable[handlerName](
      getPlottableEventDataIndex(allSeries, batch, affectedRange)
    );
  };

  const handleClick: EChartClickHandler = event => {
    runHandler(event, 'onClick');
  };

  const handleHighlight: EChartHighlightHandler = event => {
    // Unlike click events, highlights happen to potentially more than one
    // series at a time. We have to iterate each item in the batch
    for (const batch of event.batch ?? []) {
      runHandler(batch, 'onHighlight');
    }
  };

  const handleDownplay: EChartDownplayHandler = event => {
    // Unlike click events, downplays happen to potentially more than one
    // series at a time. We have to iterate each item in the batch
    for (const batch of event.batch ?? []) {
      // Downplay events sometimes trigger for the entire series, rather than
      // for individual points. We are ignoring these. It's not clear why or
      // when they are called, but they appear to be redundant.
      if (defined(batch.dataIndex) && defined(batch.seriesIndex)) {
        runHandler(batch, 'onDownplay');
      }
    }
  };

  return (
    <Flex direction="column" height="100%">
      {ActionMenu}
      {showLegend && (
        <ChartLegend
          items={chartLegendItems}
          selected={legendSelection}
          onSelectionChange={handleLegendSelectionChange}
        />
      )}
      <Container flex="1 1 0%" minHeight="0">
        <BaseChart
          ref={mergeRefs(props.ref, props.chartRef, chartRef, handleChartRef)}
          autoHeightResize
          series={allSeries}
          grid={{
            // NOTE: Adding a few pixels of left padding prevents ECharts from
            // incorrectly truncating long labels. See
            // https://github.com/apache/echarts/issues/15562
            left: 2,
            top: 10,
            right: 8,
            bottom: 0,
            containLabel: true,
            ...releaseBubbleGrid,
            ...xAxisGrid,
          }}
          legend={
            showLegend
              ? {
                  show: false,
                  selected: legendSelection,
                }
              : undefined
          }
          onLegendSelectChanged={event => {
            handleLegendSelectionChange(event.selected);
          }}
          tooltip={{
            appendToBody: true,
            trigger: 'axis',
            axisPointer: {
              type: 'cross',
            },
            formatter: formatTooltip,
          }}
          xAxis={xAxis}
          yAxes={yAxes}
          {...chartZoomProps}
          onDataZoom={props.onZoom ?? onDataZoom}
          toolBox={toolBox ?? chartZoomProps.toolBox}
          brush={brush}
          onBrushStart={onBrushStart}
          onBrushEnd={onBrushEnd}
          onChartReady={handleChartReady}
          isGroupedByDate
          useMultilineDate
          start={start ? new Date(start) : undefined}
          end={end ? new Date(end) : undefined}
          period={period}
          utc={utc ?? undefined}
          onHighlight={handleHighlight}
          onDownplay={handleDownplay}
          onClick={handleClick}
        />
      </Container>
    </Flex>
  );
}

/**
 * Each plottable creates anywhere from 1 to N `Series` objects. When an event fires on a `Series` object, ECharts reports a `dataIndex`. This index won't match the data inside inside the original `Plottable`, since it produced more than on `Series`. To map backwards, we need to calculate an offset, based on how many other `Series` this plottable produced.
 *
 * e.g., If this is the third series of the plottable, the data index in the plottable needs to be offset by the data counts of the first two.
 *
 * @param series All series plotted on the chart
 * @param affectedRange The range of series that the plottable is responsible for
 * @param seriesIndex The index of the series where the event fires
 * @returns The offset, as a number, of how many points the previous series are responsible for
 */
function getPlottableEventDataIndex(
  series: SeriesOption[],
  event: {
    dataIndex: number;
    seriesIndex?: number;
  },
  affectedRange: Range<Plottable>
): number {
  const {dataIndex, seriesIndex} = event;

  const dataIndexOffset = sum(
    series.slice(affectedRange.min ?? 0, seriesIndex).map(seriesOfPlottable => {
      return Array.isArray(seriesOfPlottable.data) ? seriesOfPlottable.data.length : 0;
    })
  );

  return dataIndexOffset + dataIndex;
}

// Hide every part of the axis so ECharts will remove those elements and also
// remove the visual space they would take up if they were there.
const HIDDEN_X_AXIS = {
  show: false,
  splitLine: {show: false},
  axisLine: {show: false},
  axisTick: {show: false},
  axisLabel: {show: false},
};

TimeSeriesWidgetVisualization.LoadingPlaceholder = WidgetLoadingPanel;
