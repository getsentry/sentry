import {Component} from 'react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import throttle from 'lodash/throttle';

import Button from 'sentry/components/button';
import BarChart, {BarChartSeries} from 'sentry/components/charts/barChart';
import BarChartZoom from 'sentry/components/charts/barChartZoom';
import MarkLine from 'sentry/components/charts/components/markLine';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {getAggregateAlias, WebVital} from 'sentry/utils/discover/fields';
import {formatAbbreviatedNumber, formatFloat, getDuration} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import {DataFilter, HistogramData} from 'sentry/utils/performance/histogram/types';
import {
  computeBuckets,
  formatHistogramData,
} from 'sentry/utils/performance/histogram/utils';
import {Vital} from 'sentry/utils/performance/vitals/types';
import {VitalData} from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';
import {Theme} from 'sentry/utils/theme';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {EventsDisplayFilterName} from 'sentry/views/performance/transactionSummary/transactionEvents/utils';

import {VitalBar} from '../../landing/vitalsCards';
import {
  VitalState,
  vitalStateColors,
  webVitalMeh,
  webVitalPoor,
} from '../../vitalDetail/utils';

import {NUM_BUCKETS, PERCENTILE} from './constants';
import {Card, CardSectionHeading, CardSummary, Description, StatNumber} from './styles';
import {Rectangle} from './types';
import {asPixelRect, findNearestBucketIndex, getRefRect, mapPoint} from './utils';

type Props = {
  chartData: HistogramData;
  colors: [string];
  error: boolean;
  eventView: EventView;
  isLoading: boolean;
  location: Location;
  organization: Organization;
  summaryData: VitalData | null;
  theme: Theme;
  vital: WebVital;
  vitalDetails: Vital;
  dataFilter?: DataFilter;
  max?: number;
  min?: number;
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

class VitalCard extends Component<Props, State> {
  state: State = {
    refDataRect: null,
    refPixelRect: null,
  };

  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State) {
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

  trackOpenAllEventsClicked = () => {
    const {organization} = this.props;
    const {vitalDetails: vital} = this.props;

    trackAnalyticsEvent({
      eventKey: 'performance_views.vitals.open_all_events',
      eventName: 'Performance Views: Open vitals in all events',
      organization_id: organization.id,
      vital: vital.slug,
    });
  };

  get summary() {
    const {summaryData} = this.props;
    return summaryData?.p75 ?? null;
  }

  get failureRate() {
    const {summaryData} = this.props;
    const numerator = summaryData?.poor ?? 0;
    const denominator = summaryData?.total ?? 0;
    return denominator <= 0 ? 0 : numerator / denominator;
  }

  getFormattedStatNumber() {
    const {vitalDetails: vital} = this.props;
    const summary = this.summary;
    const {type} = vital;

    return summary === null
      ? '\u2014'
      : type === 'duration'
      ? getDuration(summary / 1000, 2, true)
      : formatFloat(summary, 2);
  }

  renderSummary() {
    const {
      vitalDetails: vital,
      eventView,
      organization,
      min,
      max,
      dataFilter,
    } = this.props;
    const {slug, name, description} = vital;

    const column = `measurements.${slug}`;

    const newEventView = eventView
      .withColumns([
        {kind: 'field', field: 'transaction'},
        {
          kind: 'function',
          function: ['percentile', column, PERCENTILE.toString(), undefined],
        },
        {kind: 'function', function: ['count', '', '', undefined]},
      ])
      .withSorts([
        {
          kind: 'desc',
          field: getAggregateAlias(`percentile(${column},${PERCENTILE.toString()})`),
        },
      ]);

    const query = new MutableSearch(newEventView.query ?? '');
    query.addFilterValues('has', [column]);
    // add in any range constraints if any
    if (min !== undefined || max !== undefined) {
      if (min !== undefined) {
        query.addFilterValues(column, [`>=${min}`]);
      }
      if (max !== undefined) {
        query.addFilterValues(column, [`<=${max}`]);
      }
    }
    newEventView.query = query.formatString();

    return (
      <CardSummary>
        <SummaryHeading>
          <CardSectionHeading>{`${name} (${slug.toUpperCase()})`}</CardSectionHeading>
        </SummaryHeading>
        <StatNumber>
          {getDynamicText({
            value: this.getFormattedStatNumber(),
            fixed: '\u2014',
          })}
        </StatNumber>
        <Description>{description}</Description>
        <div>
          <Button
            size="xsmall"
            to={newEventView
              .withColumns([{kind: 'field', field: column}])
              .withSorts([{kind: 'desc', field: column}])
              .getPerformanceTransactionEventsViewUrlTarget(organization.slug, {
                showTransactions:
                  dataFilter === 'all'
                    ? EventsDisplayFilterName.p100
                    : EventsDisplayFilterName.p75,
                webVital: column as WebVital,
              })}
            onClick={this.trackOpenAllEventsClicked}
          >
            {t('View All Events')}
          </Button>
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
      theme,
      location,
      isLoading,
      chartData,
      summaryData,
      error,
      colors,
      vital,
      vitalDetails,
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
    }

    const vitalData =
      !isLoading && !error && summaryData !== null ? {[vital]: summaryData} : {};

    return (
      <BarChartZoom
        minZoomWidth={10 ** -precision * NUM_BUCKETS}
        location={location}
        paramStart={`${slug}Start`}
        paramEnd={`${slug}End`}
        xAxisIndex={[0]}
        buckets={computeBuckets(chartData)}
        onDataZoomCancelled={this.handleDataZoomCancelled}
      >
        {zoomRenderProps => (
          <Container>
            <TransparentLoadingMask visible={isLoading} />
            <PercentContainer>
              <VitalBar
                isLoading={isLoading}
                data={vitalData}
                vital={vital}
                showBar={false}
                showStates={false}
                showVitalPercentNames={false}
                showDurationDetail={false}
              />
            </PercentContainer>
            {getDynamicText({
              value: (
                <BarChart
                  series={allSeries}
                  xAxis={xAxis}
                  yAxis={yAxis}
                  colors={colors}
                  onRendered={this.handleRendered}
                  grid={{
                    left: space(3),
                    right: space(3),
                    top: space(3),
                    bottom: space(1.5),
                  }}
                  stacked
                  {...zoomRenderProps}
                />
              ),
              fixed: <Placeholder testId="skeleton-ui" height="200px" />,
            })}
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

  getSeries() {
    const {theme, chartData, precision, vitalDetails, vital} = this.props;

    const additionalFieldsFn = bucket => {
      return {
        itemStyle: {color: theme[this.getVitalsColor(vital, bucket)]},
      };
    };

    const data = formatHistogramData(chartData, {
      precision: precision === 0 ? undefined : precision,
      type: vitalDetails.type,
      additionalFieldsFn,
    });

    return {
      seriesName: t('Count'),
      data,
    };
  }

  getVitalsColor(vital: WebVital, value: number) {
    const poorThreshold = webVitalPoor[vital];
    const mehThreshold = webVitalMeh[vital];

    if (value >= poorThreshold) {
      return vitalStateColors[VitalState.POOR];
    }
    if (value >= mehThreshold) {
      return vitalStateColors[VitalState.MEH];
    }
    return vitalStateColors[VitalState.GOOD];
  }

  getBaselineSeries(): BarChartSeries | null {
    const {theme, chartData} = this.props;
    const summary = this.summary;
    if (summary === null || this.state.refPixelRect === null) {
      return null;
    }

    const summaryBucket = findNearestBucketIndex(chartData, summary);
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
      tooltip: {
        formatter: () => {
          return [
            '<div class="tooltip-series tooltip-series-solo">',
            '<span class="tooltip-label">',
            `<strong>${t('p75')}</strong>`,
            '</span>',
            '</div>',
            '<div class="tooltip-arrow"></div>',
          ].join('');
        },
      },
    });

    return {
      seriesName: t('p75'),
      data: [],
      markLine,
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

export default withTheme(VitalCard);
