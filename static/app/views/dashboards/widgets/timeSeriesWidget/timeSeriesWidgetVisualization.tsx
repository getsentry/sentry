import {useCallback, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {SeriesOption} from 'echarts';
import type {
  TooltipFormatterCallback,
  TopLevelFormatterParams,
} from 'echarts/types/dist/shared';
import type EChartsReactCore from 'echarts-for-react/lib/core';

import BaseChart from 'sentry/components/charts/baseChart';
import {getFormatter} from 'sentry/components/charts/components/tooltip';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import {isChartHovered, truncationFormatter} from 'sentry/components/charts/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {getChartColorPalette} from 'sentry/constants/chartPalette';
import type {EChartDataZoomHandler, ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {uniq} from 'sentry/utils/array/uniq';
import type {
  AggregationOutputType,
  DurationUnit,
  RateUnit,
  SizeUnit,
} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';

import {useWidgetSyncContext} from '../../contexts/widgetSyncContext';
import {NO_PLOTTABLE_VALUES, X_GUTTER, Y_GUTTER} from '../common/settings';
import type {Aliases, LegendSelection, Release} from '../common/types';

import type {Plottable} from './plottables/plottable';
import {formatSeriesName} from './formatSeriesName';
import {formatTooltipValue} from './formatTooltipValue';
import {formatXAxisTimestamp} from './formatXAxisTimestamp';
import {formatYAxisValue} from './formatYAxisValue';
import {ReleaseSeries} from './releaseSeries';
import {FALLBACK_TYPE, FALLBACK_UNIT_FOR_FIELD_TYPE} from './settings';

export interface TimeSeriesWidgetVisualizationProps {
  /**
   * An array of `Plottable` objects. This can be any object that implements the `Plottable` interface.
   */
  plottables: Plottable[];
  /**
   * A mapping of time series fields to their user-friendly labels, if needed
   */
  aliases?: Aliases;
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
  /**
   * Array of `Release` objects. If provided, they are plotted on line and area visualizations as vertical lines
   */
  releases?: Release[];
}

export function TimeSeriesWidgetVisualization(props: TimeSeriesWidgetVisualizationProps) {
  if (props.plottables.every(plottable => plottable.isEmpty)) {
    throw new Error(NO_PLOTTABLE_VALUES);
  }

  // TODO: It would be polite to also scan for gaps (i.e., the items don't all
  // have the same difference in `timestamp`s) even though this is rare, since
  // the backend zerofills the data

  const chartRef = useRef<EChartsReactCore | null>(null);
  const {register: registerWithWidgetSyncContext} = useWidgetSyncContext();

  const pageFilters = usePageFilters();
  const {start, end, period, utc} = pageFilters.selection.datetime;

  const theme = useTheme();
  const organization = useOrganization();
  const navigate = useNavigate();

  const releaseSeries =
    props.releases &&
    ReleaseSeries(
      theme,
      props.releases,
      function onReleaseClick(release: Release) {
        navigate(
          makeReleasesPathname({
            organization,
            path: `/${encodeURIComponent(release.version)}/`,
          })
        );
      },
      utc ?? false
    );

  const handleChartRef = useCallback(
    (e: ReactEchartsRef) => {
      chartRef.current = e;

      if (e?.getEchartsInstance) {
        registerWithWidgetSyncContext(e.getEchartsInstance());
      }
    },
    [registerWithWidgetSyncContext]
  );

  const chartZoomProps = useChartZoom({
    saveOnZoom: true,
  });

  // Determine our chart Y axis type and units
  let yAxisFieldType: AggregationOutputType;

  const types = uniq(
    props.plottables.map(plottable => {
      return plottable.dataType;
    })
  ).filter(Boolean);

  if (types.length === 1) {
    // All timeseries have the same type. Use that as the Y axis type.
    yAxisFieldType = types[0]!;
  } else {
    // Types are mismatched or missing. Use a fallback type
    yAxisFieldType = FALLBACK_TYPE;
  }

  let yAxisUnit: DurationUnit | SizeUnit | RateUnit | null;

  // N.B. Do not filter `boolean` because `null` is a valid unit
  const units = uniq(props.plottables.map(plottable => plottable.dataUnit));

  if (units.length === 1) {
    // All timeseries have the same unit. Use that unit. This is especially
    // important for named rate timeseries like `"epm()"` where the user would
    // expect a plot in minutes
    yAxisUnit = units[0]!;
  } else {
    // None of the series specified a unit, or there are mismatched units. Fall
    // back to an appropriate unit for the axis type
    yAxisUnit = FALLBACK_UNIT_FOR_FIELD_TYPE[yAxisFieldType];
  }

  // Set up a fallback palette for any plottable without a color
  const paletteSize = props.plottables.filter(plottable => plottable.needsColor).length;

  const palette =
    paletteSize > 0
      ? getChartColorPalette(paletteSize - 2)! // -2 because getColorPalette artificially adds 1, I'm not sure why
      : [];

  // Assign fallback colors if needed
  let seriesColorIndex = 0;
  const series: SeriesOption[] = props.plottables.flatMap(plottable => {
    let color: string | undefined;

    if (plottable.needsColor) {
      // For any timeseries in need of a color, pull from the chart palette
      color = palette[seriesColorIndex % palette.length]!; // Mod the index in case the number of plottables exceeds the palette length
      seriesColorIndex += 1;
    }

    // TODO: Type checking would be welcome here, but `plottingOptions` is unknown, since it depends on the implementation of the `Plottable` interface
    return plottable.toSeries({
      unit: yAxisUnit,
      color,
    });
  });

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
      valueFormatter: (value, field) => {
        if (!field) {
          return formatTooltipValue(value, FALLBACK_TYPE);
        }

        return formatTooltipValue(value, yAxisFieldType, yAxisUnit ?? undefined);
      },
      nameFormatter: seriesName => {
        return props.aliases?.[seriesName] ?? formatSeriesName(seriesName);
      },
      truncate: true,
      utc: utc ?? false,
    })(deDupedParams, asyncTicket);
  };

  let visibleSeriesCount = props.plottables.length;
  if (releaseSeries) {
    visibleSeriesCount += 1;
  }

  const showLegend = visibleSeriesCount > 1;

  return (
    <BaseChart
      ref={handleChartRef}
      autoHeightResize
      series={[...series, releaseSeries].filter(defined)}
      grid={{
        // NOTE: Adding a few pixels of left padding prevents ECharts from
        // incorrectly truncating long labels. See
        // https://github.com/apache/echarts/issues/15562
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
                  props.aliases?.[seriesName] ?? formatSeriesName(seriesName),
                  true,
                  // Escaping the legend string will cause some special
                  // characters to render as their HTML equivalents.
                  // So disable it here.
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
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        formatter: formatTooltip,
      }}
      xAxis={{
        animation: false,
        axisLabel: {
          padding: [0, 10, 0, 10],
          width: 60,
          formatter: (value: number) => {
            const string = formatXAxisTimestamp(value, {utc: utc ?? undefined});

            // Adding whitespace around the label is equivalent to padding.
            // ECharts doesn't respect padding when calculating overlaps, but it
            // does respect whitespace. This prevents overlapping X axis labels
            return ` ${string} `;
          },
        },
        splitNumber: 5,
      }}
      yAxis={{
        animation: false,
        axisLabel: {
          formatter(value: number) {
            return formatYAxisValue(value, yAxisFieldType, yAxisUnit ?? undefined);
          },
        },
        axisPointer: {
          type: 'line',
          snap: false,
          lineStyle: {
            type: 'solid',
            width: 0.5,
          },
          label: {
            show: false,
          },
        },
      }}
      {...chartZoomProps}
      {...(props.onZoom ? {onDataZoom: props.onZoom} : {})}
      isGroupedByDate
      useMultilineDate
      start={start ? new Date(start) : undefined}
      end={end ? new Date(end) : undefined}
      period={period}
      utc={utc ?? undefined}
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

  padding: ${Y_GUTTER} ${X_GUTTER};
`;

const LoadingMask = styled(TransparentLoadingMask)`
  background: ${p => p.theme.background};
`;

TimeSeriesWidgetVisualization.LoadingPlaceholder = LoadingPanel;
