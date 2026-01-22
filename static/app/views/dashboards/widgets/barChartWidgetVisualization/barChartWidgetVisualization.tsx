import {useCallback, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';
import type {SeriesOption, XAXisComponentOption, YAXisComponentOption} from 'echarts';
import type {
  TooltipFormatterCallback,
  TopLevelFormatterParams,
} from 'echarts/types/dist/shared';
import groupBy from 'lodash/groupBy';
import mapValues from 'lodash/mapValues';

import BaseChart from 'sentry/components/charts/baseChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {isChartHovered, truncationFormatter} from 'sentry/components/charts/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {space} from 'sentry/styles/space';
import type {
  EChartClickHandler,
  EChartDownplayHandler,
  EChartHighlightHandler,
  ReactEchartsRef,
} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {uniq} from 'sentry/utils/array/uniq';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {RangeMap, type Range} from 'sentry/utils/number/rangeMap';
import {useWidgetSyncContext} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {
  NO_PLOTTABLE_VALUES,
  X_GUTTER,
  Y_GUTTER,
} from 'sentry/views/dashboards/widgets/common/settings';
import type {LegendSelection} from 'sentry/views/dashboards/widgets/common/types';
import {formatTooltipValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTooltipValue';
import {formatYAxisValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisValue';

import type {BarPlottable} from './plottables';
import {FALLBACK_TYPE, FALLBACK_UNIT_FOR_FIELD_TYPE} from './settings';
import type {CategoricalItem} from './types';

/**
 * Event data passed to the onBarClick callback.
 */
export interface BarClickEvent {
  /**
   * The clicked bar's category and value.
   */
  item: CategoricalItem;
  /**
   * The plottable this bar belongs to.
   */
  plottable: BarPlottable;
  /**
   * Click position relative to chart DOM (for floating menu positioning).
   */
  position: {x: number; y: number};
  /**
   * Series field name.
   */
  seriesName: string;
}

export interface BarChartWidgetVisualizationProps {
  /**
   * An array of `BarPlottable` objects to render on the chart.
   */
  plottables: BarPlottable[];
  /**
   * Reference to the chart instance.
   */
  chartRef?: React.Ref<ReactEchartsRef>;
  /**
   * A mapping of series name to boolean. If the value is `false`, the series is hidden.
   */
  legendSelection?: LegendSelection;
  /**
   * Callback when user clicks a bar. Provides data and position for action menus.
   */
  onBarClick?: (event: BarClickEvent) => void;
  /**
   * Callback that returns an updated `LegendSelection` after user manipulation.
   */
  onLegendSelectionChange?: (selection: LegendSelection) => void;
  /**
   * The orientation of the bars.
   * - `vertical`: Categories on X-axis, values on Y-axis (default)
   * - `horizontal`: Values on X-axis, categories on Y-axis
   */
  orientation?: 'vertical' | 'horizontal';
  /**
   * React ref for the chart.
   */
  ref?: React.Ref<ReactEchartsRef>;
  /**
   * Defines the legend's visibility.
   * - `auto`: Show the legend if there are multiple series.
   * - `never`: Never show the legend.
   * - `always`: Always show the legend.
   */
  showLegend?: 'auto' | 'never' | 'always';
}

export function BarChartWidgetVisualization(props: BarChartWidgetVisualizationProps) {
  if (props.plottables.every(plottable => plottable.isEmpty)) {
    throw new Error(NO_PLOTTABLE_VALUES);
  }

  const chartRef = useRef<ReactEchartsRef | null>(null);
  const {register: registerWithWidgetSyncContext} = useWidgetSyncContext();
  const theme = useTheme();

  const orientation = props.orientation ?? 'vertical';
  const isHorizontal = orientation === 'horizontal';

  // Group plottables by their data type
  const plottablesByType = groupBy(props.plottables, plottable => plottable.dataType);

  // Count field types
  const fieldTypeCounts = mapValues(plottablesByType, plottables => plottables.length);

  // Sort field types by frequency
  const axisTypes = Object.keys(fieldTypeCounts)
    .toSorted((a, b) => fieldTypeCounts[b]! - fieldTypeCounts[a]!)
    .filter(axisType => !!axisType);

  // Use the most common type for the value axis
  const valueAxisType = axisTypes.length > 0 ? axisTypes[0]! : FALLBACK_TYPE;

  // Create a map of units by plottable data type
  const unitsByType = mapValues(plottablesByType, plottables =>
    uniq(plottables.map(plottable => plottable.dataUnit))
  );

  // Narrow down to one unit per data type
  const unitForType = mapValues(unitsByType, (relevantUnits, type) => {
    if (relevantUnits.length === 1) {
      return relevantUnits[0]!;
    }
    return FALLBACK_UNIT_FOR_FIELD_TYPE[type as AggregationOutputType];
  });

  // Extract all unique categories from all plottables
  const allCategories = uniq(props.plottables.flatMap(plottable => plottable.categories));

  // Configure the value axis (Y for vertical, X for horizontal)
  const valueAxisConfig: YAXisComponentOption | XAXisComponentOption = {
    type: 'value',
    axisLabel: {
      formatter: (value: number) =>
        formatYAxisValue(value, valueAxisType, unitForType[valueAxisType] ?? undefined),
    },
    splitLine: {
      lineStyle: {
        color: theme.tokens.border.secondary,
      },
    },
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
  };

  // Configure the category axis (X for vertical, Y for horizontal)
  const categoryAxisConfig: XAXisComponentOption | YAXisComponentOption = {
    type: 'category',
    data: allCategories,
    axisLabel: {
      formatter: (value: string) => truncationFormatter(value, true, false),
    },
    axisLine: {
      lineStyle: {
        color: theme.tokens.border.secondary,
      },
    },
    axisTick: {
      alignWithLabel: true,
    },
  };

  // Set up axes based on orientation
  const xAxis: XAXisComponentOption = isHorizontal
    ? (valueAxisConfig as XAXisComponentOption)
    : (categoryAxisConfig as XAXisComponentOption);

  const yAxis: YAXisComponentOption = isHorizontal
    ? (categoryAxisConfig as YAXisComponentOption)
    : (valueAxisConfig as YAXisComponentOption);

  // Set up color palette for plottables without explicit colors
  const paletteSize = props.plottables.filter(plottable => plottable.needsColor).length;
  const palette = paletteSize > 0 ? theme.chart.getColorPalette(paletteSize - 1) : [];

  // Create aliases lookup for tooltips and legends
  const aliases = Object.fromEntries(
    props.plottables.map(plottable => [plottable.name, plottable.label])
  );

  // Track series index to plottable mapping for tooltip formatting
  let seriesIndex = 0;
  const seriesIndexToPlottableMapRanges: Array<Range<BarPlottable>> = [];

  // Track color assignment
  let seriesColorIndex = 0;
  const seriesFromPlottables: SeriesOption[] = props.plottables.flatMap(plottable => {
    let color: string | undefined;

    if (plottable.needsColor) {
      color = palette[seriesColorIndex % palette.length]!;
      seriesColorIndex += 1;
    }

    const seriesOfPlottable = plottable.toSeries({
      color,
      orientation,
      unit: unitForType[plottable.dataType ?? FALLBACK_TYPE],
      theme,
    });

    seriesIndexToPlottableMapRanges.push({
      min: seriesIndex,
      max: seriesIndex + seriesOfPlottable.length,
      value: plottable,
    });
    seriesIndex += seriesOfPlottable.length;

    return seriesOfPlottable;
  });

  const seriesIndexToPlottableRangeMap = new RangeMap<BarPlottable>(
    seriesIndexToPlottableMapRanges
  );

  /**
   * Extract the numeric value from ECharts data format.
   * For vertical bars: {name: string, value: number} or just number
   * For horizontal bars: [value, label] array
   */
  function extractValue(
    data: unknown,
    currentOrientation: 'vertical' | 'horizontal'
  ): number | null {
    if (data === null || data === undefined) {
      return null;
    }

    // For horizontal bars, data is [value, label]
    if (currentOrientation === 'horizontal' && Array.isArray(data)) {
      return typeof data[0] === 'number' ? data[0] : null;
    }

    // For vertical bars, data might be {name, value} or just a number
    if (typeof data === 'number') {
      return data;
    }

    if (typeof data === 'object' && 'value' in data) {
      const val = (data as {value: unknown}).value;
      return typeof val === 'number' ? val : null;
    }

    return null;
  }

  // Create tooltip formatter for categorical bar charts
  const formatTooltip: TooltipFormatterCallback<TopLevelFormatterParams> = params => {
    if (!isChartHovered(chartRef?.current)) {
      return '';
    }

    const seriesParams = Array.isArray(params) ? params : [params];

    // Get the category name from the first param
    const categoryName = seriesParams[0]?.name ?? '';

    // Build tooltip content
    const seriesHtml = seriesParams
      .filter(param => {
        const value = extractValue(param.value, orientation);
        return value !== null;
      })
      .map(param => {
        const seriesName = param.seriesName ?? '';
        const displayName = truncationFormatter(
          aliases[seriesName] ?? seriesName,
          true,
          false
        );

        const numericValue = extractValue(param.value, orientation);

        // Format the value based on the plottable's data type
        let formattedValue: string;
        if (numericValue !== null && defined(param.seriesIndex)) {
          const correspondingPlottable = seriesIndexToPlottableRangeMap.get(
            param.seriesIndex
          );
          const fieldType = correspondingPlottable?.dataType ?? FALLBACK_TYPE;
          formattedValue = formatTooltipValue(
            numericValue,
            fieldType,
            unitForType[fieldType] ?? undefined
          );
        } else {
          formattedValue = numericValue?.toLocaleString() ?? '';
        }

        // param.marker is an HTML string with a colored circle
        const marker = typeof param.marker === 'string' ? param.marker : '';

        return `<div><span class="tooltip-label">${marker} <strong>${displayName}</strong></span> ${formattedValue}</div>`;
      })
      .join('');

    return [
      `<div class="tooltip-series">${seriesHtml}</div>`,
      '<div class="tooltip-footer tooltip-footer-centered">',
      truncationFormatter(categoryName, true, false),
      '</div>',
      '<div class="tooltip-arrow"></div>',
    ].join('');
  };

  // Event handlers
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

    affectedPlottable[handlerName](batch.dataIndex);
  };

  const handleClick: EChartClickHandler = event => {
    runHandler(event, 'onClick');

    // Call visualization-level onBarClick callback if provided
    if (props.onBarClick && event.seriesIndex !== undefined) {
      const plottable = seriesIndexToPlottableRangeMap.get(event.seriesIndex);
      if (plottable) {
        const item = allCategories[event.dataIndex];
        const categoricalItem = plottable.categories.includes(item)
          ? {label: item, value: event.value as number | null}
          : undefined;

        if (categoricalItem) {
          // Access the native event for position data
          // ECharts attaches the native event to params.event
          const nativeEvent = (event as {event?: {offsetX?: number; offsetY?: number}})
            .event;

          props.onBarClick({
            item: categoricalItem,
            plottable,
            seriesName: event.seriesName ?? plottable.name,
            position: {
              x: nativeEvent?.offsetX ?? 0,
              y: nativeEvent?.offsetY ?? 0,
            },
          });
        }
      }
    }
  };

  const handleHighlight: EChartHighlightHandler = event => {
    for (const batch of event.batch ?? []) {
      runHandler(batch, 'onHighlight');
    }
  };

  const handleDownplay: EChartDownplayHandler = event => {
    for (const batch of event.batch ?? []) {
      if (defined(batch.dataIndex) && defined(batch.seriesIndex)) {
        runHandler(batch, 'onDownplay');
      }
    }
  };

  const handleChartRef = useCallback(
    (e: ReactEchartsRef | null) => {
      if (!e?.getEchartsInstance) {
        return;
      }

      for (const plottable of props.plottables) {
        plottable.handleChartRef?.(e);
      }
    },
    [props.plottables]
  );

  const handleChartReady = useCallback(
    (instance: echarts.ECharts) => {
      registerWithWidgetSyncContext(instance);
    },
    [registerWithWidgetSyncContext]
  );

  // Legend visibility
  const showLegendProp = props.showLegend ?? 'auto';
  const showLegend =
    (showLegendProp !== 'never' && props.plottables.length > 1) ||
    showLegendProp === 'always';

  return (
    <BaseChart
      ref={mergeRefs(props.ref, props.chartRef, chartRef, handleChartRef)}
      autoHeightResize
      series={seriesFromPlottables}
      grid={{
        left: 2,
        top: showLegend ? 25 : 10,
        right: 8,
        bottom: 0,
        containLabel: true,
      }}
      legend={
        showLegend
          ? {
              top: 0,
              left: 0,
              formatter(seriesName: string) {
                return truncationFormatter(
                  aliases[seriesName] ?? seriesName,
                  true,
                  false
                );
              },
              selected: props.legendSelection,
            }
          : undefined
      }
      onLegendSelectChanged={event => {
        props?.onLegendSelectionChange?.(event.selected);
      }}
      tooltip={{
        appendToBody: true,
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: formatTooltip,
      }}
      xAxis={xAxis}
      yAxis={yAxis}
      onChartReady={handleChartReady}
      onHighlight={handleHighlight}
      onDownplay={handleDownplay}
      onClick={handleClick}
    />
  );
}

function LoadingPanel() {
  return (
    <LoadingPlaceholder>
      <LoadingMask visible />
      <LoadingIndicator mini />
    </LoadingPlaceholder>
  );
}

const LoadingPlaceholder = styled('div')`
  position: absolute;
  inset: 0;

  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: ${space(1)};

  padding: ${Y_GUTTER} ${X_GUTTER};
`;

const LoadingMask = styled(TransparentLoadingMask)`
  background: ${p => p.theme.tokens.background.primary};
`;

BarChartWidgetVisualization.LoadingPlaceholder = LoadingPanel;
