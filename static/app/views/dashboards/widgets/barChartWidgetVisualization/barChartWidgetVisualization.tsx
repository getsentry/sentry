import {Fragment, useCallback, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';
import dompurify from 'dompurify';
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
import {useRenderToString} from 'sentry/components/core/renderToString';
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
import type {
  CategoricalItem,
  LegendSelection,
} from 'sentry/views/dashboards/widgets/common/types';
import {formatTooltipValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTooltipValue';
import {formatYAxisValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisValue';

import type {CategoricalBarChartPlottable} from './plottables/bars';
import {FALLBACK_TYPE, FALLBACK_UNIT_FOR_FIELD_TYPE} from './settings';

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
  plottable: CategoricalBarChartPlottable;
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
  plottables: CategoricalBarChartPlottable[];
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
  /**
   * Truncate the category labels.
   */
  truncateCategoryLabels?: number | boolean;
}

export function BarChartWidgetVisualization(props: BarChartWidgetVisualizationProps) {
  if (props.plottables.every(plottable => plottable.isEmpty)) {
    throw new Error(NO_PLOTTABLE_VALUES);
  }

  const chartRef = useRef<ReactEchartsRef | null>(null);
  const {register: registerWithWidgetSyncContext} = useWidgetSyncContext();
  const theme = useTheme();
  const renderToString = useRenderToString();

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

  // Configure the Y axis (value axis)
  const yAxis: YAXisComponentOption = {
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

  // Configure the X axis (category axis)
  const xAxis: XAXisComponentOption = {
    type: 'category',
    data: allCategories,
    axisLabel: {
      formatter: (value: string) =>
        truncationFormatter(
          value,
          props.truncateCategoryLabels ? props.truncateCategoryLabels : true,
          false
        ),
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

  // Set up color palette for plottables without explicit colors
  const paletteSize = props.plottables.filter(plottable => plottable.needsColor).length;
  const palette = paletteSize > 0 ? theme.chart.getColorPalette(paletteSize - 1) : [];

  // Create aliases lookup for tooltips and legends
  const aliases = Object.fromEntries(
    props.plottables.map(plottable => [plottable.name, plottable.label])
  );

  // Track series index to plottable mapping for tooltip formatting
  let seriesIndex = 0;
  const seriesIndexToPlottableMapRanges: Array<Range<CategoricalBarChartPlottable>> = [];

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

  const seriesIndexToPlottableRangeMap = new RangeMap<CategoricalBarChartPlottable>(
    seriesIndexToPlottableMapRanges
  );

  /**
   * Extract the numeric value from ECharts data format.
   * Data is always {name: string, value: number} or just a number.
   */
  function extractValue(data: unknown): number | null {
    if (data === null || data === undefined) {
      return null;
    }

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

    // Build tooltip content using React components
    const filteredParams = seriesParams.filter(param => {
      const value = extractValue(param.value);
      return value !== null;
    });

    return renderToString(
      <Fragment>
        <div className="tooltip-series">
          {filteredParams.map(param => {
            const seriesName = param.seriesName ?? '';
            const displayName = truncationFormatter(
              aliases[seriesName] ?? seriesName,
              true,
              false
            );

            const numericValue = extractValue(param.value);

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

            // param.marker is an HTML string with a colored circle, sanitize it
            const marker = typeof param.marker === 'string' ? param.marker : '';

            return (
              <div key={param.seriesIndex}>
                <span className="tooltip-label">
                  <span dangerouslySetInnerHTML={{__html: dompurify.sanitize(marker)}} />{' '}
                  <strong>{displayName}</strong>
                </span>{' '}
                {formattedValue}
              </div>
            );
          })}
        </div>
        <div className="tooltip-footer tooltip-footer-centered">
          {truncationFormatter(categoryName, true, false)}
        </div>
        <div className="tooltip-arrow" />
      </Fragment>
    );
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
        // Use event.name which contains the category label from ECharts,
        // not allCategories[event.dataIndex] which would be incorrect when
        // plottables have different category sets
        const categoryLabel = event.name;
        if (!defined(categoryLabel) || typeof categoryLabel !== 'string') return;

        const value = extractValue(event.value);
        const categoricalItem: CategoricalItem = {category: categoryLabel, value};

        if (plottable.categories.includes(categoryLabel)) {
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
