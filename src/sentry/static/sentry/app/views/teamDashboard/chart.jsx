/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var api = require("../../api");
var BarChart = require("../../components/barChart");
var LoadingError = require("../../components/loadingError");
var LoadingIndicator = require("../../components/loadingIndicator");

var TeamChart = React.createClass({
  mixins: [Router.State],

  getInitialState() {
    return {
      loading: true,
      error: false,
      stats: []
    };
  },

  getStatsEndpoint() {
    var params = this.getParams();
    return "/teams/" + params.orgId + "/" + params.teamId + "/stats/";
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
      <div className="box">
        <div className="box-header">
          <h3>Last 7 days</h3>
        </div>
        <div className="box-content with-padding">
          {this.state.loading ?
            <LoadingIndicator />
          : (this.state.error ?
            <LoadingError onRetry={this.fetchData} />
          :
            <BarChart points={points} className="sparkline" />
          )}
        </div>
      </div>
    );
  }
});

module.exports = TeamChart;
