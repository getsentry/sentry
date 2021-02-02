import React from 'react';
import {Location} from 'history';

import BarChart from 'app/components/charts/barChart';
import BarChartZoom from 'app/components/charts/barChartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import LoadingPanel from 'app/components/charts/loadingPanel';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import theme from 'app/utils/theme';

import {computeBuckets, formatHistogramData} from '../charts/utils';
import {HeaderTitleLegend} from '../styles';
import HistogramQuery from '../transactionVitals/histogramQuery';
import {HistogramData} from '../transactionVitals/types';

const NUM_BUCKETS = 50;
const QUERY_KEYS = [
  'environment',
  'project',
  'query',
  'start',
  'end',
  'statsPeriod',
] as const;

type ViewProps = Pick<EventView, typeof QUERY_KEYS[number]>;

type Props = ViewProps & {
  organization: OrganizationSummary;
  location: Location;
};

type State = {
  zoomError: boolean;
};

/**
 * Fetch and render a bar chart that shows event volume
 * for each duration bucket. We always render 50 buckets of
 * equal widths based on the endpoints min + max durations.
 *
 * This graph visualizes how many transactions were recorded
 * at each duration bucket, showing the modality of the transaction.
 */
class LatencyChart extends React.Component<Props, State> {
  state = {
    zoomError: false,
  };

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

  bucketWidth(data: HistogramData[]) {
    // We can assume that all buckets are of equal width, use the first two
    // buckets to get the width. The value of each histogram function indicates
    // the beginning of the bucket.
    return data.length > 2 ? data[1].bin - data[0].bin : 0;
  }

  renderLoading() {
    return <LoadingPanel data-test-id="histogram-loading" />;
  }

  renderError() {
    // Don't call super as we don't really need issues for this.
    return (
      <ErrorPanel>
        <IconWarning color="gray300" size="lg" />
      </ErrorPanel>
    );
  }

  renderChart(data: HistogramData[]) {
    const {location} = this.props;
    const {zoomError} = this.state;

    const xAxis = {
      type: 'category' as const,
      truncate: true,
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

    const series = {
      seriesName: t('Count'),
      data: formatHistogramData(data, {type: 'duration'}),
    };

    return (
      <BarChartZoom
        minZoomWidth={NUM_BUCKETS}
        location={location}
        paramStart="startDuration"
        paramEnd="endDuration"
        xAxisIndex={[0]}
        buckets={computeBuckets(data)}
        onDataZoomCancelled={this.handleDataZoomCancelled}
      >
        {zoomRenderProps => (
          <BarChart
            grid={{left: '10px', right: '10px', top: '40px', bottom: '0px'}}
            xAxis={xAxis}
            yAxis={{type: 'value'}}
            series={[series]}
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
    const eventView = EventView.fromNewQueryWithLocation(
      {
        id: undefined,
        version: 2,
        name: '',
        fields: ['transaction.duration'],
        projects: project,
        range: statsPeriod,
        query,
        environment,
        start,
        end,
      },
      location
    );

    const min = parseInt(decodeScalar(location.query.startDuration, '0'), 10);

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
        <HistogramQuery
          location={location}
          orgSlug={organization.slug}
          eventView={eventView}
          numBuckets={NUM_BUCKETS}
          fields={['transaction.duration']}
          min={min}
          dataFilter="exclude_outliers"
        >
          {({histograms, isLoading, error}) => {
            if (isLoading) {
              return this.renderLoading();
            } else if (error) {
              return this.renderError();
            }

            const data = histograms?.['transaction.duration'] ?? [];
            return this.renderChart(data);
          }}
        </HistogramQuery>
      </React.Fragment>
    );
  }
}

export default LatencyChart;
