/*** @jsx React.DOM */

var React = require("react");

var api = require("../../api");
var BarChart = require("../../components/barChart");
var LoadingError = require("../../components/loadingError");
var LoadingIndicator = require("../../components/loadingIndicator");
var TeamState = require("../../mixins/teamState");

var TeamChart = React.createClass({
  mixins: [TeamState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      stats: []
    };
  },

  getStatsEndpoint() {
    var org = this.getOrganization();
    var team = this.getTeam();
    return "/teams/" + org.slug + "/" + team.slug + "/stats/";
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    api.request(this.getStatsEndpoint(), {
      query: {
        since: (new Date().getTime() / 1000) - (3600 * 24 * 7)
      },
      success: (data) => {
        this.setState({
          stats: data,
          loading: false,
          error: false
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  render() {
    var points = this.state.stats.map((point) => {
      return {x: point[0], y: point[1]};
    });

    return (
      <div className="bar-chart team-chart">
        <h6>Last 7 days</h6>

        {this.state.loading ?
          <LoadingIndicator />
        : (this.state.error ?
          <LoadingError onRetry={this.fetchData} />
        :
          <BarChart points={points} className="sparkline" />
        )}
      </div>
    );
  }
});

module.exports = TeamChart;
