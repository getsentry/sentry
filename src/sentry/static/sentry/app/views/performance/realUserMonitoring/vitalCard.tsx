import React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import BarChart from 'app/components/charts/barChart';
import MarkArea from 'app/components/charts/components/markArea';
import MarkLine from 'app/components/charts/components/markLine';
import MarkPoint from 'app/components/charts/components/markPoint';
import Tag from 'app/components/tag';
import {FIRE_SVG} from 'app/icons/iconFire';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {formatFloat, getDuration} from 'app/utils/formatters';
import theme from 'app/utils/theme';

import {Card, CardSummary, CardSectionHeading, StatNumber, Description} from './styles';
import {HistogramData, Vital, Rectangle, Point} from './types';

type Props = {
  isLoading: boolean;
  error: boolean;
  vital: Vital;
  summary: number | null;
  chartData: HistogramData[];
  colors: [string];
};

type State = {
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
   * This is the cooresponding pixel coordinate of the references points from refDataRect.
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

class VitalCard extends React.Component<Props, State> {
  state = {
    refDataRect: null,
    refPixelRect: null,
  };

  static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    const {isLoading, error, chartData} = nextProps;

    if (isLoading || error === null) {
      return {...prevState};
    }

    const refDataRect = getReferenceRect(chartData);
    if (
      prevState.refDataRect === null ||
      (refDataRect !== null && !isEqual(refDataRect, prevState.refDataRect))
    ) {
      return {
        ...prevState,
        refDataRect,
      };
    }

    return {...prevState};
  }

  renderSummary() {
    const {isLoading, error, summary, vital, colors} = this.props;
    const {slug, name, description, failureThreshold, type} = vital;

    return (
      <CardSummary>
        <Indicator color={colors[0]} />
        <CardSectionHeading>
          {`${name} (${slug.toUpperCase()})`}
          {isLoading || error || summary === null ? null : summary < failureThreshold ? (
            <StyledTag color={theme.purple500}>{t('pass')}</StyledTag>
          ) : (
            <StyledTag color={theme.red400}>{t('fail')}</StyledTag>
          )}
        </CardSectionHeading>
        <StatNumber>
          {isLoading || error || summary === null
            ? '\u2014'
            : type === 'duration'
            ? getDuration(summary / 1000, 2, true)
            : formatFloat(summary, 2)}
        </StatNumber>
        <Description>{description}</Description>
      </CardSummary>
    );
  }

  asPixelRect(chartRef, dataRect: Rectangle): Rectangle | null {
    const point1 = chartRef.convertToPixel({xAxisIndex: 0, yAxisIndex: 0}, [
      dataRect.point1.x,
      dataRect.point1.y,
    ]);

    if (isNaN(point1[0]) || isNaN(point1[1])) {
      return null;
    }

    const point2 = chartRef.convertToPixel({xAxisIndex: 0, yAxisIndex: 0}, [
      dataRect.point2.x,
      dataRect.point2.y,
    ]);

    if (isNaN(point2[0]) || isNaN(point2[1])) {
      return null;
    }

    return {
      point1: {x: point1[0], y: point1[1]},
      point2: {x: point2[0], y: point2[1]},
    };
  }

  asPixel(point: Point, refDataRect: Rectangle, refPixelRect: Rectangle): Point {
    const xPercentage =
      (point.x - refDataRect.point1.x) / (refDataRect.point2.x - refDataRect.point1.x);
    const yPercentage =
      (point.y - refDataRect.point1.y) / (refDataRect.point2.y - refDataRect.point1.y);

    return {
      x:
        refPixelRect.point1.x +
        (refPixelRect.point2.x - refPixelRect.point1.x) * xPercentage,
      y:
        refPixelRect.point1.y +
        (refPixelRect.point2.y - refPixelRect.point1.y) * yPercentage,
    };
  }

  handleFinished = (_, chartRef) => {
    const {chartData} = this.props;
    const {refDataRect} = this.state;

    if (refDataRect === null || chartData.length < 1) {
      return;
    }

    const refPixelRect =
      refDataRect === null ? null : this.asPixelRect(chartRef, refDataRect!);
    if (refPixelRect !== null && !isEqual(refPixelRect, this.state.refPixelRect)) {
      this.setState({refPixelRect});
    }
  };

  renderHistogram() {
    const {colors} = this.props;

    const series = this.getTransformedData();

    const xAxis = {
      type: 'category',
      truncate: true,
      axisLabel: {
        margin: 20,
      },
      axisTick: {
        interval: 0,
        alignWithLabel: true,
      },
    };

    const values = series.data.map(point => point.value);
    const max = values.length ? Math.max(...values) : undefined;

    const yAxis = {type: 'value', max};

    return (
      <BarChart
        series={[series]}
        xAxis={xAxis}
        yAxis={yAxis}
        colors={colors}
        onFinished={this.handleFinished}
        grid={{left: space(3), right: space(3), top: space(3), bottom: space(1.5)}}
      />
    );
  }

  bucketWidth() {
    const {chartData} = this.props;
    // We can assume that all buckets are of equal width, use the first two
    // buckets to get the width. The value of each histogram function indicates
    // the beginning of the bucket.
    return chartData.length > 2 ? chartData[1].histogram - chartData[0].histogram : 0;
  }

  getTransformedData() {
    const {chartData, vital} = this.props;
    const bucketWidth = this.bucketWidth();

    const seriesData = chartData.map(item => {
      const bucket = item.histogram;
      const midPoint = bucketWidth > 1 ? Math.ceil(bucket + bucketWidth / 2) : bucket;
      return {
        value: item.count,
        name:
          vital.type === 'duration'
            ? getDuration(midPoint / 1000, 2)
            : formatFloat(midPoint, 2).toLocaleString(),
      };
    });

    const series = {
      seriesName: t('Count'),
      data: seriesData,
    };

    this.drawBaseline(series);
    this.drawFailRegion(series);

    return series;
  }

  drawBaseline(series) {
    const {summary} = this.props;

    if (summary !== null) {
      const summaryBucket = this.findNearestBucketIndex(summary);
      if (summaryBucket !== null) {
        series.markLine = MarkLine({
          data: [{xAxis: summaryBucket} as any],
          label: {
            show: false,
          },
          lineStyle: {
            color: theme.gray700,
            type: 'solid',
          },
          silent: true,
        });
      }
    }
  }

  drawFailRegion(series) {
    const {chartData, vital} = this.props;
    const {failureThreshold} = vital;

    if (this.state.refDataRect !== null && this.state.refPixelRect !== null) {
      const failureBucket = this.findNearestBucketIndex(failureThreshold);
      if (failureBucket !== null) {
        // since we found the failure bucket, the failure threshold is
        // visible on the graph, so let's draw the fail region
        const failurePixel = this.asPixel(
          {
            // subtract 0.5 from the x here to ensure that the boundary of
            // the failure region lies between buckets
            x: failureBucket - 0.5,
            y: 0,
          },
          this.state.refDataRect!,
          this.state.refPixelRect!
        );

        series.markArea = MarkArea({
          data: [
            [
              {x: failurePixel.x, yAxis: 0},
              {x: 'max', yAxis: 'max'},
            ] as any,
          ],
          itemStyle: {
            color: 'transparent',
            borderColor: theme.red400,
            borderWidth: 1.5,
            borderType: 'dashed',
          },
          silent: true,
        });

        const maxCount = Math.max(...chartData.map(data => data.count));
        const topRightPixel = this.asPixel(
          {
            // subtract 0.5 to get on the right side of the right most bar
            x: chartData.length - 0.5,
            y: maxCount,
          },
          this.state.refDataRect!,
          this.state.refPixelRect!
        );

        series.markPoint = MarkPoint({
          data: [{x: topRightPixel.x - 16, y: topRightPixel.y + 16}] as any,
          itemStyle: {color: theme.red400},
          silent: true,
          symbol: `path://${FIRE_SVG}`,
          symbolKeepAspect: true,
          symbolSize: [14, 16],
        });
      }
    }
  }

  /**
   * Given a value on the x-axis, return the index of the nearest bucket.
   *
   * A bucket contains a range a values, and nearest is defined by the distance
   * of the point to the mid point of the bucket.
   */
  findNearestBucketIndex(xAxis: number): number | null {
    const {chartData} = this.props;

    // it's possible that the data is not available yet or the x axis is out of range
    if (
      !chartData.length ||
      xAxis < chartData[0].histogram ||
      xAxis > chartData[chartData.length - 1].histogram
    ) {
      return null;
    }

    const halfBucketWidth = this.bucketWidth() / 2;

    // binary search for the index
    let l = 0;
    let r = chartData.length;
    let m = Math.floor((l + r) / 2);

    while (
      Math.abs(xAxis - (chartData[m].histogram + halfBucketWidth)) > halfBucketWidth
    ) {
      if (xAxis > chartData[m].histogram) {
        l = m + 1;
      } else {
        r = m - 1;
      }
      m = Math.floor((l + r) / 2);
    }

    return m;
  }

  render() {
    return (
      <Card>
        {this.renderSummary()}
        {this.renderHistogram()}
      </Card>
    );
  }
}

/**
 * To compute pixel coordinates, we need at least 2 unique points on the chart.
 * The two points must have different x axis and y axis values for it to work.
 */
function getReferenceRect(chartData: HistogramData[]): Rectangle | null {
  // not enough points to construct 2 reference points
  if (chartData.length < 2) {
    return null;
  }

  for (let i = 0; i < chartData.length; i++) {
    const data1 = chartData[i];
    for (let j = i + 1; j < chartData.length; j++) {
      const data2 = chartData[j];

      if (data1.histogram !== data2.histogram && data1.count !== data2.count) {
        return {
          point1: {x: i, y: Math.min(data1.count, data2.count)},
          point2: {x: j, y: Math.max(data1.count, data2.count)},
        };
      }
    }
  }

  return null;
}

type IndicatorProps = {
  color: string;
};

const Indicator = styled('div')<IndicatorProps>`
  position: absolute;
  left: 0px;
  margin-top: ${space(0.5)};
  width: 6px;
  height: 18px;
  border-radius: 0 3px 3px 0;
  background-color: ${p => p.color};
`;

type TagProps = {
  color: string;
};

const StyledTag = styled(Tag)<TagProps>`
  position: absolute;
  right: ${space(3)};
  background-color: ${p => p.color};
  color: ${p => p.theme.white};
  text-transform: uppercase;
  font-weight: 500;
`;

export default VitalCard;
