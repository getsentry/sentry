/*eslint getsentry/jsx-needs-il8n:0*/
import React from 'react';
import _ from 'lodash';

import ApiMixin from '../mixins/apiMixin';
import BarChart from '../components/barChart';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';

export default React.createClass({
  propTypes: {
    since: React.PropTypes.number.isRequired,
    resolution: React.PropTypes.string.isRequired,
    stat: React.PropTypes.string.isRequired,
    label: React.PropTypes.string,
    height: React.PropTypes.number
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      height: 150
    };
  },

  getInitialState() {
    return {
      error: false,
      loading: true,
      data: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(nextProps, this.props)) {
      this.setState(
        {
          loading: true
        },
        this.fetchData
      );
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.state.loading !== nextState.loading;
  },

  fetchData() {
    this.api.request('/internal/stats/', {
      method: 'GET',
      data: {
        since: this.props.since,
        resolution: this.props.resolution,
        key: this.props.stat
      },
      success: data => {
        this.setState({
          data: data,
          loading: false,
          error: false
        });
      },
      error: data => {
        this.setState({
          error: true
        });
      }
    });
  },

  getChartPoints() {
    return this.state.data.map(([x, y]) => {
      return {x, y};
    });
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    return (
      <BarChart
        points={this.getChartPoints()}
        className="standard-barchart"
        label={this.props.label}
        height={this.props.height}
      />
    );
  }
});
