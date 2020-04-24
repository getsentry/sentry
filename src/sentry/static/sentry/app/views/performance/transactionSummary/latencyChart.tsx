import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import {Panel} from 'app/components/panels';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import BarChart from 'app/components/charts/barChart';
import ErrorPanel from 'app/components/charts/components/errorPanel';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import AsyncComponent from 'app/components/asyncComponent';
import Tooltip from 'app/components/tooltip';
import {OrganizationSummary} from 'app/types';
import LoadingPanel from 'app/views/events/loadingPanel';
import EventView from 'app/utils/discover/eventView';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import theme from 'app/utils/theme';
import {getDuration} from 'app/utils/formatters';

import {HeaderTitle, ChartsContainer, StyledIconQuestion} from '../styles';

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
 * Fetch the chart data and then render the graph.
 */
class LatencyHistogram extends AsyncComponent<Props, State> {
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

  handleClick = value => {
    const {chartData} = this.state;
    if (chartData === null) {
      return;
    }
    const {location, organization} = this.props;
    const valueIndex = value.dataIndex;

    // If the active bar is clicked again we need to remove the constraints.
    const startDuration = chartData.data[valueIndex].histogram_transaction_duration_15;
    const endDuration = startDuration + this.bucketWidth;
    // Re-render showing a zoom error above the current bar.
    if ((endDuration - startDuration) / NUM_BUCKETS < 0.6) {
      this.setState({
        zoomError: true,
      });
      return;
    }

    trackAnalyticsEvent({
      eventKey: 'performance_views.latency_chart.zoom',
      eventName: 'Performance Views: Transaction Summary Latency Chart Zoom',
      organization_id: parseInt(organization.id, 10),
    });

    const target = {
      pathname: location.pathname,
      query: {
        ...location.query,
        startDuration,
        endDuration,
      },
    };
    browserHistory.push(target);
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
        <IconWarning color={theme.gray2} size="lg" />
      </ErrorPanel>
    );
  }

  renderBody() {
    const {chartData, zoomError} = this.state;
    if (chartData === null) {
      return null;
    }
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
            t('You cannot zoom in any further'),
            '</div>',
          ];
        }
        contents.push('<div class="tooltip-arrow"></div>');
        return contents.join('');
      },
    };

    return (
      <React.Fragment>
        <BarChart
          grid={{left: '10px', right: '10px', top: '16px', bottom: '0px'}}
          xAxis={xAxis}
          yAxis={{type: 'value'}}
          series={transformData(chartData.data, this.bucketWidth)}
          tooltip={tooltip}
          colors={['rgba(140, 79, 189, 0.3)']}
          onClick={this.handleClick}
          onMouseOver={this.handleMouseOver}
        />
      </React.Fragment>
    );
  }
}

function calculateTotal(total: number | null) {
  if (total === null) {
    return '\u2014';
  }
  return total.toLocaleString();
}

type WrapperProps = ViewProps & {
  organization: OrganizationSummary;
  location: Location;
  totalValues: number | null;
};

function LatencyChart({totalValues, ...props}: WrapperProps) {
  return (
    <Panel>
      <ChartsContainer>
        <HeaderTitle>
          {t('Latency Distribution')}
          <Tooltip
            position="top"
            title={t(
              `Latency Distribution reflects the volume of transactions per median duration.`
            )}
          >
            <StyledIconQuestion />
          </Tooltip>
        </HeaderTitle>
        <LatencyHistogram {...props} />
      </ChartsContainer>
      <ChartControls>
        <InlineContainer>
          <SectionHeading key="total-heading">{t('Total Events')}</SectionHeading>
          <SectionValue key="total-value">{calculateTotal(totalValues)}</SectionValue>
        </InlineContainer>
      </ChartControls>
    </Panel>
  );
}

/**
 * Convert a discover response into a barchart compatible series
 */
function transformData(data: ApiResult[], bucketWidth: number) {
  const seriesData = data.map(item => {
    const bucket = item.histogram_transaction_duration_15;
    const midPoint = bucketWidth > 1 ? Math.ceil(bucket + bucketWidth / 2) : bucket;
    return {
      value: item.count,
      name: getDuration(midPoint / 1000, 2, true),
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
