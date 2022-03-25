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
import {Organization} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
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
  organization: Organization;
  spanSlug: SpanSlug;
};

export default function ExclusiveTimeHistogram(props: Props) {
  const {location, router, organization, eventView, spanSlug} = props;

  const theme = useTheme();

  const period = eventView.statsPeriod;
  const start = eventView.start ? getUtcToLocalDateObject(eventView.start) : null;
  const end = eventView.end ? getUtcToLocalDateObject(eventView.end) : null;
  const {utc} = normalizeDateTimeParams(location.query);

  const yAxis = ['spans_exclusive_time'];

  // TODO data jumping
  // TODO total count not updating in chart
  // TODO zooming
  // TODO more tests?
  // TODO color of the histogram

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
            numBuckets={NUM_BUCKETS}
            precision={PRECISION}
            span={spanSlug}
            dataFilter="exclude_outliers"
          >
            {({histogram, isLoading, error}) => {
              if (error) {
                return (
                  <ErrorPanel data-test-id="histogram-error-panel">
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
                  valueFormatter: (value, _seriesName) =>
                    tooltipFormatter(value, 'p50()'),
                },
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
                  <Chart
                    {...zoomRenderProps}
                    {...chartOptions}
                    isLoading={isLoading}
                    isErrored={!!error}
                    chartData={histogram}
                    location={location}
                  />
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
    height,
    grid,
    disableXAxis,
    disableZoom,
    colors,
  } = props;

  if (!chartData) {
    return <Placeholder height="200px" />;
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
    <BarChartZoom
      minZoomWidth={10 ** -PRECISION * NUM_BUCKETS}
      location={location}
      // TODO (udameli): use real values here
      paramStart="SpansExclusiveTimeStart"
      paramEnd="SpansExclusiveTimeEnd"
      xAxisIndex={[0]}
      buckets={computeBuckets(chartData)}
    >
      {/* TODO (udameli): enable zooming */}
      {zoomRenderProps => {
        return (
          <BarChartContainer>
            <MaskContainer>
              <TransparentLoadingMask visible={isLoading} />
              {getDynamicText({
                value: (
                  <BarChart
                    height={height ?? 200}
                    series={[series]}
                    xAxis={disableXAxis ? {show: false} : xAxis}
                    yAxis={yAxis}
                    colors={colors}
                    grid={grid}
                    stacked
                    {...(disableZoom ? {} : zoomRenderProps)}
                  />
                ),
                fixed: <Placeholder height="200px" />,
              })}
            </MaskContainer>
          </BarChartContainer>
        );
      }}
    </BarChartZoom>
  );
}

const BarChartContainer = styled('div')`
  padding-top: 0;
  position: relative;
`;

const MaskContainer = styled('div')`
  position: relative;
`;
