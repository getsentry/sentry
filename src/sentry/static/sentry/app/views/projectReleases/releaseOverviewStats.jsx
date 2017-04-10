import React from 'react';
import moment from 'moment';

import ApiMixin from '../../mixins/apiMixin';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';

const ReleaseOverviewStats = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      stats: null,
      loading: true,
      error: false,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    this.api.request(this.getProjectReleaseStatsEndpoint(), {
      success: (data) => {
        this.setState({
          error: false,
          loading: false,
          stats: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  getProjectReleaseStatsEndpoint() {
    let {orgId, projectId} = this.props;
    return '/projects/' + orgId + '/' + projectId + '/releases/stats/';
  },

  renderBody() {
    let body;

    if (this.state.loading) {
      body = <LoadingIndicator />;
    } else if (this.state.error) {
      body = <LoadingError />;
    } else {
      let stats = this.state.stats;
      body = (
        <div className="row">
          <div className="col-sm-4 hidden-xs">
            <div className="release-stats">
              <h6 className="nav-header">Average Number of Authors</h6>
              <span className="stream-count">
                {Math.round(stats.AvgNumAuthors * 100) / 100}
              </span>
            </div>
          </div>
          <div className="col-sm-4 hidden-xs">
            <div className="release-stats">
              <h6 className="nav-header">Time Between Releases</h6>
              <span className="stream-count">
                {moment.duration(stats.AvgTimeToRelease).humanize()}
              </span>
            </div>
          </div>
          <div className="col-sm-4 hidden-xs">
            <div className="release-stats">
              <h6 className="nav-header">Total Releases</h6>
              <span className="stream-count">{stats.CountReleases}</span>
            </div>
          </div>
        </div>
      );
    }

    return body;
  },

  render() {
    return (
      <div className="release-details">
        {this.renderBody()}
      </div>
    );
  }
});

export default ReleaseOverviewStats;
