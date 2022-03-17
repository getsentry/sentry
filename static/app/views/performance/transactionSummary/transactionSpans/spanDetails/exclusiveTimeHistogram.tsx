import {Fragment} from 'react';
import {WithRouterProps} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import BarChart from 'sentry/components/charts/barChart';
import BarChartZoom from 'sentry/components/charts/barChartZoom';
import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import SpanHistogramQuery from 'sentry/utils/performance/histogram/spanHistogramQuery';
import {HistogramData} from 'sentry/utils/performance/histogram/types';
import {
  computeBuckets,
  formatHistogramData,
} from 'sentry/utils/performance/histogram/utils';
import {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';

const NUM_BUCKETS = 50;
const PRECISION = 0;

type Props = WithRouterProps & {
  eventView: EventView;
  location: Location;
  onFilterChange: (minValue: number, maxValue: number) => void;
  organization: Organization;
  spanSlug: SpanSlug;
  withoutZerofill: boolean;
};

export default function ExclusiveTimeTimeSeries(props: Props) {
  const {
    location,
    router,
    organization,
    eventView,
    spanSlug,
    // withoutZerofill,
    onFilterChange,
  } = props;

  // const api = useApi();
  const theme = useTheme();

  const period = eventView.statsPeriod;
  const start = eventView.start ? getUtcToLocalDateObject(eventView.start) : null;
  const end = eventView.end ? getUtcToLocalDateObject(eventView.end) : null;
  const {utc} = normalizeDateTimeParams(location.query);

  // const datetimeSelection = {
  //   start,
  //   end,
  //   period,
  // };

  const yAxis = [
    'percentileArray(spans_exclusive_time, 0.75)',
    'percentileArray(spans_exclusive_time, 0.95)',
    'percentileArray(spans_exclusive_time, 0.99)',
  ];

  // const handleLegendSelectChanged = legendChange => {
  //   const {selected} = legendChange;
  //   const unselected = Object.keys(selected).filter(key => !selected[key]);

  //   const to = {
  //     ...location,
  //     query: {
  //       ...location.query,
  //       unselectedSeries: unselected,
  //     },
  //   };
  //   browserHistory.push(to);
  // };

  return (
    <Fragment>
      <HeaderTitleLegend>
        {t('Self Time Distribution')}
        <QuestionTooltip
          size="sm"
          position="top"
          title={t(
            'Distribution buckets counts of the same self time duration for the selected span op and group.'
          )}
        />
      </HeaderTitleLegend>
      <ChartZoom
        router={router}
        period={period}
        start={start}
        end={end}
        utc={utc === 'true'}
      >
        {zoomRenderProps => (
          <SpanHistogramQuery
            location={location}
            orgSlug={organization.slug}
            eventView={eventView}
            numBuckets={100}
            precision={1}
            span={spanSlug}
            dataFilter="exclude_outliers"
          >
            {({histogram, isLoading, error}) => {
              if (error) {
                return (
                  <ErrorPanel>
                    <IconWarning color="gray300" size="lg" />
                  </ErrorPanel>
                );
              }

              const chartOptions = {
                grid: {
                  left: '10px',
                  right: '10px',
                  top: '40px',
                  bottom: '0px',
                },
                colors: theme.charts.getColorPalette(yAxis.length - 2),
                seriesOptions: {
                  showSymbol: false,
                },
                tooltip: {
                  trigger: 'axis' as const,
                  // p50() coerces the axis to be time based
                  // valueFormatter: (value, _seriesName) =>
                  //   tooltipFormatter(value, 'p50()'),
                },
                // xAxis: timeframe
                //   ? {
                //       min: timeframe.start,
                //       max: timeframe.end,
                //     }
                //   : undefined,
                xAxis: undefined,
                yAxis: {
                  axisLabel: {
                    color: theme.chartLabel,
                    // p50() coerces the axis to be time based
                    formatter: (value: number) => axisLabelFormatter(value, 'p50()'),
                  },
                },
              };

              return (
                <TransitionChart loading={isLoading} reloading={isLoading}>
                  <TransparentLoadingMask visible={isLoading} />
                  {getDynamicText({
                    value: (
                      <Chart
                        {...zoomRenderProps}
                        {...chartOptions}
                        isLoading={isLoading}
                        isErrored={!!error}
                        chartData={histogram}
                        location={location}
                        onFilterChange={onFilterChange}
                      />
                    ),
                    fixed: <Placeholder height="200px" />,
                  })}
                </TransitionChart>
              );
            }}
          </SpanHistogramQuery>
        )}
      </ChartZoom>
    </Fragment>
  );
}

type ChartProps = {
  chartData: HistogramData | null;
  isErrored: boolean;
  isLoading: boolean;
  location: Location;
  onFilterChange: Props['onFilterChange'];
  colors?: string[];
  disableChartPadding?: boolean;
  disableXAxis?: boolean;
  disableZoom?: boolean;
  grid?: BarChart['props']['grid'];
  height?: number;
};

export function Chart(props: ChartProps) {
  const {
    isLoading,
    chartData,
    location,
    onFilterChange,
    height,
    grid,
    disableXAxis,
    disableZoom,
    disableChartPadding,
    colors,
  } = props;

  if (!chartData) {
    return null;
  }
  const theme = useTheme();

  const series = {
    seriesName: t('Count'),
    data: formatHistogramData(chartData, {type: 'duration'}),
  };

  const xAxis = {
    type: 'category' as const,
    truncate: true,
    boundaryGap: false,
    axisTick: {
      alignWithLabel: true,
    },
  };

  const yAxis = {
    type: 'value' as const,
    axisLabel: {
      color: theme.chartLabel,
      formatter: formatAbbreviatedNumber,
    },
  };

  return (
    <Fragment>
      <BarChartZoom
        minZoomWidth={10 ** -PRECISION * NUM_BUCKETS}
        location={location}
        paramStart={`selfTime:>=`}
        paramEnd={`selfTime:<=`}
        xAxisIndex={[0]}
        buckets={computeBuckets(chartData)}
        onHistoryPush={onFilterChange}
      >
        {zoomRenderProps => {
          return (
            <BarChartContainer hasPadding={!disableChartPadding}>
              <MaskContainer>
                <TransparentLoadingMask visible={isLoading} />
                {getDynamicText({
                  value: (
                    <BarChart
                      height={height ?? 250}
                      series={[series]}
                      xAxis={disableXAxis ? {show: false} : xAxis}
                      yAxis={yAxis}
                      colors={colors}
                      grid={
                        grid ?? {
                          left: space(3),
                          right: space(3),
                          top: space(3),
                          bottom: isLoading ? space(4) : space(1.5),
                        }
                      }
                      stacked
                      {...(disableZoom ? {} : zoomRenderProps)}
                    />
                  ),
                  fixed: <Placeholder height="250px" testId="skeleton-ui" />,
                })}
              </MaskContainer>
            </BarChartContainer>
          );
        }}
      </BarChartZoom>
    </Fragment>
  );
}

const BarChartContainer = styled('div')<{hasPadding?: boolean}>`
  padding-top: ${p => (p.hasPadding ? space(1) : 0)};
  position: relative;
`;

const MaskContainer = styled('div')`
  position: relative;
`;
