import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import ApiMixin from '../../mixins/apiMixin';
import StackedBarChart from '../../components/stackedBarChart';
import DynamicWrapper from '../../components/dynamicWrapper';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import ProjectState from '../../mixins/projectState';

const BurnDown = React.createClass({
  propTypes: {
    dateSince: PropTypes.number.isRequired,
    resolution: PropTypes.string.isRequired,
  },

  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      stats: [],
      releaseList: [],
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  getStatsEndpoint() {
    let org = this.getOrganization();
    let project = this.getProject();
    return '/projects/' + org.slug + '/' + project.slug + '/triage-stats/';
  },

  getProjectReleasesEndpoint() {
    let org = this.getOrganization();
    let project = this.getProject();
    return '/projects/' + org.slug + '/' + project.slug + '/releases/';
  },

  fetchData() {
    this.api.request(this.getStatsEndpoint(), {
      query: {
        since: this.props.dateSince,
        resolution: this.props.resolution,
        stat: 'generated',
      },
      success: data => {
        this.setState({
          stats: data,
          error: false,
          loading: false,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });

    this.api.request(this.getProjectReleasesEndpoint(), {
      success: (data, _, jqXHR) => {
        this.setState({
          releaseList: data,
        });
      },
    });
  },
  processRawSeries(stats, type) {
    return Object.keys(stats).map(key => {
      let data = stats[key];
      let value = data[type] || 0;

      return {x: parseInt(key, 10), y: value * (type === 0 ? -1 : 1)};
    });
  },
  getChartSeries() {
    let {stats} = this.state;
    return [
      {
        data: this.processRawSeries(stats, 0),
        color: '#EC5E44',
        label: 'Unresolved',
      },
      {
        data: this.processRawSeries(stats, 1),
        color: '#6C5FC7',
        label: 'Resolved',
      },
      {
        data: this.processRawSeries(stats, 2),
        color: '#9990AB',
        label: 'Ignored',
      },
      {
        data: this.processRawSeries(stats, 6),
        color: '#57BE8C',
        label: 'Assigned',
      },
    ];
  },
  getReleaseList() {
    let startX = new Date().getTime() / 1000 - 3600 * 24 * 30;
    let markers = this.state.releaseList
      .filter(release => {
        let date = new Date(release.dateCreated).getTime() / 1000;
        return date >= startX;
      })
      .map(release => {
        return {
          label: 'Version ' + release.shortVersion,
          x: new Date(release.dateCreated).getTime() / 1000,
        };
      });
    return markers;
  },
  renderChart() {
    return (
      <div className="chart-wrapper">
        <StackedBarChart
          series={this.getChartSeries()}
          markers={this.getReleaseList()}
          className="dashboard-barchart standard-barchart"
          label="Issues"
          height={150}
        />
        <small className="date-legend">
          <DynamicWrapper
            fixed="Test Date 1, 2000"
            value={moment(this.props.dateSince * 1000).format('LL')}
          />
        </small>
      </div>
    );
  },

  render() {
    return this.state.loading ? (
      <LoadingIndicator />
    ) : this.state.error ? (
      <LoadingError onRetry={this.fetchData} />
    ) : (
      this.renderChart()
    );
  },
});

export default BurnDown;
