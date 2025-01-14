import {useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import type {LineSeriesOption} from 'echarts';
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
import type {Aliases, Release, TimeseriesData} from '../common/types';

import {formatTooltipValue} from './formatTooltipValue';
import {formatYAxisValue} from './formatYAxisValue';
import {ReleaseSeries} from './releaseSeries';
import {splitSeriesIntoCompleteAndIncomplete} from './splitSeriesIntoCompleteAndIncomplete';

export interface TimeSeriesWidgetVisualizationProps {
  SeriesConstructor: (timeserie: TimeseriesData, complete?: boolean) => LineSeriesOption;
  timeseries: TimeseriesData[];
  aliases?: Aliases;
  dataCompletenessDelay?: number;
  releases?: Release[];
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

  // TODO: Raise error if attempting to plot series of different types or units
  const firstSeriesField = firstSeries?.field;
  const type = firstSeries?.meta?.fields?.[firstSeriesField] ?? 'number';
  const unit = firstSeries?.meta?.units?.[firstSeriesField] ?? undefined;

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
        if (param.value[1] === null) {
          return false;
        }

        if (uniqueSeries.has(param.seriesName)) {
          return false;
        }

        uniqueSeries.add(param.seriesName);
        return true;
      });
    }

    return getFormatter({
      isGroupedByDate: true,
      showTimeInTooltip: true,
      valueFormatter: value => {
        return formatTooltipValue(value, type, unit);
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
            }
          : undefined
      }
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
            return formatYAxisValue(value, type, unit);
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
