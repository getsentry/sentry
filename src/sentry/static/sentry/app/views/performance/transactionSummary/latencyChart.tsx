import React from 'react';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import BarChart from 'app/components/charts/barChart';
import ErrorPanel from 'app/components/charts/errorPanel';
import LoadingPanel from 'app/components/charts/loadingPanel';
import QuestionTooltip from 'app/components/questionTooltip';
import AsyncComponent from 'app/components/asyncComponent';
import {OrganizationSummary} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import theme from 'app/utils/theme';
import {getDuration} from 'app/utils/formatters';
import BarChartZoom from 'app/components/charts/barChartZoom';

import {HeaderTitleLegend} from '../styles';

const NUM_BUCKETS = 15;
const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type ApiResult = {
  histogram_transaction_duration_15: number;
  count: number;
};

type Props = AsyncComponent['props'] &
  ViewProps & {
    organization: OrganizationSummary;
    location: Location;
  };

type State = AsyncComponent['state'] & {
  chartData: {data: ApiResult[]} | null;
  zoomError?: boolean;
};

/**
 * Fetch and render a bar chart that shows event volume
 * for each duration bucket. We always render 15 buckets of
 * equal widths based on the endpoints min + max durations.
 *
 * This graph visualizes how many transactions were recorded
 * at each duration bucket, showing the modality of the transaction.
 */
class LatencyChart extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {
      organization,
      query,
      start,
      end,
      statsPeriod,
      environment,
      project,
      location,
    } = this.props;
    const eventView = EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: [`histogram(transaction.duration,${NUM_BUCKETS})`, 'count()'],
      orderby: 'histogram_transaction_duration_15',
      projects: project,
      range: statsPeriod,
      query,
      environment,
      start,
      end,
    });
    const apiPayload = eventView.getEventsAPIPayload(location);
    apiPayload.referrer = 'api.performance.latencychart';

    return [
      ['chartData', `/organizations/${organization.slug}/eventsv2/`, {query: apiPayload}],
    ];
  }

  componentDidUpdate(prevProps: Props) {
    if (this.shouldRefetchData(prevProps)) {
      this.fetchData();
    }
  }

  shouldRefetchData(prevProps: Props) {
    if (this.state.loading) {
      return false;
    }
    return !isEqual(pick(prevProps, QUERY_KEYS), pick(this.props, QUERY_KEYS));
  }

  handleMouseOver = () => {
    // Hide the zoom error tooltip on the next hover.
    if (this.state.zoomError) {
      this.setState({zoomError: false});
    }
  };

  handleDataZoom = () => {
    const {organization} = this.props;

    trackAnalyticsEvent({
      eventKey: 'performance_views.latency_chart.zoom',
      eventName: 'Performance Views: Transaction Summary Latency Chart Zoom',
      organization_id: parseInt(organization.id, 10),
    });
  };

  handleDataZoomCancelled = () => {
    this.setState({zoomError: true});
  };

  get bucketWidth() {
    if (this.state.chartData === null) {
      return 0;
    }
    // We can assume that all buckets are of equal width, use the first two
    // buckets to get the width. The value of each histogram function indicates
    // the beginning of the bucket.
    const data = this.state.chartData.data;
    return data.length > 2
      ? data[1].histogram_transaction_duration_15 -
          data[0].histogram_transaction_duration_15
      : 0;
  }

  renderLoading() {
    return <LoadingPanel data-test-id="histogram-loading" />;
  }

  renderError() {
    // Don't call super as we don't really need issues for this.
    return (
      <ErrorPanel>
        <IconWarning color="gray500" size="lg" />
      </ErrorPanel>
    );
  }

  renderBody() {
    const {location} = this.props;
    const {chartData, zoomError} = this.state;
    if (chartData === null) {
      return null;
    }
    const xAxis = {
      type: 'category' as const,
      truncate: true,
      axisLabel: {
        margin: 20,
      },
      axisTick: {
        interval: 0,
        alignWithLabel: true,
      },
    };
    const colors = [...theme.charts.getColorPalette(1)];

    // Use a custom tooltip formatter as we need to replace
    // the tooltip content entirely when zooming is no longer available.
    const tooltip = {
      formatter(series) {
        const seriesData = Array.isArray(series) ? series : [series];
        let contents: string[] = [];
        if (!zoomError) {
          // Replicate the necessary logic from app/components/charts/components/tooltip.jsx
          contents = seriesData.map(item => {
            const label = item.seriesName;
            const value = item.value[1].toLocaleString();
            return [
              '<div class="tooltip-series">',
              `<div><span class="tooltip-label">${item.marker} <strong>${label}</strong></span> ${value}</div>`,
              '</div>',
            ].join('');
          });
          const seriesLabel = seriesData[0].value[0];
          contents.push(`<div class="tooltip-date">${seriesLabel}</div>`);
        } else {
          contents = [
            '<div class="tooltip-series tooltip-series-solo">',
            t('Target zoom region too small'),
            '</div>',
          ];
        }
        contents.push('<div class="tooltip-arrow"></div>');
        return contents.join('');
      },
    };

    const bucketWidth = this.bucketWidth;

    const buckets = computeBuckets(chartData.data, bucketWidth);

    return (
      <BarChartZoom
        minZoomWidth={NUM_BUCKETS}
        location={location}
        paramStart="startDuration"
        paramEnd="endDuration"
        xAxisIndex={[0]}
        buckets={buckets}
        onDataZoomCancelled={this.handleDataZoomCancelled}
      >
        {zoomRenderProps => (
          <BarChart
            grid={{left: '10px', right: '10px', top: '40px', bottom: '0px'}}
            xAxis={xAxis}
            yAxis={{type: 'value'}}
            series={transformData(chartData.data, bucketWidth)}
            tooltip={tooltip}
            colors={colors}
            onMouseOver={this.handleMouseOver}
            {...zoomRenderProps}
          />
        )}
      </BarChartZoom>
    );
  }

  render() {
    return (
      <React.Fragment>
        <HeaderTitleLegend>
          {t('Latency Distribution')}
          <QuestionTooltip
            position="top"
            size="sm"
            title={t(
              `Latency Distribution reflects the volume of transactions per median duration.`
            )}
          />
        </HeaderTitleLegend>
        {this.renderComponent()}
      </React.Fragment>
    );
  }
}

function computeBuckets(data: ApiResult[], bucketWidth: number) {
  return data.map(item => {
    const bucket = item.histogram_transaction_duration_15;
    return {
      start: bucket,
      end: bucket + bucketWidth,
    };
  });
}

/**
 * Convert a discover response into a barchart compatible series
 */
function transformData(data: ApiResult[], bucketWidth: number) {
  let precision;
  if (bucketWidth < 10) {
    precision = 4;
  } else if (bucketWidth < 100) {
    precision = 3;
  } else if (bucketWidth < 1000) {
    precision = 2;
  } else if (bucketWidth < 10000) {
    precision = 1;
  } else {
    precision = 0;
  }
  const seriesData = data.map(item => {
    const bucket = item.histogram_transaction_duration_15;
    const midPoint = bucketWidth > 1 ? Math.ceil(bucket + bucketWidth / 2) : bucket;
    return {
      value: item.count,
      name: getDuration(midPoint / 1000, midPoint > 1000 ? precision : 0, true),
    };
  });

  return [
    {
      seriesName: t('Count'),
      data: seriesData,
    },
  ];
}

export default LatencyChart;
