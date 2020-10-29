import PropTypes from 'prop-types';
import React from 'react';

import MiniBarChart from 'app/components/charts/miniBarChart';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import theme from 'app/utils/theme';

class EventChart extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    since: PropTypes.number.isRequired,
    resolution: PropTypes.string.isRequired,
  };

  state = this.getInitialState();

  getInitialState() {
    return {
      error: false,
      loading: true,
      rawData: {
        'events.total': null,
        'events.dropped': null,
      },
      stats: {received: [], rejected: []},
    };
  }

  componentWillMount() {
    this.fetchData();
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.since !== nextProps.since) {
      this.setState(this.getInitialState(), this.fetchData);
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
    const sReceived = {};
    const sRejected = {};
    const aReceived = [0, 0]; // received, points

    rawData['events.total'].forEach((point, idx) => {
      const dReceived = point[1];
      const dRejected = rawData['events.dropped'][idx][1];
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
          name: ts * 1000,
          value: sRejected[ts] || 0,
        })),
        accepted: Object.keys(sReceived).map(ts =>
          // total number of events accepted (received - rejected)
          ({name: ts * 1000, value: sReceived[ts] - sRejected[ts]})
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
        color: theme.red300,
      },
    ];
  }

  render() {
    const {loading, error} = this.state;
    if (loading) {
      return <LoadingIndicator />;
    } else if (error) {
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
