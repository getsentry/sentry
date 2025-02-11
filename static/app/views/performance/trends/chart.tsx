import {useTheme} from '@emotion/react';
import type {LegendComponentOption, LineSeriesOption} from 'echarts';

import ChartZoom from 'sentry/components/charts/chartZoom';
import type {LineChartProps} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {OrganizationSummary} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {browserHistory} from 'sentry/utils/browserHistory';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import getDynamicText from 'sentry/utils/getDynamicText';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import generateTrendFunctionAsString from 'sentry/views/performance/trends/utils/generateTrendFunctionAsString';
import transformEventStats from 'sentry/views/performance/trends/utils/transformEventStats';
import {getIntervalLine} from 'sentry/views/performance/utils/getIntervalLine';

import type {ViewProps} from '../types';

import type {
  NormalizedTrendsTransaction,
  TrendChangeType,
  TrendFunctionField,
  TrendsStats,
} from './types';
import {
  getCurrentTrendFunction,
  getCurrentTrendParameter,
  getUnselectedSeries,
  transformEventStatsSmoothed,
  trendToColor,
} from './utils';

type Props = ViewProps & {
  isLoading: boolean;
  organization: OrganizationSummary;
  projects: Project[];
  statsData: TrendsStats;
  trendChangeType: TrendChangeType;
  additionalSeries?: LineSeriesOption[];
  applyRegressionFormatToInterval?: boolean;
  disableLegend?: boolean;
  disableXAxis?: boolean;
  grid?: LineChartProps['grid'];
  height?: number;
  neutralColor?: boolean;
  transaction?: NormalizedTrendsTransaction;
  trendFunctionField?: TrendFunctionField;
};

function getLegend(trendFunction: string): LegendComponentOption {
  return {
    right: 10,
    top: 0,
    itemGap: 12,
    align: 'left',
    data: [
      {
        name: 'Baseline',
        icon: 'path://M180 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40z, M810 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40zm, M1440 1000 l0 -40 200 0 200 0 0 40 0 40 -200 0 -200 0 0 -40z',
      },
      {
        name: 'Releases',
      },
      {
        name: trendFunction,
      },
    ],
  };
}

export function Chart({
  trendChangeType,
  statsPeriod,
  transaction,
  statsData,
  isLoading,
  start: propsStart,
  end: propsEnd,
  trendFunctionField,
  disableXAxis,
  disableLegend,
  neutralColor,
  grid,
  height,
  projects,
  project,
  organization,
  additionalSeries,
  applyRegressionFormatToInterval = false,
}: Props) {
  const location = useLocation();
  const theme = useTheme();

  const handleLegendSelectChanged = (legendChange: any) => {
    const {selected} = legendChange;
    const unselected = Object.keys(selected).filter(key => !selected[key]);

    const query = {
      ...location.query,
    };

    const queryKey = getUnselectedSeries(trendChangeType);
    query[queryKey] = unselected;

    const to = {
      ...location,
      query,
    };
    browserHistory.push(to);
  };

  const derivedTrendChangeType = organization.features.includes('performance-new-trends')
    ? transaction?.change
    : trendChangeType;
  const lineColor =
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    trendToColor[neutralColor ? 'neutral' : derivedTrendChangeType || trendChangeType];

  const events =
    statsData && transaction?.project && transaction?.transaction
      ? statsData[[transaction.project, transaction.transaction].join(',')]
      : undefined;
  const data = events?.data ?? [];

  const trendFunction = getCurrentTrendFunction(location, trendFunctionField);
  const trendParameter = getCurrentTrendParameter(location, projects, project);
  const chartLabel = generateTrendFunctionAsString(
    trendFunction.field,
    trendParameter.column
  );
  const results = transformEventStats(data, chartLabel);
  const {smoothedResults, minValue, maxValue} = transformEventStatsSmoothed(
    results,
    chartLabel
  );

  const start = propsStart ? getUtcToLocalDateObject(propsStart) : null;
  const end = propsEnd ? getUtcToLocalDateObject(propsEnd) : null;
  const {utc} = normalizeDateTimeParams(location.query);

  const seriesSelection = decodeList(
    location.query[getUnselectedSeries(trendChangeType)]
  ).reduce((selection, metric) => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    selection[metric] = false;
    return selection;
  }, {});
  const legend: LegendComponentOption = disableLegend
    ? {show: false}
    : {
        ...getLegend(chartLabel),
        selected: seriesSelection,
      };

  const loading = isLoading;
  const reloading = isLoading;

  const yMax = Math.max(
    maxValue,
    transaction?.aggregate_range_2 || 0,
    transaction?.aggregate_range_1 || 0
  );
  const yMin = Math.min(
    minValue,
    transaction?.aggregate_range_1 || Number.MAX_SAFE_INTEGER,
    transaction?.aggregate_range_2 || Number.MAX_SAFE_INTEGER
  );

  const smoothedSeries = smoothedResults
    ? smoothedResults.map(values => {
        return {
          ...values,
          color: lineColor.default,
          lineStyle: {
            opacity: 1,
          },
        };
      })
    : [];

  const needsLabel = true;
  const intervalSeries = getIntervalLine(
    theme,
    smoothedResults || [],
    0.5,
    needsLabel,
    transaction,
    applyRegressionFormatToInterval
  );

  const yDiff = yMax - yMin;
  const yMargin = yDiff * 0.1;
  const series = [...smoothedSeries, ...intervalSeries];

  const durationUnit = getDurationUnit(series);

  const chartOptions: Omit<LineChartProps, 'series'> = {
    tooltip: {
      valueFormatter: (value, seriesName) => {
        return tooltipFormatter(value, aggregateOutputType(seriesName));
      },
    },
    yAxis: {
      min: Math.max(0, yMin - yMargin),
      max: yMax + yMargin,
      minInterval: durationUnit,
      axisLabel: {
        color: theme.chartLabel,
        formatter: (value: number) =>
          axisLabelFormatter(value, 'duration', undefined, durationUnit),
      },
    },
  };

  return (
    <ChartZoom period={statsPeriod} start={start} end={end} utc={utc === 'true'}>
      {zoomRenderProps => {
        return (
          <TransitionChart loading={loading} reloading={reloading}>
            <TransparentLoadingMask visible={reloading} />
            {getDynamicText({
              value: (
                <LineChart
                  height={height}
                  {...zoomRenderProps}
                  {...chartOptions}
                  additionalSeries={additionalSeries}
                  onLegendSelectChanged={handleLegendSelectChanged}
                  series={series}
                  seriesOptions={{
                    showSymbol: false,
                  }}
                  legend={legend}
                  toolBox={{
                    show: false,
                  }}
                  grid={
                    grid ?? {
                      left: '10px',
                      right: '10px',
                      top: '40px',
                      bottom: '0px',
                    }
                  }
                  xAxis={disableXAxis ? {show: false} : undefined}
                />
              ),
              fixed: 'Duration Chart',
            })}
          </TransitionChart>
        );
      }}
    </ChartZoom>
  );
}

export default Chart;
