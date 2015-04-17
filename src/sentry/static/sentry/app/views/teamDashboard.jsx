/*** @jsx React.DOM */

var React = require("react");

var EventList = require("./teamDashboard/eventList");
var TeamChart = require("./teamDashboard/chart");
var TeamState = require("../mixins/teamState");
var TeamStatsBar = require("./teamDashboard/statsBar");

var TeamDashboard = React.createClass({
  mixins: [
    TeamState
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

  getTrendingEventsEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    return "/teams/" + params.orgId + "/" + params.teamId + "/groups/trending/";
  },

  getNewEventsEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    return "/teams/" + params.orgId + "/" + params.teamId + "/groups/new/";
  },

  render() {
    return (
      <div>
        <TeamStatsBar />
        <TeamChart />
        <div className="row">
          <div className="col-md-6">
            <EventList
                title="Trending Events"
                endpoint={this.getTrendingEventsEndpoint()} />
          </div>
          <div className="col-md-6">
            <EventList
                title="New Events"
                endpoint={this.getNewEventsEndpoint()} />
          </div>
        </div>
      </div>
    );
  }
});

module.exports = TeamDashboard;
