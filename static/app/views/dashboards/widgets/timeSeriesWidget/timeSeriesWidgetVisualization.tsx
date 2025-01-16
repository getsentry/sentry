import {useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import type {BarSeriesOption, LineSeriesOption} from 'echarts';
import type {
  TooltipFormatterCallback,
  TopLevelFormatterParams,
} from 'echarts/types/dist/shared';
import type EChartsReactCore from 'echarts-for-react/lib/core';

import BaseChart from 'sentry/components/charts/baseChart';
import {getFormatter} from 'sentry/components/charts/components/tooltip';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import {isChartHovered} from 'sentry/components/charts/utils';
import type {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {useWidgetSyncContext} from '../../contexts/widgetSyncContext';
import type {
  Aliases,
  Release,
  TimeseriesData,
  TimeseriesSelection,
} from '../common/types';

import {formatTooltipValue} from './formatTooltipValue';
import {formatYAxisValue} from './formatYAxisValue';
import {ReleaseSeries} from './releaseSeries';
import {splitSeriesIntoCompleteAndIncomplete} from './splitSeriesIntoCompleteAndIncomplete';

export interface TimeSeriesWidgetVisualizationProps {
  SeriesConstructor: (
    timeserie: TimeseriesData,
    complete?: boolean
  ) => LineSeriesOption | BarSeriesOption;
  timeseries: TimeseriesData[];
  aliases?: Aliases;
  dataCompletenessDelay?: number;
  onTimeseriesSelectionChange?: (selection: TimeseriesSelection) => void;
  releases?: Release[];
  timeseriesSelection?: TimeseriesSelection;
}

export function TimeSeriesWidgetVisualization(props: TimeSeriesWidgetVisualizationProps) {
  const chartRef = useRef<EChartsReactCore | null>(null);
  const {register: registerWithWidgetSyncContext} = useWidgetSyncContext();

  const pageFilters = usePageFilters();
  const {start, end, period, utc} = pageFilters.selection.datetime;

  const dataCompletenessDelay = props.dataCompletenessDelay ?? 0;

  const theme = useTheme();
  const organization = useOrganization();
  const navigate = useNavigate();

  let releaseSeries: Series | undefined = undefined;
  if (props.releases) {
    const onClick = (release: Release) => {
      navigate(
        normalizeUrl({
          pathname: `/organizations/${
            organization.slug
          }/releases/${encodeURIComponent(release.version)}/`,
        })
      );
    };

    releaseSeries = ReleaseSeries(theme, props.releases, onClick, utc ?? false);
  }

  // @ts-ignore TS(7051): Parameter has a name but no type. Did you mean 'ar... Remove this comment to see the full error message
  const formatSeriesName: (string) => string = name => {
    return props.aliases?.[name] ?? name;
  };

  const chartZoomProps = useChartZoom({
    saveOnZoom: true,
  });

  let completeSeries: TimeseriesData[] = props.timeseries;
  const incompleteSeries: TimeseriesData[] = [];

  if (dataCompletenessDelay > 0) {
    completeSeries = [];

    props.timeseries.forEach(timeserie => {
      const [completeSerie, incompleteSerie] = splitSeriesIntoCompleteAndIncomplete(
        timeserie,
        dataCompletenessDelay
      );

      if (completeSerie && completeSerie.data.length > 0) {
        completeSeries.push(completeSerie);
      }

      if (incompleteSerie && incompleteSerie.data.length > 0) {
        incompleteSeries.push(incompleteSerie);
      }
    });
  }

  // TODO: There's a TypeScript indexing error here. This _could_ in theory be
  // `undefined`. We need to guard against this in the parent component, and
  // show an error.
  const firstSeries = props.timeseries[0]!;

  let yAxisType: string;

  const types = Array.from(
    new Set(
      props.timeseries
        .map(timeserie => {
          return timeserie?.meta?.fields[timeserie.field];
        })
        .filter(Boolean)
    )
  ) as string[];

  if (types.length === 0 || types.length > 1) {
    yAxisType = FALLBACK_TYPE;
  } else {
    yAxisType = types[0]!;
  }

  const firstSeriesField = firstSeries?.field;

  // TODO: It would be smart, here, to check the units and convert if necessary
  const yAxisUnit = firstSeries?.meta?.units?.[firstSeriesField] ?? undefined;

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
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        if (param.value[1] === null) {
          return false;
        }

        // @ts-ignore TS(2345): Argument of type 'string | undefined' is not assig... Remove this comment to see the full error message
        if (uniqueSeries.has(param.seriesName)) {
          return false;
        }

        // @ts-ignore TS(2345): Argument of type 'string | undefined' is not assig... Remove this comment to see the full error message
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

        const timeserie = props.timeseries.find(t => t.field === field);

        return formatTooltipValue(
          value,
          timeserie?.meta?.fields?.[field] ?? FALLBACK_TYPE,
          timeserie?.meta?.units?.[field] ?? undefined
        );
      },
      nameFormatter: formatSeriesName,
      truncate: true,
      utc: utc ?? false,
    })(deDupedParams, asyncTicket);
  };

  let visibleSeriesCount = props.timeseries.length;
  if (releaseSeries) {
    visibleSeriesCount += 1;
  }

  const showLegend = visibleSeriesCount > 1;

  return (
    <BaseChart
      ref={e => {
        chartRef.current = e;

        if (e?.getEchartsInstance) {
          registerWithWidgetSyncContext(e.getEchartsInstance());
        }
      }}
      autoHeightResize
      series={[
        ...completeSeries.map(timeserie => {
          return props.SeriesConstructor(timeserie, true);
        }),
        ...incompleteSeries.map(timeserie => {
          return props.SeriesConstructor(timeserie, false);
        }),
        releaseSeries &&
          LineSeries({
            ...releaseSeries,
            name: releaseSeries.seriesName,
            data: [],
          }),
      ].filter(defined)}
      grid={{
        left: 0,
        top: showLegend ? 25 : 10,
        right: 4,
        bottom: 0,
        containLabel: true,
      }}
      legend={
        showLegend
          ? {
              top: 0,
              left: 0,
              formatter(name: string) {
                return props.aliases?.[name] ?? formatSeriesName(name);
              },
              selected: props.timeseriesSelection,
            }
          : undefined
      }
      onLegendSelectChanged={event => {
        props?.onTimeseriesSelectionChange?.(event.selected);
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
        },
        splitNumber: 0,
      }}
      yAxis={{
        animation: false,
        axisLabel: {
          formatter(value: number) {
            return formatYAxisValue(value, yAxisType, yAxisUnit);
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
      isGroupedByDate
      useMultilineDate
      start={start ? new Date(start) : undefined}
      end={end ? new Date(end) : undefined}
      period={period}
      utc={utc ?? undefined}
    />
  );
}

const FALLBACK_TYPE = 'number';
