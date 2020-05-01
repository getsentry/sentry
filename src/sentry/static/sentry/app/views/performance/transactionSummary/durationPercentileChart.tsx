import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import BarChart from 'app/components/charts/barChart';
import ErrorPanel from 'app/components/charts/components/errorPanel';
import {AREA_COLORS} from 'app/components/charts/utils';
import AsyncComponent from 'app/components/asyncComponent';
import Tooltip from 'app/components/tooltip';
import {OrganizationSummary} from 'app/types';
import LoadingPanel from 'app/views/events/loadingPanel';
import EventView from 'app/utils/discover/eventView';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import theme from 'app/utils/theme';
import {getDuration} from 'app/utils/formatters';

import {HeaderTitle, StyledIconQuestion} from '../styles';

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
  [bucket: string]: number;
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
 * Fetch and render a bar chart that shows event volume
 * for each duration bucket. We always render 15 buckets of
 * equal widths based on the endpoints min + max durations.
 *
 * This graph visualizes how many transactions were recorded
 * at each duration bucket, showing the modality of the transaction.
 */
class DurationPercentileChart extends AsyncComponent<Props, State> {
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
      fields: [
        'percentile(transaction.duration, 0.1)',
        'percentile(transaction.duration, 0.25)',
        'percentile(transaction.duration, 0.50)',
        'percentile(transaction.duration, 0.70)',
        'percentile(transaction.duration, 0.90)',
        'percentile(transaction.duration, 0.95)',
        'percentile(transaction.duration, 0.99)',
        'percentile(transaction.duration, 0.995)',
        'percentile(transaction.duration, 0.999)',
        'p100()',
      ],
      orderby: '',
      projects: project,
      range: statsPeriod,
      query,
      environment,
      start,
      end,
    });
    const apiPayload = eventView.getEventsAPIPayload(location);
    apiPayload.referrer = 'api.performance.durationpercentilechart';

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
    const colors = theme.charts.getColorPalette(1);

    return (
      <BarChart
        grid={{left: '10px', right: '10px', top: '16px', bottom: '0px'}}
        xAxis={xAxis}
        yAxis={{type: 'value'}}
        series={transformData(chartData.data)}
        colors={colors}
      />
    );
  }

  render() {
    return (
      <React.Fragment>
        <HeaderTitle>
          {t('Duration Percentiles')}
          <Tooltip
            position="top"
            title={t(`Visualize a transactions response time at each percentile point.`)}
          >
            <StyledIconQuestion />
          </Tooltip>
        </HeaderTitle>
        {this.renderComponent()}
      </React.Fragment>
    );
  }
}

/**
 * Convert a discover response into a barchart compatible series
 */
function transformData(data: ApiResult[]) {
  console.log(data);
  const seriesData = Object.keys(data[0]).map((key: string) => {
    // TODO extract only the percentile and p100 attributes,
    // then order them so the chart series are in order..
    const match = /^percentile_transaction_duration_(.+)$/.exec(key);
    const name = match
      ? (Number(match[1].replace('_', '.')) * 100).toLocaleString() + '%'
      : '100%';
    return {
      name,
      value: data[key],
    };
  });
  console.log(seriesData);

  return [
    {
      seriesName: t('Duration'),
      data: seriesData,
    },
  ];
}

export default DurationPercentileChart;
