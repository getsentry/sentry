import {useCallback, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
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
import type {Aliases, LegendSelection, Release, TimeSeries} from '../common/types';

import {formatSeriesName} from './formatters/formatSeriesName';
import {formatTooltipValue} from './formatters/formatTooltipValue';
import {formatXAxisTimestamp} from './formatters/formatXAxisTimestamp';
import {formatYAxisValue} from './formatters/formatYAxisValue';
import {Area} from './plottables/area';
import {Bars} from './plottables/bars';
import {Line} from './plottables/line';
import {isTimeSeriesOther} from './isTimeSeriesOther';
import {ReleaseSeries} from './releaseSeries';
import {FALLBACK_TYPE, FALLBACK_UNIT_FOR_FIELD_TYPE} from './settings';

type VisualizationType = 'area' | 'line' | 'bar';

export interface TimeSeriesWidgetVisualizationProps {
  /**
   * An array of time series, each one representing a changing value over time. This is the chart's data. See documentation for examples
   */
  timeSeries: Array<Readonly<TimeSeries>>;
  /**
   * Chart type
   */
  visualizationType: VisualizationType;
  /**
   * A mapping of time series fields to their user-friendly labels, if needed
   */
  aliases?: Aliases;
  /**
   * A duration in seconds. Any items in the time series that fall within that duration of the current time will be visually marked as "incomplete"
   */
  dataCompletenessDelay?: number;
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
  /**
   * Only available for `visualizationType="bar"`. If `true`, the bars are stacked
   */
  stacked?: boolean;
}

export function TimeSeriesWidgetVisualization(props: TimeSeriesWidgetVisualizationProps) {
  if (
    props.timeSeries
      .flatMap(timeSeries => timeSeries.data)
      .every(item => item.value === null)
  ) {
    throw new Error(NO_PLOTTABLE_VALUES);
  }

  // TODO: It would be polite to also scan for gaps (i.e., the items don't all
  // have the same difference in `timestamp`s) even though this is rare, since
  // the backend zerofills the data

  const chartRef = useRef<EChartsReactCore | null>(null);
  const {register: registerWithWidgetSyncContext} = useWidgetSyncContext();

  const pageFilters = usePageFilters();
  const {start, end, period, utc} = pageFilters.selection.datetime;

  const dataCompletenessDelay = props.dataCompletenessDelay ?? 0;

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

  // TODO: The `meta.fields` property should be typed as
  // Record<string, AggregationOutputType | null>, which is the reality
  let yAxisFieldType: AggregationOutputType;

  const types = uniq(
    props.timeSeries.map(timeSeries => {
      return timeSeries?.meta?.fields?.[timeSeries.field];
    })
  ).filter(Boolean) as AggregationOutputType[];

  if (types.length === 1) {
    // All timeseries have the same type. Use that as the Y axis type.
    yAxisFieldType = types[0]!;
  } else {
    // Types are mismatched or missing. Use a fallback type
    yAxisFieldType = FALLBACK_TYPE;
  }

  let yAxisUnit: DurationUnit | SizeUnit | RateUnit | null;

  const units = uniq(
    props.timeSeries.map(timeSeries => {
      return timeSeries?.meta?.units?.[timeSeries.field];
    })
  ) as Array<DurationUnit | SizeUnit | RateUnit | null>;

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

  // Construct plottable items
  const numberOfSeriesNeedingColor = props.timeSeries.filter(needsColor).length;

  const palette =
    numberOfSeriesNeedingColor > 0
      ? getChartColorPalette(numberOfSeriesNeedingColor - 2)! // -2 because getColorPalette artificially adds 1, I'm not sure why
      : [];

  let seriesColorIndex = 0;
  const plottables = props.timeSeries.map(timeSeries => {
    let color: string;

    if (timeSeries.color) {
      // If the provided timeseries have a `color` property, preserve that color.
      color = timeSeries.color;
    } else if (isTimeSeriesOther(timeSeries)) {
      // "Other" series, unless otherwise specified, have a predefined color
      color = theme.chartOther;
    } else {
      // For any timeseries in need of a color, pull from the chart palette
      color = palette[seriesColorIndex % palette.length]!; // Mod the index in case the number of series exceeds the number of colors in the palette
      seriesColorIndex += 1;
    }

    if (props.visualizationType === 'area') {
      return new Area(timeSeries, {
        delay: dataCompletenessDelay,
        color,
      });
    }

    if (props.visualizationType === 'bar') {
      return new Bars(timeSeries, {
        delay: dataCompletenessDelay,
        color,
        stack: props.stacked ? GLOBAL_STACK_NAME : undefined,
      });
    }

    return new Line(timeSeries, {
      delay: dataCompletenessDelay,
      color,
    });
  });

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

  let visibleSeriesCount = plottables.length;
  if (releaseSeries) {
    visibleSeriesCount += 1;
  }

  const showLegend = visibleSeriesCount > 1;

  const dataSeries = plottables.flatMap(plottable =>
    plottable.toSeries({
      color: plottable.config?.color!, // Colors are assigned from palette, above, so they're guaranteed to be there
      unit: yAxisUnit,
    })
  );

  return (
    <BaseChart
      ref={handleChartRef}
      autoHeightResize
      series={[...dataSeries, releaseSeries].filter(defined)}
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

const needsColor = (timeSeries: TimeSeries) => {
  // Any series that provides its own color doesn't need to be in the palette.
  if (timeSeries.color) {
    return false;
  }

  // "Other" series have a hard-coded color, they also don't need palette
  if (isTimeSeriesOther(timeSeries)) {
    return false;
  }

  return true;
};

const GLOBAL_STACK_NAME = 'time-series-visualization-widget-stack';
