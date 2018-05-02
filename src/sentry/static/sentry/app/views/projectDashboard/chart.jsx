import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import moment from 'moment';
import SentryTypes from 'app/proptypes';
import ApiMixin from 'app/mixins/apiMixin';
import BarChart from 'app/components/barChart';
import DynamicWrapper from 'app/components/dynamicWrapper';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import ProjectState from 'app/mixins/projectState';

const ProjectChart = createReactClass({
  displayName: 'ProjectChart',

  propTypes: {
    dateSince: PropTypes.number.isRequired,
    resolution: PropTypes.string.isRequired,
    environment: SentryTypes.Environment,
  },

  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      stats: [],
      releaseList: [],
      environment: this.props.environment,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.environment !== this.props.environment ||
      nextProps.resolution !== this.props.resolution ||
      nextProps.dateSince !== this.props.dateSince
    ) {
      this.setState(
        {
          environment: nextProps.environment,
          loading: true,
          error: false,
        },
        this.fetchData
      );
    }
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
    const statsQuery = {
      since: this.props.dateSince,
      resolution: this.props.resolution,
      stat: 'generated',
    };

    const releasesQuery = {};

    if (this.state.environment) {
      statsQuery.environment = this.state.environment.name;
      releasesQuery.environment = this.state.environment.name;
    }
    this.api.request(this.getStatsEndpoint(), {
      query: statsQuery,
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
      query: releasesQuery,
      success: (data, _, jqXHR) => {
        this.setState({
          releaseList: data,
        });
      },
    });
  },

  renderChart() {
    let points = this.state.stats.map(point => {
      return {x: point[0], y: point[1]};
    });
    let startX = this.props.dateSince;
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

    return (
      <div className="chart-wrapper">
        <BarChart
          points={points}
          markers={markers}
          label="events"
          height={150}
          className="standard-barchart"
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

export default ProjectChart;
