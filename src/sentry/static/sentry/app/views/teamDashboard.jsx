/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var TeamState = require("../mixins/teamState");

var EventList = require("./teamDashboard/eventList");

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
        <div className="box">
          <div className="box-header">
            <h3>Last 7 days</h3>
          </div>
          <div className="box-content with-padding">
          </div>
        </div>
        <div className="row">
          <div className="col-md-6">
            <EventList
                title="Trends"
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
