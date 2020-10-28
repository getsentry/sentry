import PropTypes from 'prop-types';
import React from 'react';

import BarChart from 'app/components/barChart';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import withApi from 'app/utils/withApi';

class InternalStatChart extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    since: PropTypes.number.isRequired,
    resolution: PropTypes.string.isRequired,
    stat: PropTypes.string.isRequired,
    label: PropTypes.string,
    height: PropTypes.number,
  };

  static defaultProps = {
    height: 150,
  };

  state = {
    error: false,
    loading: true,
    data: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  shouldComponentUpdate(_nextProps, nextState) {
    return this.state.loading !== nextState.loading;
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.since !== this.props.since ||
      prevProps.stat !== this.props.stat ||
      prevProps.resolution !== this.props.resolution
    ) {
      this.fetchData();
    }
  }

  fetchData() {
    this.setState({loading: true});
    this.props.api.request('/internal/stats/', {
      method: 'GET',
      data: {
        since: this.props.since,
        resolution: this.props.resolution,
        key: this.props.stat,
      },
      success: data =>
        this.setState({
          data,
          loading: false,
          error: false,
        }),
      error: () => this.setState({error: true}),
    });
  }

  getChartPoints() {
    return this.state.data.map(([x, y]) => ({x, y}));
  }

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    return (
      <BarChart
        points={this.getChartPoints()}
        className="standard-barchart"
        label={this.props.label}
        height={this.props.height}
      />
    );
  }
}

export default withApi(InternalStatChart);
