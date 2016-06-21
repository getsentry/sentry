import React from 'react';
import moment from 'moment';
import ApiMixin from '../../mixins/apiMixin';
import BarChart from '../../components/barChart';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import ProjectState from '../../mixins/projectState';

const ProjectChart = React.createClass({
  propTypes: {
    dateSince: React.PropTypes.number.isRequired,
    resolution: React.PropTypes.string.isRequired
  },

  mixins: [
    ApiMixin,
    ProjectState
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      stats: [],
      releaseList: []
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps() {
    this.setState({
      loading: true,
      error: false
    }, this.fetchData);
  },

  getStatsEndpoint() {
    let org = this.getOrganization();
    let project = this.getProject();
    return '/projects/' + org.slug + '/' + project.slug + '/stats/';
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
      success: (data) => {
        this.setState({
          stats: data,
          error: false,
          loading: false
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });

    this.api.request(this.getProjectReleasesEndpoint(), {
      success: (data, _, jqXHR) => {
        this.setState({
          releaseList: data,
        });
      }
    });
  },

  renderChart() {
    let points = this.state.stats.map((point) => {
      return {x: point[0], y: point[1]};
    });
    let startX = (new Date().getTime() / 1000) - 3600 * 24 * 7;
    let markers = this.state.releaseList.filter((release) => {
      let date = new Date(release.dateCreated).getTime() / 1000;
      return date >= startX;
    }).map((release) => {
      return {
        label: 'Version ' + release.shortVersion,
        x: new Date(release.dateCreated).getTime() / 1000
      };
    });

    return (
      <div className="chart-wrapper">
        <BarChart
          points={points}
          markers={markers}
          className="sparkline" />
        <small className="date-legend">{moment(this.props.dateSince * 1000).format('LL')}</small>
      </div>
    );
  },

  render() {
    return (
      <div className="box project-chart">
        <div className="box-content with-padding">
          <div className="bar-chart">
            {this.state.loading ?
              <LoadingIndicator />
            : (this.state.error ?
              <LoadingError onRetry={this.fetchData} />
            :
              this.renderChart()
            )}
          </div>
        </div>
      </div>
    );
  }
});

export default ProjectChart;
