/*** @jsx React.DOM */

var React = require("react");
var Router = require("react-router");
var Route = Router.Route;
var DefaultRoute = Router.DefaultRoute;

var App = require("./views/app");
var GroupActivity = require("./views/groupActivity");
var GroupDetails = require("./views/groupDetails");
var GroupEvents = require("./views/groupEvents");
var GroupTags = require("./views/groupTags");
var GroupTagValues = require("./views/groupTagValues");
var GroupOverview = require("./views/groupOverview");
var GroupEventDetails = require("./views/groupEventDetails");
var OrganizationDetails = require("./views/organizationDetails");
var OrganizationStats = require("./views/organizationStats");
var OrganizationTeams = require("./views/organizationTeams");
var OrganizationProjects = require("./views/organizationProjects");
var ProjectDashboard = require("./views/projectDashboard");
var ProjectDetails = require("./views/projectDetails");
var ProjectReleases = require("./views/projectReleases");
var PropTypes = require("./proptypes");
var Stream = require("./views/stream");
var TeamDashboard = require("./views/teamDashboard");
var TeamDetails = require("./views/teamDetails");

var routes = (
  <Route name="app" path="/" handler={App}>
    <Route name="organizationDetails" path="/:orgId/" handler={OrganizationDetails}>
      <DefaultRoute name="organizationTeams" handler={OrganizationTeams} />
      <Route name="teamDetails" path="teams/:teamId/" handler={TeamDetails}>
        <DefaultRoute name="teamDashboard" handler={TeamDashboard} />
      </Route>
      <Route name="projectDetails" path=":projectId/" handler={ProjectDetails}>
        <DefaultRoute name="stream" handler={Stream} />
        <Route name="projectDashboard" path="dashboard/" handler={ProjectDashboard} />
        <Route name="projectReleases" path="releases/" handler={ProjectReleases} />
        <Route name="groupDetails" path="group/:groupId/" handler={GroupDetails}
               ignoreScrollBehavior>
          <DefaultRoute name="groupOverview" handler={GroupOverview} />
          <Route name="groupActivity" path="activity/" handler={GroupActivity} />
          <Route name="groupEventDetails" path="events/:eventId/" handler={GroupEventDetails} />
          <Route name="groupTags" path="tags/" handler={GroupTags} />
          <Route name="groupTagValues" path="tags/:tagKey/" handler={GroupTagValues} />
          <Route name="groupEvents" path="events/" handler={GroupEvents} />
        </Route>
      </Route>
    </Route>
    <Route path="/organizations/:orgId/" handler={OrganizationDetails}>
      <Route name="organizationStats" path="stats/" handler={OrganizationStats} />
      <Route name="organizationProjects" path="projects/" handler={OrganizationProjects} />
    </Route>
  </Route>
);

module.exports = routes;
