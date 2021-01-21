import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import throttle from 'lodash/throttle';

import Feature from 'app/components/acl/feature';
import BarChart from 'app/components/charts/barChart';
import BarChartZoom from 'app/components/charts/barChartZoom';
import MarkLine from 'app/components/charts/components/markLine';
import MarkPoint from 'app/components/charts/components/markPoint';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import DiscoverButton from 'app/components/discoverButton';
import Tag from 'app/components/tag';
import {FIRE_SVG_PATH} from 'app/icons/iconFire';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias, WebVital} from 'app/utils/discover/fields';
import {
  formatAbbreviatedNumber,
  formatFloat,
  formatPercentage,
  getDuration,
} from 'app/utils/formatters';
import theme from 'app/utils/theme';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';

import {
  VitalState,
  vitalStateColors,
  webVitalMeh,
  webVitalPoor,
} from '../vitalDetail/utils';
import VitalInfo from '../vitalDetail/vitalInfo';

import {NUM_BUCKETS, PERCENTILE} from './constants';
import {Card, CardSectionHeading, CardSummary, Description, StatNumber} from './styles';
import {HistogramData, Rectangle, Vital} from './types';
import {asPixelRect, findNearestBucketIndex, getRefRect, mapPoint} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  isLoading: boolean;
  error: boolean;
  vital: WebVital;
  vitalDetails: Vital;
  summary: number | null;
  failureRate: number;
  chartData: HistogramData[];
  colors: [string];
  eventView: EventView;
  min?: number;
  max?: number;
  precision?: number;
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

  showVitalColours() {
    return this.props.organization.features.includes('performance-vitals-overview');
  }

  trackOpenInDiscoverClicked = () => {
    const {organization} = this.props;
    const {vitalDetails: vital} = this.props;

    trackAnalyticsEvent({
      eventKey: 'performance_views.vitals.open_in_discover',
      eventName: 'Performance Views: Open vitals in discover',
      organization_id: organization.id,
      vital: vital.slug,
    });
  };

  getFormattedStatNumber() {
    const {summary, vitalDetails: vital} = this.props;
    const {type} = vital;

    return summary === null
      ? '\u2014'
      : type === 'duration'
      ? getDuration(summary / 1000, 2, true)
      : formatFloat(summary, 2);
  }

  renderSummary() {
    const {
      summary,
      vitalDetails: vital,
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
        {kind: 'function', function: ['percentile', column, PERCENTILE.toString()]},
        {kind: 'function', function: ['count', '', '']},
      ])
      .withSorts([
        {
          kind: 'desc',
          field: getAggregateAlias(`percentile(${column},${PERCENTILE.toString()})`),
        },
      ]);

    const query = tokenizeSearch(newEventView.query ?? '');
    query.addTagValues('has', [column]);
    // add in any range constraints if any
    if (min !== undefined || max !== undefined) {
      if (min !== undefined) {
        query.addTagValues(column, [`>=${min}`]);
      }
      if (max !== undefined) {
        query.addTagValues(column, [`<=${max}`]);
      }
    }
    newEventView.query = stringifyQueryObject(query);

    return (
      <CardSummary>
        {!this.showVitalColours() && <Indicator color={colors[0]} />}
        <SummaryHeading>
          <CardSectionHeading>{`${name} (${slug.toUpperCase()})`}</CardSectionHeading>
          {summary === null || this.showVitalColours() ? null : summary <
            failureThreshold ? (
            <Tag>{t('Pass')}</Tag>
          ) : (
            <StyledTag>{t('Fail')}</StyledTag>
          )}
        </SummaryHeading>
        <StatNumber>{this.getFormattedStatNumber()}</StatNumber>
        <Description>{description}</Description>
        <div>
          <DiscoverButton
            size="small"
            to={newEventView.getResultsViewUrlTarget(organization.slug)}
            onClick={this.trackOpenInDiscoverClicked}
          >
            {t('Open in Discover')}
          </DiscoverButton>
        </div>
      </CardSummary>
    );
  }

  /**
   * This callback happens everytime ECharts renders. This is NOT when ECharts
   * finishes rendering, so it can be called quite frequently. The calculations
   * here can get expensive if done frequently, furthermore, this can trigger a
   * state change leading to a re-render. So slow down the updates here as they
   * do not need to be updated every single time.
   */
  handleRendered = throttle(
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
    {leading: true}
  );

  handleDataZoomCancelled = () => {};

  renderHistogram() {
    const {
      location,
      organization,
      isLoading,
      error,
      colors,
      vital,
      vitalDetails,
      eventView,
      precision = 0,
    } = this.props;
    const {slug} = vitalDetails;

    const series = this.getSeries();

    const xAxis = {
      type: 'category' as const,
      truncate: true,
      axisTick: {
        alignWithLabel: true,
      },
    };

    const values = series.data.map(point => point.value);
    const max = values.length ? Math.max(...values) : undefined;

    const yAxis = {
      type: 'value' as const,
      max,
      axisLabel: {
        color: theme.chartLabel,
        formatter: formatAbbreviatedNumber,
      },
    };

    const allSeries = [series];
    if (!isLoading && !error) {
      const baselineSeries = this.getBaselineSeries();
      if (baselineSeries !== null) {
        allSeries.push(baselineSeries);
      }
      if (!this.showVitalColours()) {
        const failureSeries = this.getFailureSeries();
        if (failureSeries !== null) {
          allSeries.push(failureSeries);
        }
      }
    }

    return (
      <BarChartZoom
        minZoomWidth={10 ** -precision * NUM_BUCKETS}
        location={location}
        paramStart={`${slug}Start`}
        paramEnd={`${slug}End`}
        xAxisIndex={[0]}
        buckets={this.computeBuckets()}
        onDataZoomCancelled={this.handleDataZoomCancelled}
      >
        {zoomRenderProps => (
          <Container>
            <TransparentLoadingMask visible={isLoading} />
            <Feature features={['organizations:performance-vitals-overview']}>
              <PercentContainer>
                <VitalInfo
                  eventView={eventView}
                  organization={organization}
                  location={location}
                  vital={vital}
                  hideBar
                  hideStates
                  hideVitalPercentNames
                  hideDurationDetail
                />
              </PercentContainer>
            </Feature>
            <BarChart
              series={allSeries}
              xAxis={xAxis}
              yAxis={yAxis}
              colors={colors}
              onRendered={this.handleRendered}
              grid={{left: space(3), right: space(3), top: space(3), bottom: space(1.5)}}
              stacked
              {...zoomRenderProps}
            />
          </Container>
        )}
      </BarChartZoom>
    );
  }

  bucketWidth() {
    const {chartData} = this.props;
    // We can assume that all buckets are of equal width, use the first two
    // buckets to get the width. The value of each histogram function indicates
    // the beginning of the bucket.
    return chartData.length >= 2 ? chartData[1].bin - chartData[0].bin : 0;
  }

  computeBuckets() {
    const {chartData} = this.props;
    const bucketWidth = this.bucketWidth();

    return chartData.map(item => {
      const bucket = item.bin;
      return {
        start: bucket,
        end: bucket + bucketWidth,
      };
    });
  }

  getSeries() {
    const {chartData, vitalDetails, vital} = this.props;
    const bucketWidth = this.bucketWidth();

    const seriesData = chartData.map(item => {
      const bucket = item.bin;
      const midPoint = bucketWidth > 1 ? Math.ceil(bucket + bucketWidth / 2) : bucket;
      const name =
        vitalDetails.type === 'duration'
          ? formatDuration(midPoint)
          : // This is trying to avoid some of potential rounding errors that cause bins
            // have the same label, if the number of bins doesn't visually match what is
            // expected, check that this rounding is correct. If this issue persists,
            // consider formatting the bin as a string in the response
            (Math.round((midPoint + Number.EPSILON) * 100) / 100).toLocaleString();

      const value = item.count;

      if (this.showVitalColours()) {
        return {
          value,
          name,
          itemStyle: {color: this.getVitalsColor(vital, midPoint)},
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

  getVitalsColor(vital: WebVital, value: number) {
    const poorThreshold = webVitalPoor[vital];
    const mehThreshold = webVitalMeh[vital];

    if (value > poorThreshold) {
      return vitalStateColors[VitalState.POOR];
    } else if (value > mehThreshold) {
      return vitalStateColors[VitalState.MEH];
    } else {
      return vitalStateColors[VitalState.GOOD];
    }
  }

  getBaselineSeries() {
    const {chartData, summary} = this.props;
    if (summary === null || this.state.refPixelRect === null) {
      return null;
    }

    const summaryBucket = findNearestBucketIndex(chartData, this.bucketWidth(), summary);
    if (summaryBucket === null || summaryBucket === -1) {
      return null;
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
      return null;
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
      return null;
    }

    const markLine = MarkLine({
      animationDuration: 200,
      data: [[thresholdPixelBottom, thresholdPixelTop] as any],
      label: {
        show: false,
      },
      lineStyle: {
        color: theme.textColor,
        type: 'solid',
      },
    });

    // TODO(tonyx): This conflicts with the types declaration of `MarkLine`
    // if we add it in the constructor. So we opt to add it here so typescript
    // doesn't complain.
    (markLine as any).tooltip = {
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

    return {
      seriesName: t('Baseline'),
      data: [],
      markLine,
    };
  }

  getFailureSeries() {
    const {chartData, vitalDetails: vital, failureRate} = this.props;
    const {failureThreshold, type} = vital;
    if (this.state.refDataRect === null || this.state.refPixelRect === null) {
      return null;
    }

    let failureBucket = findNearestBucketIndex(
      chartData,
      this.bucketWidth(),
      failureThreshold
    );
    if (failureBucket === null) {
      return null;
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
      return null;
    }

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
      return null;
    }

    // Using a MarkArea means that hovering over the interior of the area
    // will trigger the tooltip for the MarkArea, making it impossible to
    // see outliers with the tooltip. So we get around this using lines.
    const markLine = MarkLine({
      animation: false,
      data: [
        // left
        [
          {x: failurePixel.x, y: failurePixel.y},
          {x: failurePixel.x, y: topRightPixel.y},
        ] as any,
        // top
        [
          {x: failurePixel.x, y: topRightPixel.y},
          {x: topRightPixel.x, y: topRightPixel.y},
        ] as any,
        // right
        [
          {x: topRightPixel.x, y: topRightPixel.y},
          {x: topRightPixel.x, y: failurePixel.y},
        ] as any,
        // We do not draw the bottom line of the the box because it
        // partially obscures possible outliers.
      ],
      label: {
        show: false,
      },
      lineStyle: {
        color: theme.red300,
        type: 'dashed',
        width: 1.5,
        // prevent each individual line from looking emphasized
        // by styling it the same as the unemphasized line
        emphasis: {
          color: theme.red300,
          type: 'dashed',
          width: 1.5,
        },
      },
    });

    // TODO(tonyx): This conflicts with the types declaration of `MarkLine`
    // if we add it in the constructor. So we opt to add it here so typescript
    // doesn't complain.
    (markLine as any).tooltip = {
      formatter: () =>
        [
          '<div class="tooltip-series tooltip-series-solo">',
          '<span class="tooltip-label">',
          '<strong>',
          t(
            'Fails threshold at %s.',
            type === 'duration'
              ? getDuration(failureThreshold / 1000, 2, true)
              : formatFloat(failureThreshold, 2)
          ),
          '</strong>',
          '</span>',
          '</div>',
          '<div class="tooltip-arrow"></div>',
        ].join(''),
    };

    const markPoint = MarkPoint({
      animationDuration: 200,
      data: [{x: topRightPixel.x - 16, y: topRightPixel.y + 16}] as any,
      itemStyle: {color: theme.red300},
      silent: true,
      symbol: `path://${FIRE_SVG_PATH}`,
      symbolKeepAspect: true,
      symbolSize: [14, 16],
      label: {
        formatter: formatPercentage(failureRate, 0),
        position: 'left',
      },
    });

    return {
      seriesName: t('Failure Region'),
      data: [],
      markLine,
      markPoint,
    };
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
  height: 20px;
  border-radius: 0 3px 3px 0;
  background-color: ${p => p.color};
`;

const SummaryHeading = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const Container = styled('div')`
  position: relative;
`;

const PercentContainer = styled('div')`
  position: absolute;
  top: ${space(2)};
  right: ${space(3)};
  z-index: 2;
`;

const StyledTag = styled(Tag)`
  div {
    background-color: ${p => p.theme.red300};
  }
  span {
    color: ${p => p.theme.white};
  }
`;

function formatDuration(duration: number) {
  // assume duration is in milliseconds.

  if (duration <= 1000) {
    return getDuration(duration / 1000, 2, true);
  }

  return getDuration(duration / 1000, 3, true);
}

export default VitalCard;
