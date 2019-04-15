import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import createReactClass from 'create-react-class';
import moment from 'moment';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import BarChart from 'app/components/barChart';
import DynamicWrapper from 'app/components/dynamicWrapper';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import ProjectState from 'app/mixins/projectState';

const ProjectChart = createReactClass({
  displayName: 'ProjectChart',

  propTypes: {
    api: PropTypes.object,
    dateSince: PropTypes.number.isRequired,
    resolution: PropTypes.string.isRequired,
    environment: SentryTypes.Environment,
  },

  mixins: [ProjectState],

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
    const org = this.getOrganization();
    const project = this.getProject();
    return '/projects/' + org.slug + '/' + project.slug + '/stats/';
  },

  getProjectReleasesEndpoint() {
    const org = this.getOrganization();
    const project = this.getProject();
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
    this.props.api.request(this.getStatsEndpoint(), {
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

    this.props.api.request(this.getProjectReleasesEndpoint(), {
      query: releasesQuery,
      success: (data, _, jqXHR) => {
        this.setState({
          releaseList: data,
        });
      },
    });
  },

  renderChart() {
    const points = this.state.stats.map(point => {
      return {x: point[0], y: point[1]};
    });
    const startX = this.props.dateSince;
    const markers = this.state.releaseList
      .filter(release => {
        const date = new Date(release.dateCreated).getTime() / 1000;
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
        <StyledBarChart
          points={points}
          markers={markers}
          label="events"
          height={150}
          gap={0.2}
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

const StyledBarChart = styled(BarChart)`
  background: #fff;
`;

export {ProjectChart};

export default withApi(ProjectChart);
