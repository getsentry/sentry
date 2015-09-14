import React from "react";
import moment from "moment";
import api from "../../api";
import BarChart from "../../components/barChart";
import LoadingError from "../../components/loadingError";
import LoadingIndicator from "../../components/loadingIndicator";
import RouteMixin from "../../mixins/routeMixin";
import ProjectState from "../../mixins/projectState";

var ProjectChart = React.createClass({
  mixins: [
    RouteMixin,
    ProjectState,
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

  getInitialState() {
    return {
      error: false,
      stats: [],
      releaseList: [],
      dateSince: (new Date().getTime() / 1000) - (3600 * 24 * 7)
    };
  },

  getStatsEndpoint() {
    var org = this.getOrganization();
    var project = this.getProject();
    return "/projects/" + org.slug + "/" + project.slug + "/stats/?resolution=1h";
  },

  getProjectReleasesEndpoint() {
    var org = this.getOrganization();
    var project = this.getProject();
    return '/projects/' + org.slug + '/' + project.slug + '/releases/';
  },

  componentWillMount() {
    this.fetchData();
  },

  routeDidChange(nextPath, nextParams) {
    var router = this.context.router;
    var params = router.getCurrentParams();
    if (params.orgId != nextParams.orgId || nextParams.projectId != params.projectId) {
      this.fetchData();
    }
  },

  fetchData() {
    this.setState({
      error: false
    });

    api.request(this.getStatsEndpoint(), {
      query: {
        since: this.state.dateSince
      },
      success: (data) => {
        this.setState({
          stats: data,
          error: false
        });
      },
      error: () => {
        this.setState({
          error: true
        });
      }
    });

    api.request(this.getProjectReleasesEndpoint(), {
      success: (data, _, jqXHR) => {
        this.setState({
          releaseList: data,
        });
      }
    });
  },

  renderChart() {
    var points = this.state.stats.map((point) => {
      return {x: point[0], y: point[1]};
    });
    var startX = (new Date().getTime() / 1000) - 3600 * 24 * 7;
    var markers = this.state.releaseList.filter((release) => {
      var date = new Date(release.dateCreated).getTime() / 1000;
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
        <small className="date-legend">{moment(this.state.dateSince * 1000).format("LL")}</small>
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
