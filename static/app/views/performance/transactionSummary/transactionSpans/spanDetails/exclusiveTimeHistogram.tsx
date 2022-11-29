import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {BarChart} from 'sentry/components/charts/barChart';
import BarChartZoom from 'sentry/components/charts/barChartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import getDynamicText from 'sentry/utils/getDynamicText';
import SpanHistogramQuery from 'sentry/utils/performance/histogram/spanHistogramQuery';
import {HistogramData} from 'sentry/utils/performance/histogram/types';
import {
  computeBuckets,
  formatHistogramData,
} from 'sentry/utils/performance/histogram/utils';
import {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

import {ZoomKeys} from './utils';

const NUM_BUCKETS = 50;
const PRECISION = 0;

type Props = {
  eventView: EventView;
  organization: Organization;
  spanSlug: SpanSlug;
};

export default function ExclusiveTimeHistogram(props: Props) {
  const {organization, eventView, spanSlug} = props;
  const location = useLocation();

  const start = decodeScalar(location.query[ZoomKeys.MIN]);
  const end = decodeScalar(location.query[ZoomKeys.MAX]);

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
      <SpanHistogramQuery
        location={location}
        orgSlug={organization.slug}
        eventView={eventView}
        numBuckets={NUM_BUCKETS}
        precision={PRECISION}
        span={spanSlug}
        dataFilter="exclude_outliers"
        min={start}
        max={end}
      >
        {({histogram, isLoading, error}) => {
          if (error) {
            return (
              <ErrorPanel data-test-id="histogram-error-panel">
                <IconWarning color="gray300" size="lg" />
              </ErrorPanel>
            );
          }

          return (
            <TransitionChart loading={isLoading} reloading={isLoading}>
              <TransparentLoadingMask visible={isLoading} />
              <BarChartZoom
                minZoomWidth={1}
                location={location}
                paramStart={ZoomKeys.MIN}
                paramEnd={ZoomKeys.MAX}
                xAxisIndex={[0]}
                buckets={histogram ? computeBuckets(histogram) : []}
              >
                {zoomRenderProps => (
                  <Chart
                    zoomProps={{...zoomRenderProps}}
                    isLoading={isLoading}
                    isErrored={!!error}
                    chartData={histogram}
                    spanSlug={spanSlug}
                  />
                )}
              </BarChartZoom>
            </TransitionChart>
          );
        }}
      </SpanHistogramQuery>
    </Fragment>
  );
}

type ChartProps = {
  chartData: HistogramData | null;
  isErrored: boolean;
  isLoading: boolean;
  spanSlug: SpanSlug;
  zoomProps: any;
  disableChartPadding?: boolean;
};

export function Chart(props: ChartProps) {
  const theme = useTheme();
  const {chartData, zoomProps, spanSlug} = props;

  if (!chartData) {
    return <Placeholder height="200px" />;
  }

  const chartOptions = {
    grid: {
      left: '10px',
      right: '10px',
      top: '40px',
      bottom: '0px',
    },
    colors: () => pickBarColor(spanSlug.op),
    seriesOptions: {
      showSymbol: false,
    },
    tooltip: {
      trigger: 'axis' as const,
      // TODO (udameli) pull series name from the meta
      valueFormatter: (value, _seriesName) =>
        tooltipFormatter(value, aggregateOutputType(_seriesName)),
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: {
        color: theme.chartLabel,
        formatter: (value: number) => axisLabelFormatter(value, 'number'),
      },
    },
    xAxis: {
      type: 'category' as const,
      truncate: true,
      axisTick: {
        alignWithLabel: true,
      },
    },
    height: 200,
  };

  const series = {
    seriesName: t('Count'),
    data: formatHistogramData(chartData, {type: 'duration'}),
  };

  return (
    <Fragment>
      {getDynamicText({
        value: <BarChart {...zoomProps} {...chartOptions} series={[series]} stacked />,
        fixed: <Placeholder height="200px" />,
      })}
    </Fragment>
  );
}
