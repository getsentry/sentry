import {useCallback, useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {SeriesOption, YAXisComponentOption} from 'echarts';
import type {
  TooltipFormatterCallback,
  TopLevelFormatterParams,
} from 'echarts/types/dist/shared';
import type EChartsReactCore from 'echarts-for-react/lib/core';
import groupBy from 'lodash/groupBy';
import mapValues from 'lodash/mapValues';

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
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {type Range, RangeMap} from 'sentry/utils/number/rangeMap';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseBubbles} from 'sentry/views/dashboards/widgets/timeSeriesWidget/releaseBubbles/useReleaseBubbles';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';

import {useWidgetSyncContext} from '../../contexts/widgetSyncContext';
import {NO_PLOTTABLE_VALUES, X_GUTTER, Y_GUTTER} from '../common/settings';
import type {Aliases, LegendSelection, Release} from '../common/types';

import {formatSeriesName} from './formatters/formatSeriesName';
import {formatTooltipValue} from './formatters/formatTooltipValue';
import {formatXAxisTimestamp} from './formatters/formatXAxisTimestamp';
import {formatYAxisValue} from './formatters/formatYAxisValue';
import type {Plottable} from './plottables/plottable';
import {ReleaseSeries} from './releaseSeries';
import {FALLBACK_TYPE, FALLBACK_UNIT_FOR_FIELD_TYPE} from './settings';
import {TimeSeriesWidgetYAxis} from './timeSeriesWidgetYAxis';

const {error, warn} = Sentry._experiment_log;

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
  /**
   * Show releases as either lines per release or a bubble for a group of releases.
   */
  showReleaseAs?: 'bubble' | 'line';
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
  const hasReleaseBubbles =
    organization.features.includes('release-bubbles-ui') &&
    props.showReleaseAs === 'bubble';

  // find min/max timestamp of *all* timeSeries
  const allBoundaries = props.plottables
    .flatMap(plottable => [plottable.start, plottable.end])
    .toSorted();
  const earliestTimeStamp = allBoundaries.at(0);
  const latestTimeStamp = allBoundaries.at(-1);

  const {
    createReleaseBubbleHighlighter,
    releaseBubbleEventHandlers,
    releaseBubbleSeries,
    releaseBubbleXAxis,
    releaseBubbleGrid,
  } = useReleaseBubbles({
    chartRef,
    chartRenderer: ({start: trimStart, end: trimEnd}) => {
      return (
        <TimeSeriesWidgetVisualization
          {...props}
          plottables={props.plottables.map(plottable =>
            plottable.constrain(trimStart, trimEnd)
          )}
          showReleaseAs="line"
        />
      );
    },
    minTime: earliestTimeStamp ? new Date(earliestTimeStamp).getTime() : undefined,
    maxTime: latestTimeStamp ? new Date(latestTimeStamp).getTime() : undefined,
    releases: hasReleaseBubbles
      ? props.releases?.map(({timestamp, version}) => ({date: timestamp, version}))
      : [],
  });

  const releaseSeries = props.releases
    ? hasReleaseBubbles
      ? releaseBubbleSeries
      : ReleaseSeries(
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
        )
    : null;

  const hasReleaseBubblesSeries = hasReleaseBubbles && releaseSeries;

  const handleChartRef = useCallback(
    (e: ReactEchartsRef) => {
      chartRef.current = e;

      if (!e?.getEchartsInstance) {
        return;
      }

      const echartsInstance = e.getEchartsInstance();
      registerWithWidgetSyncContext(echartsInstance);

      if (hasReleaseBubblesSeries) {
        createReleaseBubbleHighlighter(echartsInstance);
      }
    },
    [
      hasReleaseBubblesSeries,
      createReleaseBubbleHighlighter,
      registerWithWidgetSyncContext,
    ]
  );

  const chartZoomProps = useChartZoom({
    saveOnZoom: true,
  });

  const plottablesByType = groupBy(props.plottables, plottable => plottable.dataType);

  // Count up the field types of all the plottables
  const fieldTypeCounts = mapValues(plottablesByType, plottables => plottables.length);

  // Sort the field types by how many plottables use each one
  const axisTypes = (
    Object.keys(fieldTypeCounts).filter(key => {
      // JavaScript objects cannot have `undefined` or `null` as keys. lodash
      // `groupBy` casts those cases to strings. This is _very_ rare, since it
      // indicates a backend failure to provide the correct data type, but it
      // happens sometimes. Filter those out. It would be cleaner to use a type
      // predicate here, but consistently enforcing plottable values is a lot of
      // work
      return !['undefined', 'null'].includes(key);
    }) as AggregationOutputType[]
  )
    .toSorted(
      // `dataTypes` is extracted from `dataTypeCounts`, so the counts are guaranteed to exist
      (a, b) => fieldTypeCounts[b]! - fieldTypeCounts[a]!
    )
    .filter(axisType => !!axisType); // `TimeSeries` allows for a `null` data type , though it's not likely

  // Assign most popular field type to left axis
  const leftYAxisType = axisTypes.at(0) ?? FALLBACK_TYPE;

  // Assign the rest of the field types to right
  const rightYAxisTypes = axisTypes.slice(1);

  // Narrow down to just one type for the right Y axis. If there's just one field
  // type for the right axis, use it. If there are more than one, fall back to a
  // default. If there are 0, there's no type for the right axis, and we won't
  // plot one
  const rightYAxisType =
    rightYAxisTypes.length === 1
      ? rightYAxisTypes[0]!
      : rightYAxisTypes.length > 2
        ? FALLBACK_TYPE
        : undefined;

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

  const leftYAxis: YAXisComponentOption = TimeSeriesWidgetYAxis(
    {
      axisLabel: {
        formatter: (value: number) =>
          formatYAxisValue(value, leftYAxisType, unitForType[leftYAxisType] ?? undefined),
      },
      position: 'left',
    },
    leftYAxisType
  );

  const rightYAxis: YAXisComponentOption | undefined = rightYAxisType
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
        rightYAxisType
      )
    : undefined;

  // Set up a fallback palette for any plottable without a color
  const paletteSize = props.plottables.filter(plottable => plottable.needsColor).length;

  const palette =
    paletteSize > 0
      ? getChartColorPalette(paletteSize - 2)! // -2 because getColorPalette artificially adds 1, I'm not sure why
      : [];

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

        return formatTooltipValue(value, fieldType, unitForType[fieldType] ?? undefined);
      },
      nameFormatter: seriesName => {
        return props.aliases?.[seriesName] ?? formatSeriesName(seriesName);
      },
      truncate: true,
      utc: utc ?? false,
    })(deDupedParams, asyncTicket);
  };

  const yAxes: YAXisComponentOption[] = [leftYAxis, rightYAxis].filter(axis => !!axis);

  let visibleSeriesCount = props.plottables.length;
  if (releaseSeries) {
    visibleSeriesCount += 1;
  }

  const showLegend = visibleSeriesCount > 1;

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
  const series: SeriesOption[] = props.plottables.flatMap(plottable => {
    let color: string | undefined;

    if (plottable.needsColor) {
      // For any timeseries in need of a color, pull from the chart palette
      color = palette[seriesColorIndex % palette.length]!; // Mod the index in case the number of plottables exceeds the palette length
      seriesColorIndex += 1;
    }

    let yAxisPosition: 'left' | 'right' = 'left';

    if (plottable.dataType === leftYAxisType) {
      // This plottable matches the left axis
      yAxisPosition = 'left';
    } else if (rightYAxisTypes.includes(plottable.dataType ?? FALLBACK_TYPE)) {
      // This plottable matches the right axis
      yAxisPosition = 'right';
    } else {
      // This plottable's type isn't on either axis! Mysterious. If there is a catch-all right axis. Drop it into the first known "fallback" axis.
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

      yAxisPosition = leftYAxisType === FALLBACK_TYPE ? 'left' : 'right';
    }

    // TODO: Type checking would be welcome here, but `plottingOptions` is unknown, since it depends on the implementation of the `Plottable` interface
    const seriesOfPlottable = plottable.toSeries({
      color,
      yAxisPosition,
      unit: unitForType[plottable.dataType ?? FALLBACK_TYPE],
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

  return (
    <BaseChart
      ref={handleChartRef}
      {...releaseBubbleEventHandlers}
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
        ...releaseBubbleGrid,
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
        ...releaseBubbleXAxis,
      }}
      yAxes={yAxes}
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
