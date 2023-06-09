import {Component} from 'react';

import {Client} from 'sentry/api';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {TimeseriesValue} from 'sentry/types';
import {SeriesDataUnit} from 'sentry/types/echarts';
import theme from 'sentry/utils/theme';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  resolution: string;
  since: number;
};

type State = {
  error: boolean;
  loading: boolean;
  rawData: Record<string, TimeseriesValue[]>;
  stats: Record<string, SeriesDataUnit[]>;
};

const initialState: State = {
  error: false,
  loading: true,
  rawData: {
    'events.total': [],
    'events.dropped': [],
  },
  stats: {received: [], rejected: []},
};

class EventChart extends Component<Props, State> {
  state: State = initialState;

  UNSAFE_componentWillMount() {
    this.fetchData();
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (this.props.since !== nextProps.since) {
      this.setState(initialState, this.fetchData);
    }
  }

  fetchData = () => {
    const statNameList = ['events.total', 'events.dropped'];

    statNameList.forEach(statName => {
      // query the organization stats via a separate call as its possible the project stats
      // are too heavy
      this.props.api.request('/internal/stats/', {
        method: 'GET',
        data: {
          since: this.props.since,
          resolution: this.props.resolution,
          key: statName,
        },
        success: data => {
          this.setState(prevState => {
            const rawData = prevState.rawData;
            rawData[statName] = data;
            return {
              rawData,
            };
          }, this.requestFinished);
        },
        error: () => {
          this.setState({
            error: true,
          });
        },
      });
    });
  };

  requestFinished() {
    const {rawData} = this.state;
    if (rawData['events.total'] && rawData['events.dropped']) {
      this.processOrgData();
    }
  }

  processOrgData() {
    const {rawData} = this.state;
    const sReceived: Record<string, number> = {};
    const sRejected: Record<string, number> = {};
    const aReceived = [0, 0]; // received, points

    rawData['events.total'].forEach((point, idx) => {
      const dReceived = point[1];
      const dRejected = rawData['events.dropped'][idx]?.[1];
      const ts = point[0];
      if (sReceived[ts] === undefined) {
        sReceived[ts] = dReceived;
        sRejected[ts] = dRejected;
      } else {
        sReceived[ts] += dReceived;
        sRejected[ts] += dRejected;
      }
      if (dReceived > 0) {
        aReceived[0] += dReceived;
        aReceived[1] += 1;
      }
    });

    this.setState({
      stats: {
        rejected: Object.keys(sRejected).map(ts => ({
          name: parseInt(ts, 10) * 1000,
          value: sRejected[ts] || 0,
        })),
        accepted: Object.keys(sReceived).map(ts =>
          // total number of events accepted (received - rejected)
          ({name: parseInt(ts, 10) * 1000, value: sReceived[ts] - sRejected[ts]})
        ),
      },
      loading: false,
    });
  }

  getChartSeries() {
    const {stats} = this.state;

    return [
      {
        seriesName: t('Accepted'),
        data: stats.accepted,
        color: theme.blue300,
      },
      {
        seriesName: t('Dropped'),
        data: stats.rejected,
        color: theme.red200,
      },
    ];
  }

  render() {
    const {loading, error} = this.state;
    if (loading) {
      return <LoadingIndicator />;
    }
    if (error) {
      return <LoadingError onRetry={this.fetchData} />;
    }
    const series = this.getChartSeries();
    const colors = series.map(({color}) => color);
    return (
      <MiniBarChart
        series={series}
        colors={colors}
        height={110}
        stacked
        isGroupedByDate
        showTimeInTooltip
        labelYAxisExtents
      />
    );
  }
}

export default withApi(EventChart);
