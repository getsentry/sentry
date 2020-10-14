import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {Organization} from 'app/types';
import BarChart from 'app/components/charts/barChart';
import BarChartZoom from 'app/components/charts/barChartZoom';
import MarkArea from 'app/components/charts/components/markArea';
import MarkLine from 'app/components/charts/components/markLine';
import MarkPoint from 'app/components/charts/components/markPoint';
import DiscoverButton from 'app/components/discoverButton';
import Tag from 'app/components/tag';
import {FIRE_SVG_PATH} from 'app/icons/iconFire';
import {t} from 'app/locale';
import space from 'app/styles/space';
import EventView from 'app/utils/discover/eventView';
import {
  formatAbbreviatedNumber,
  formatFloat,
  formatPercentage,
  getDuration,
} from 'app/utils/formatters';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import theme from 'app/utils/theme';

import {NUM_BUCKETS} from './constants';
import {Card, CardSummary, CardSectionHeading, StatNumber, Description} from './styles';
import {HistogramData, Vital, Rectangle} from './types';
import {findNearestBucketIndex, getRefRect, asPixelRect, mapPoint} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  isLoading: boolean;
  error: boolean;
  vital: Vital;
  summary: number | null;
  failureRate: number;
  chartData: HistogramData[];
  colors: [string];
  eventView: EventView;
  min?: string;
  max?: string;
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

    const refDataRect = getRefRect(chartData);
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

  getFormattedStatNumber() {
    const {isLoading, error, summary, vital} = this.props;
    const {type} = vital;

    return isLoading || error || summary === null
      ? '\u2014'
      : type === 'duration'
      ? getDuration(summary / 1000, 2, true)
      : formatFloat(summary, 2);
  }

  renderSummary() {
    const {
      isLoading,
      error,
      summary,
      vital,
      colors,
      eventView,
      organization,
      min,
      max,
    } = this.props;
    const {slug, name, description, failureThreshold} = vital;

    const column = `measurements.${slug}`;

    const newEventView = eventView
      .withColumns([
        {kind: 'field', field: 'transaction'},
        {kind: 'field', field: `user.display`},
        {kind: 'field', field: column},
      ])
      .withSorts([{kind: 'desc', field: column}]);

    // add in any range constraints if any
    if (min !== undefined || max !== undefined) {
      const query = tokenizeSearch(newEventView.query ?? '');
      if (min !== undefined) {
        query.addTagValues(column, [`>=${min}`]);
      }
      if (max !== undefined) {
        query.addTagValues(column, [`<=${max}`]);
      }
      newEventView.query = stringifyQueryObject(query);
    }

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
        <StatNumber>{this.getFormattedStatNumber()}</StatNumber>
        <Description>{description}</Description>
        <div>
          <DiscoverButton
            size="small"
            to={newEventView.getResultsViewUrlTarget(organization.slug)}
          >
            {t('Open in Discover')}
          </DiscoverButton>
        </div>
      </CardSummary>
    );
  }

  /**
   * This callback happens everytime ECharts finishes rendering. This includes
   * when it finishes rendering tooltips, so it can be called quite frequently.
   * The calculations here can get expensive if done frequently, furthermore,
   * this can trigger a state change leading to a re-render. So slow down the
   * updates here as they do not need to be updated every single time.
   */
  handleFinished = debounce(
    (_, chartRef) => {
      const {chartData} = this.props;
      const {refDataRect} = this.state;

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
    {leading: true, trailing: true, maxWait: 1000}
  );

  handleDataZoomCancelled = () => {};

  renderHistogram() {
    const {location, colors} = this.props;

    const series = this.getTransformedData();

    const xAxis = {
      type: 'category',
      truncate: true,
      axisLabel: {
        margin: 20,
      },
      axisTick: {
        alignWithLabel: true,
      },
    };

    const values = series.data.map(point => point.value);
    const max = values.length ? Math.max(...values) : undefined;

    const yAxis = {
      type: 'value',
      max,
      axisLabel: {
        color: theme.gray400,
        formatter: formatAbbreviatedNumber,
      },
    };

    return (
      <BarChartZoom
        minZoomWidth={NUM_BUCKETS}
        location={location}
        paramStart="startMeasurements"
        paramEnd="endMeasurements"
        xAxisIndex={[0]}
        buckets={this.computeBuckets()}
        onDataZoomCancelled={this.handleDataZoomCancelled}
      >
        {zoomRenderProps => (
          <BarChart
            series={[series]}
            xAxis={xAxis}
            yAxis={yAxis}
            colors={colors}
            onFinished={this.handleFinished}
            grid={{left: space(3), right: space(3), top: space(3), bottom: space(1.5)}}
            {...zoomRenderProps}
          />
        )}
      </BarChartZoom>
    );
  }

  bucketWidth() {
    const {chartData} = this.props;
    // We can assume that all buckets are of equal width, use the first two
    // buckets to get the width. The value of each histogram function indicates
    // the beginning of the bucket.
    return chartData.length >= 2 ? chartData[1].histogram - chartData[0].histogram : 0;
  }

  computeBuckets() {
    const {chartData} = this.props;
    const bucketWidth = this.bucketWidth();

    return chartData.map(item => {
      const bucket = item.histogram;
      return {
        start: bucket,
        end: bucket + bucketWidth,
      };
    });
  }

  getTransformedData() {
    const {chartData, vital} = this.props;
    const bucketWidth = this.bucketWidth();

    const seriesData = chartData.map(item => {
      const bucket = item.histogram;
      const midPoint = bucketWidth > 1 ? Math.ceil(bucket + bucketWidth / 2) : bucket;
      const name =
        vital.type === 'duration'
          ? formatDuration(midPoint)
          : formatFloat(midPoint, 2).toLocaleString();

      return {
        value: item.count,
        name,
      };
    });

    const series = {
      seriesName: t('Count'),
      data: seriesData,
    };

    this.drawBaselineValue(series);
    this.drawFailRegion(series);

    return series;
  }

  drawBaselineValue(series) {
    const {chartData, summary} = this.props;
    if (summary === null || this.state.refPixelRect === null) {
      return;
    }

    const summaryBucket = findNearestBucketIndex(chartData, this.bucketWidth(), summary);
    if (summaryBucket === null || summaryBucket === -1) {
      return;
    }

    const thresholdPixelBottom = mapPoint(
      {
        // subtract 0.5 from the x here to ensure that the threshold lies between buckets
        x: summaryBucket - 0.5,
        y: 0,
      },
      this.state.refDataRect!,
      this.state.refPixelRect!
    );
    if (thresholdPixelBottom === null) {
      return;
    }

    const thresholdPixelTop = mapPoint(
      {
        // subtract 0.5 from the x here to ensure that the threshold lies between buckets
        x: summaryBucket - 0.5,
        y: Math.max(...chartData.map(data => data.count)) || 1,
      },
      this.state.refDataRect!,
      this.state.refPixelRect!
    );
    if (thresholdPixelTop === null) {
      return;
    }

    series.markLine = MarkLine({
      data: [[thresholdPixelBottom, thresholdPixelTop] as any],
      label: {
        show: false,
      },
      lineStyle: {
        color: theme.gray700,
        type: 'solid',
      },
    });

    // TODO(tonyx): This conflicts with the types declaration of `MarkLine`
    // if we add it in the constructor. So we opt to add it here so typescript
    // doesn't complain.
    series.markLine.tooltip = {
      formatter: () => {
        return [
          '<div class="tooltip-series tooltip-series-solo">',
          '<span class="tooltip-label">',
          `<strong>${t('Baseline')}</strong>`,
          '</span>',
          '</div>',
          '<div class="tooltip-arrow"></div>',
        ].join('');
      },
    };
  }

  drawFailRegion(series) {
    const {chartData, vital, failureRate} = this.props;
    const {failureThreshold} = vital;
    if (this.state.refDataRect === null || this.state.refPixelRect === null) {
      return;
    }

    let failureBucket = findNearestBucketIndex(
      chartData,
      this.bucketWidth(),
      failureThreshold
    );
    if (failureBucket === null) {
      return;
    }
    failureBucket = failureBucket === -1 ? 0 : failureBucket;

    // since we found the failure bucket, the failure threshold is
    // visible on the graph, so let's draw the fail region
    const failurePixel = mapPoint(
      {
        // subtract 0.5 from the x here to ensure that the boundary of
        // the failure region lies between buckets
        x: failureBucket - 0.5,
        y: 0,
      },
      this.state.refDataRect!,
      this.state.refPixelRect!
    );
    if (failurePixel === null) {
      return;
    }

    series.markArea = MarkArea({
      data: [
        [
          {x: failurePixel.x, yAxis: 0},
          {x: 'max', y: 'max'},
        ] as any,
      ],
      itemStyle: {
        color: 'transparent',
        borderColor: theme.red400,
        borderWidth: 1.5,
        borderType: 'dashed',
      },
    });

    // TODO(tonyx): This conflicts with the types declaration of `MarkArea`
    // if we add it in the constructor. So we opt to add it here so typescript
    // doesn't complain.
    series.markArea.tooltip = {
      formatter: () =>
        [
          '<div class="tooltip-series tooltip-series-solo">',
          '<span class="tooltip-label">',
          '<strong>',
          t('Fails threshold at %s.', getDuration(failureThreshold / 1000)),
          '</strong>',
          '</span>',
          '</div>',
          '<div class="tooltip-arrow"></div>',
        ].join(''),
    };

    const topRightPixel = mapPoint(
      {
        // subtract 0.5 to get on the right side of the right most bar
        x: chartData.length - 0.5,
        y: Math.max(...chartData.map(data => data.count)) || 1,
      },
      this.state.refDataRect!,
      this.state.refPixelRect!
    );
    if (topRightPixel === null) {
      return;
    }

    series.markPoint = MarkPoint({
      data: [{x: topRightPixel.x - 16, y: topRightPixel.y + 16}] as any,
      itemStyle: {color: theme.red400},
      silent: true,
      symbol: `path://${FIRE_SVG_PATH}`,
      symbolKeepAspect: true,
      symbolSize: [14, 16],
      label: {
        formatter: formatPercentage(failureRate, 0),
        position: 'left',
      },
    });
  }

  approxFailureRate(failureIndex) {
    const {chartData} = this.props;

    const failures = chartData
      .slice(failureIndex)
      .reduce((sum, data) => sum + data.count, 0);
    const total = chartData.reduce((sum, data) => sum + data.count, 0);
    if (total === 0) {
      return 0;
    }

    return failures / total;
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

type IndicatorProps = {
  color: string;
};

const Indicator = styled('div')<IndicatorProps>`
  position: absolute;
  top: 20px;
  left: 0px;
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
`;

function formatDuration(duration: number) {
  // assume duration is in milliseconds.

  if (duration <= 1000) {
    return getDuration(duration / 1000, 2, true);
  }

  return getDuration(duration / 1000, 3, true);
}

export default VitalCard;
