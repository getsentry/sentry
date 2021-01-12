import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import throttle from 'lodash/throttle';

import BarChart from 'app/components/charts/barChart';
import BarChartZoom from 'app/components/charts/barChartZoom';
import MarkArea from 'app/components/charts/components/markArea';
import MarkLine from 'app/components/charts/components/markLine';
import QuestionTooltip from 'app/components/questionTooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {Series} from 'app/types/echarts';
import EventView from 'app/utils/discover/eventView';
import {getDuration} from 'app/utils/formatters';
import theme from 'app/utils/theme';

import {DoubleHeaderContainer, HeaderTitleLegend} from '../styles';
import MeasurementsHistogramQuery from '../transactionVitals/measurementsHistogramQuery';
import {Rectangle} from '../transactionVitals/types';
import {
  asPixelRect,
  findNearestBucketIndex,
  getRefRect,
  mapPoint,
} from '../transactionVitals/utils';

import {DurationHistogramSlider, getHistogramColors} from './durationHistogramSlider';
import {getChartWidth} from './utils';

const NUM_BUCKETS = 100;
const PRECISION = 0;

type Props = {
  location: Location;
  organization: Organization;
  eventView: EventView;
  measurement: string;
  title: string;
  titleTooltip: string;
  onFilterChange: (minValue: number, maxValue: number, measurement: string) => void;
};

type State = {
  minPercent: number;
  maxPercent: number;
  /**
   * This is a pair of reference points on the graph that we can use to map any
   * other points to their pixel coordinates on the graph.
   *
   * The x values  here are the index of the cooresponding bucket and the y value
   * are the respective counts.
   *
   * Invariances:
   * - refDataRect.point1.x < refDataRect.point2.x
   * - refDataRect.point1.y < refDataRect.point2.y
   */
  refDataRect: Rectangle | null;
  /**
   * This is the coresponding pixel coordinate of the references points from refDataRect.
   *
   * ECharts' pixel coordinates are relative to the top left whereas the axis coordinates
   * used here are relative to the bottom right. Because of this and the invariances imposed
   * on refDataRect, these points have the difference invariances.
   *
   * Invariances:
   * - refPixelRect.point1.x < refPixelRect.point2.x
   * - refPixelRect.point1.y > refPixelRect.point2.y
   */
  refPixelRect: Rectangle | null;
};

function getBucketWidth(chartData) {
  // We can assume that all buckets are of equal width, use the first two
  // buckets to get the width. The value of each histogram function indicates
  // the beginning of the bucket.
  return chartData.length >= 2 ? chartData[1].histogram - chartData[0].histogram : 0;
}

function computeBuckets(chartData) {
  const bucketWidth = getBucketWidth(chartData);

  return chartData.map(item => {
    const bucket = item.histogram;
    return {
      start: bucket,
      end: bucket + bucketWidth,
    };
  });
}

function formatDuration(duration: number) {
  if (duration <= 1000) {
    return getDuration(duration / 1000, 2, true);
  }

  return getDuration(duration / 1000, 3, true);
}

function getSeries(chartData, minValue, maxValue) {
  const bucketWidth = getBucketWidth(chartData);

  const seriesData = chartData.map(item => {
    const bucket = item.histogram;
    const midPoint = bucketWidth > 1 ? Math.ceil(bucket + bucketWidth / 2) : bucket;
    const name = formatDuration(midPoint);

    const value = item.count;

    const bucketMin = bucketWidth > 1 ? Math.ceil(bucket + bucketWidth) : bucket;
    const bucketMax = bucketWidth > 1 ? Math.ceil(bucket - bucketWidth) : bucket;

    if (bucketMin >= minValue && bucketMax <= maxValue) {
      return {
        value,
        name,
        itemStyle: {color: getHistogramColors().highlight},
      };
    }

    return {
      value,
      name,
    };
  });

  return {
    seriesName: t('Count'),
    data: seriesData,
  };
}

function getShadedAreas(
  refDataRect,
  refPixelRect,
  chartData,
  bucketWidth,
  minValue,
  maxValue
) {
  const minChartData = chartData[0].histogram;
  const maxChartData = chartData[chartData.length - 1].histogram;
  const minBucket = findNearestBucketIndex(chartData, bucketWidth, minValue);
  const maxBucket = findNearestBucketIndex(chartData, bucketWidth, maxValue);
  const minChartBucket = findNearestBucketIndex(chartData, bucketWidth, minChartData);
  const maxChartBucket = findNearestBucketIndex(chartData, bucketWidth, maxChartData);
  if (
    minBucket === null ||
    minBucket === -1 ||
    maxBucket === null ||
    maxBucket === -1 ||
    minChartBucket === null ||
    minChartBucket === -1 ||
    maxChartBucket === null ||
    maxChartBucket === -1
  ) {
    return null;
  }

  if (!refPixelRect) {
    return null;
  }

  const minAreaBottomLeft = mapPoint(
    {
      x: minChartBucket - 0.5,
      y: 0,
    },
    refDataRect,
    refPixelRect
  );

  if (minAreaBottomLeft === null) {
    return null;
  }

  const minAreaTopRight = mapPoint(
    {
      x: minBucket - 0.5,
      y: Math.max(...chartData.map(data => data.count)) || 1,
    },
    refDataRect,
    refPixelRect
  );

  const minAreaBottomRight = mapPoint(
    {
      x: minBucket - 0.5,
      y: 0,
    },
    refDataRect,
    refPixelRect
  );

  const maxAreaBottomLeft = mapPoint(
    {
      x: Math.min(maxChartBucket + 0.5, maxBucket + 1.5),
      y: 0,
    },
    refDataRect,
    refPixelRect
  );

  const maxAreaTopLeft = mapPoint(
    {
      x: Math.min(maxChartBucket + 0.5, maxBucket + 1.5),
      y: Math.max(...chartData.map(data => data.count)) || 1,
    },
    refDataRect,
    refPixelRect
  );

  if (minAreaBottomLeft === null) {
    return null;
  }

  const maxAreaTopRight = mapPoint(
    {
      x: maxChartBucket + 0.5,
      y: Math.max(...chartData.map(data => data.count)) || 1,
    },
    refDataRect,
    refPixelRect
  );

  if (minAreaTopRight === null) {
    return null;
  }

  const colors = getHistogramColors();

  const markLine = MarkLine({
    animation: false,
    data: [
      [minAreaBottomRight, minAreaTopRight] as any,
      [maxAreaBottomLeft, maxAreaTopLeft] as any,
    ],
    label: {
      show: false,
    },
    lineStyle: {
      color: colors.primary,
      type: 'dashed',
      width: 1.5,
    },
  });

  const markArea = MarkArea({
    animation: false,
    data: [
      [
        {...minAreaBottomLeft, coord: []},
        {...minAreaTopRight, y: 'max', coord: []},
      ] as any,
      [
        {...maxAreaBottomLeft, coord: []},
        {...maxAreaTopRight, y: 'max', coord: []},
      ] as any,
    ],
    label: {
      show: false,
    },
    itemStyle: {
      color: 'rgba(238, 237, 247, 0.8)',
    },
  });

  return [
    {
      seriesName: 'Filtered',
      data: [],
      markArea,
    },
    {
      seriesName: 'Thresholds',
      data: [],
      markLine,
    },
  ];
}

class DurationHistogram extends React.Component<Props, State> {
  state: State = {
    minPercent: 1 / 12,
    maxPercent: 9 / 12,
    refDataRect: null,
    refPixelRect: null,
  };

  handleRenderedClosure = chartData =>
    throttle(
      (_, chartRef) => {
        const refDataRect = getRefRect(chartData);

        if (refDataRect === null || chartData.length < 1) {
          return;
        }

        const refPixelRect =
          refDataRect === null ? null : asPixelRect(chartRef, refDataRect!);
        if (refPixelRect !== null && !isEqual(refPixelRect, this.state.refPixelRect)) {
          this.setState({refPixelRect});
        }
      },
      200,
      {leading: true}
    );

  handleUpdatedRange = throttle(
    (minChartData, maxChartData) => {
      const {minPercent, maxPercent} = this.state;
      const {onFilterChange} = this.props;
      const chartDiff = maxChartData - minChartData;
      const minValue = minChartData + minPercent * chartDiff;
      const maxValue = minChartData + maxPercent * chartDiff;
      onFilterChange(minValue, maxValue, this.getTagName());
    },
    200,
    {leading: false}
  );

  setMinPercent = (minChartData, maxChartData) => {
    return minValue => {
      const chartDiff = maxChartData - minChartData;
      const minPercent = (minValue - minChartData) / chartDiff;
      return this.setState({
        minPercent,
      });
    };
  };

  setMaxPercent = (minChartData, maxChartData) => {
    return maxValue => {
      const chartDiff = maxChartData - minChartData;
      const maxPercent = (maxValue - minChartData) / chartDiff;
      return this.setState({
        maxPercent,
      });
    };
  };

  bucketWidth(chartData) {
    return chartData.length >= 2 ? chartData[1].histogram - chartData[0].histogram : 0;
  }

  getHistogramWidth(chartData) {
    const {refPixelRect} = this.state;
    return getChartWidth(chartData, refPixelRect);
  }

  getTagName() {
    return `measurements.${this.props.measurement}`;
  }

  render() {
    const {
      location,
      organization,
      eventView,
      measurement,
      title,
      titleTooltip,
    } = this.props;
    const {minPercent, maxPercent, refPixelRect} = this.state;

    const slug = measurement; //TODO: Change this once backend display exists

    const xAxis = {
      type: 'category' as const,
      truncate: true,
      boundaryGap: false,
      axisTick: {
        alignWithLabel: true,
      },
    };

    return (
      <HistogramContainer>
        <MeasurementsHistogramQuery
          location={location}
          orgSlug={organization.slug}
          eventView={eventView}
          numBuckets={NUM_BUCKETS}
          measurements={[slug]}
          dataFilter="exclude_outliers"
        >
          {results => {
            const loading = results.isLoading;
            const errored = results.error !== null;
            const chartData = results.histograms?.[this.getTagName()];

            if (!chartData) {
              return null;
            }

            const minChartData = chartData[0].histogram;
            const maxChartData = chartData[chartData.length - 1].histogram;
            const chartDiff = maxChartData - minChartData;
            const minValue = minChartData + minPercent * chartDiff;
            const maxValue = minChartData + maxPercent * chartDiff;

            const series = getSeries(chartData, minValue, maxValue);

            const refDataRect = getRefRect(chartData);

            const shadedAreas = getShadedAreas(
              refDataRect,
              refPixelRect,
              chartData,
              this.bucketWidth(chartData),
              minValue,
              maxValue
            );

            const allSeries: Series[] = [];

            if (!loading && !errored) {
              allSeries.push(series);
              if (shadedAreas) {
                allSeries.push(...shadedAreas);
              }
            }

            const values = series.data.map(point => point.value);
            const max = values.length ? Math.max(...values) : undefined;

            const yAxis = {
              type: 'value' as const,
              max,
              axisLabel: {
                color: theme.chartLabel,
              },
            };

            return (
              <React.Fragment>
                <DoubleHeaderContainer>
                  <HeaderTitleLegend>
                    {title}
                    <QuestionTooltip position="top" size="sm" title={titleTooltip} />
                  </HeaderTitleLegend>
                </DoubleHeaderContainer>
                <BarChartZoom
                  minZoomWidth={10 ** -PRECISION * NUM_BUCKETS}
                  location={location}
                  paramStart={`${slug}Start`}
                  paramEnd={`${slug}End`}
                  xAxisIndex={[0]}
                  buckets={computeBuckets(chartData)}
                >
                  {zoomRenderProps => (
                    <BarChartContainer>
                      <BarChart
                        height={250}
                        series={allSeries}
                        xAxis={xAxis}
                        yAxis={yAxis}
                        grid={{
                          left: space(3),
                          right: space(3),
                          top: space(3),
                          bottom: space(1.5),
                        }}
                        onRendered={this.handleRenderedClosure(chartData)}
                        stacked
                        {...zoomRenderProps}
                      />
                    </BarChartContainer>
                  )}
                </BarChartZoom>
                <SliderContainer>
                  <DurationHistogramSlider
                    width={this.getHistogramWidth(chartData)}
                    min={minChartData}
                    max={maxChartData}
                    minValue={minValue}
                    maxValue={maxValue}
                    onMinChange={this.setMinPercent(minChartData, maxChartData)}
                    onMaxChange={this.setMaxPercent(minChartData, maxChartData)}
                    onFinalChange={() =>
                      this.handleUpdatedRange(minChartData, maxChartData)
                    }
                  />
                </SliderContainer>
              </React.Fragment>
            );
          }}
        </MeasurementsHistogramQuery>
      </HistogramContainer>
    );
  }
}

const HistogramContainer = styled('div')``;

const BarChartContainer = styled('div')`
  padding-top: ${space(1)};
`;

const SliderContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding: ${space(3)};
  padding-top: 0px;
`;

export default DurationHistogram;
