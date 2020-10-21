import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';

import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import StackedBarChart from 'app/components/stackedBarChart';
import withApi from 'app/utils/withApi';

const EventChart = createReactClass({
  displayName: 'eventChart',

  propTypes: {
    api: PropTypes.object.isRequired,
    since: PropTypes.number.isRequired,
    resolution: PropTypes.string.isRequired,
  },

  getInitialState() {
    return {
      error: false,
      loading: true,
      rawData: {
        'events.total': null,
        'events.dropped': null,
      },
      stats: {received: [], rejected: []},
      systemTotal: {received: 0, rejected: 0, accepted: 0},
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (this.props.since !== nextProps.since) {
      this.setState(this.getInitialState(), this.fetchData);
    }
  },

  fetchData() {
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
  },

  requestFinished() {
    const {rawData} = this.state;
    if (rawData['events.total'] && rawData['events.dropped']) {
      this.processOrgData();
    }
  },

  processOrgData() {
    const {rawData} = this.state;
    let oReceived = 0;
    let oRejected = 0;
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
      oReceived += dReceived;
      oRejected += dRejected;
      if (dReceived > 0) {
        aReceived[0] += dReceived;
        aReceived[1] += 1;
      }
    });
    this.setState({
      systemTotal: {
        received: oReceived,
        rejected: oRejected,
        accepted: oReceived - oRejected,
        avgRate: parseInt(aReceived[0] / aReceived[1] / 60, 10),
      },
      stats: {
        rejected: Object.keys(sRejected).map(ts => ({x: ts, y: sRejected[ts] || null})),
        accepted: Object.keys(sReceived).map(ts =>
          // total number of events accepted (received - rejected)
          ({x: ts, y: sReceived[ts] - sRejected[ts]})
        ),
      },
      loading: false,
    });
  },

  getChartSeries() {
    const {stats} = this.state;

    return [
      {
        data: stats.accepted,
        label: 'Accepted',
        color: 'rgba(86, 175, 232, 1)',
      },
      {
        data: stats.rejected,
        color: 'rgba(244, 63, 32, 1)',
        label: 'Dropped',
      },
    ];
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }
    return (
      <StackedBarChart
        series={this.getChartSeries()}
        height={150}
        className="standard-barchart"
      />
    );
  },
});

export default withApi(EventChart);
