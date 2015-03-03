/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");
var Route = Router.Route;
var DefaultRoute = Router.DefaultRoute;

var GroupDetails = require("./views/groupDetails");
var GroupEvents = require("./views/groupEvents");
var GroupTags = require("./views/groupTags");
var GroupTagValues = require("./views/groupTagValues");
var GroupOverview = require("./views/groupOverview");
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
      <Route name="groupDetails" path="group/:groupId/" handler={GroupDetails}
             ignoreScrollBehavior>
        <DefaultRoute name="groupOverview" handler={GroupOverview} />
        <Route name="groupEventDetails" path="events/:eventId/" handler={GroupOverview} />
        <Route name="groupTags" path="tags/" handler={GroupTags} />
        <Route name="groupTagValues" path="tags/:tagKey/" handler={GroupTagValues} />
        <Route name="groupEvents" path="events/" handler={GroupEvents} />
      </Route>
    </Route>
  </Route>
);

module.exports = routes;
