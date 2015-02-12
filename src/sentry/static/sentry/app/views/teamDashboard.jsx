/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var EventList = require("./teamDashboard/eventList");
var TeamChart = require("./teamDashboard/chart");
var TeamState = require("../mixins/teamState");

var TeamDashboard = React.createClass({
  mixins: [
    Router.State,
    TeamState
  ],

  getTrendingEventsEndpoint() {
    var params = this.getParams();
    return "/teams/" + params.orgId + "/" + params.teamId + "/groups/trending/";
  },

  getNewEventsEndpoint() {
    var params = this.getParams();
    return "/teams/" + params.orgId + "/" + params.teamId + "/groups/new/";
  },

  render() {
    return (
      <div>
        <div className="row team-stats">
          <div className="col-md-3 stat-column">
            <span className="count">323</span>
            <span className="count-label">events seen</span>
          </div>
          <div className="col-md-3 stat-column">
            <span className="count">137</span>
            <span className="count-label">new events</span>
          </div>
          <div className="col-md-3 stat-column">
            <span className="count">16</span>
            <span className="count-label">releases</span>
          </div>
          <div className="col-md-3 stat-column align-right bad">
            <span className="count">20%</span>
            <span className="count-label">more than last week</span>
          </div>
        </div>
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
