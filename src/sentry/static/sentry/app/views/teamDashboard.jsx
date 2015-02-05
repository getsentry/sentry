/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");

var TeamState = require("../mixins/teamState");

var TeamDashboard = React.createClass({
  mixins: [
    Router.State,
    TeamState
  ],

  render() {
    var team = this.getTeam();
    return (
      <div>{team.name}</div>
    );
  }
});

module.exports = TeamDashboard;
