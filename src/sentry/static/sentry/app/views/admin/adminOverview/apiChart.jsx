import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';

import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import StackedBarChart from 'app/components/stackedBarChart';
import withApi from 'app/utils/withApi';

const ApiChart = createReactClass({
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
        'client-api.all-versions.responses.2xx': null,
        'client-api.all-versions.responses.4xx': null,
        'client-api.all-versions.responses.5xx': null,
      },
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
    const statNameList = [
      'client-api.all-versions.responses.2xx',
      'client-api.all-versions.responses.4xx',
      'client-api.all-versions.responses.5xx',
    ];

    statNameList.forEach(statName => {
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
    if (
      rawData['client-api.all-versions.responses.2xx'] &&
      rawData['client-api.all-versions.responses.4xx'] &&
      rawData['client-api.all-versions.responses.5xx']
    ) {
      this.setState({
        loading: false,
      });
    }
  },

  processRawSeries(series) {
    return series.map(item => ({x: item[0], y: item[1]}));
  },

  getChartSeries() {
    const {rawData} = this.state;
    return [
      {
        data: this.processRawSeries(rawData['client-api.all-versions.responses.4xx']),
        color: 'rgb(86, 175, 232)',
        shadowSize: 0,
        label: '4xx',
      },
      {
        data: this.processRawSeries(rawData['client-api.all-versions.responses.5xx']),
        color: 'rgb(244, 63, 32)',
        label: '5xx',
      },
      {
        data: this.processRawSeries(rawData['client-api.all-versions.responses.2xx']),
        color: 'rgb(78, 222, 73)',
        label: '2xx',
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

export default withApi(ApiChart);
