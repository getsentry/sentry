/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");
var Route = Router.Route;
var DefaultRoute = Router.DefaultRoute;

var Aggregate = require("./views/aggregate");
var AggregateEvents = require("./views/aggregateEvents");
var AggregateTags = require("./views/aggregateTags");
var AggregateOverview = require("./views/aggregateOverview");
var ProjectDetails = require("./views/projectDetails");
var PropTypes = require("./proptypes");
var Stream = require("./views/stream");
var TeamDashboard = require("./views/teamDashboard");
var TeamDetails = require("./views/teamDetails");

var App = React.createClass({
  propTypes: {
    isAuthenticated: React.PropTypes.bool.isRequired,
    user: PropTypes.User
  },

  render: function () {
    return (
      <Router.RouteHandler />
    );
  }
});

var routes = (
  <Route name="app" path="/" handler={App}>
    <Route name="teamDetails" path="/:orgId/teams/:teamId/" handler={TeamDetails}>
      <DefaultRoute name="teamDashboard" handler={TeamDashboard} />
    </Route>
    <Route name="projectDetails" path="/:orgId/:projectId/" handler={ProjectDetails}>
      <DefaultRoute name="stream" handler={Stream} />
      <Route name="aggregateDetails" path="group/:aggregateId/" handler={Aggregate}>
        <DefaultRoute name="aggregateOverview" handler={AggregateOverview} />
        <Route name="aggregateTags" path="tags/" handler={AggregateTags} />
        <Route name="aggregateEvents" path="events/" handler={AggregateEvents} />
      </Route>
    </Route>
  </Route>
);

module.exports = routes;
