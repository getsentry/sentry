import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Panel} from 'app/components/panels';
import {IconQuestion, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import BarChart from 'app/components/charts/barChart';
import Tooltip from 'app/components/tooltip';
import AsyncComponent from 'app/components/asyncComponent';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
  SubHeading,
  ErrorPanel,
} from 'app/views/eventsV2/styles';
import {OrganizationSummary} from 'app/types';
import LoadingPanel from 'app/views/events/loadingPanel';
import EventView from 'app/views/eventsV2/eventView';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import {getDuration} from 'app/utils/formatters';

type ViewProps = Pick<
  EventView,
  'environment' | 'project' | 'query' | 'start' | 'end' | 'statsPeriod'
>;

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
};

/**
 * Fetch the chart data and then render the chart panel.
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
      fields: ['histogram(transaction.duration,15)', 'count()'],
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
    return (
      prevProps.query !== this.props.query ||
      prevProps.environment !== this.props.environment ||
      prevProps.start !== this.props.start ||
      prevProps.end !== this.props.end ||
      prevProps.statsPeriod !== this.props.statsPeriod
    );
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
    const {chartData} = this.state;
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

    return (
      <BarChart
        grid={{left: '24px', right: '24px', top: '32px', bottom: '16px'}}
        xAxis={xAxis}
        yAxis={{type: 'value'}}
        series={transformData(chartData.data)}
        colors={['rgba(140, 79, 189, 0.3)']}
      />
    );
  }

  calculateTotal() {
    if (this.state.chartData === null) {
      return '\u2015';
    }
    return this.state.chartData.data.reduce((acc, item) => {
      return acc + item.count;
    }, 0);
  }

  render() {
    return (
      <Panel>
        <PaddedSubHeading>
          <span>{t('Latency Distribution')}</span>
          <Tooltip
            position="top"
            title={t(
              `This graph shows the volume of transactions that completed within each duration bucket.
               X-axis values represent the median value of each bucket.
               `
            )}
          >
            <IconQuestion size="sm" color={theme.gray6} />
          </Tooltip>
        </PaddedSubHeading>
        {super.render()}
        <ChartControls>
          <InlineContainer>
            <SectionHeading key="total-heading">{t('Total Events')}</SectionHeading>
            <SectionValue key="total-value">{this.calculateTotal()}</SectionValue>
          </InlineContainer>
        </ChartControls>
      </Panel>
    );
  }
}

/**
 * Convert a discover response into a barchart compatible series
 */
function transformData(data: ApiResult[]) {
  // We can assume that all buckets are of equal width, use the first two
  // buckets to get the width. The value of each histogram function indicates
  // the beginning of the bucket.
  const bucketWidth =
    data.length > 2
      ? data[1].histogram_transaction_duration_15 -
        data[0].histogram_transaction_duration_15
      : 0;

  const seriesData = data.map(item => {
    const bucket = item.histogram_transaction_duration_15;
    const midPoint = Math.ceil(bucket + bucketWidth / 2);
    return {value: item.count, name: getDuration(midPoint / 1000, 2, true)};
  });

  return [
    {
      seriesName: t('Count'),
      data: seriesData,
    },
  ];
}

const PaddedSubHeading = styled(SubHeading)`
  display: flex;
  align-items: flex-start;
  margin: ${space(2)} 0 ${space(1)} ${space(3)};

  & > span {
    margin-right: ${space(1)};
  }
`;

export default LatencyChart;
