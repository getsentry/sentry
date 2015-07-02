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
var ProjectDashboard = require("./views/projectDashboard");
var ProjectDetails = require("./views/projectDetails");
var ProjectReleases = require("./views/projectReleases");
var PropTypes = require("./proptypes");
var ReleaseDetails = require("./views/releaseDetails");
var ReleaseNewEvents = require("./views/releaseNewEvents");
var SharedGroupDetails = require("./views/sharedGroupDetails");
var Stream = require("./views/stream");
var TeamDetails = require("./views/teamDetails");

var routes = (
  <Route name="app" path="/" handler={App}>
    <Route path="/organizations/:orgId/" handler={OrganizationDetails}>
      <Route name="organizationStats" path="stats/" handler={OrganizationStats} />
    </Route>
    <Route name="sharedGroupDetails" path="/share/group/:shareId/" handler={SharedGroupDetails} />
    <Route name="organizationDetails" path="/:orgId/" handler={OrganizationDetails}>
      <DefaultRoute name="organizationTeams" handler={OrganizationTeams} />
      <Route name="projectDetails" path=":projectId/" handler={ProjectDetails}>
        <DefaultRoute name="stream" handler={Stream} />
        <Route name="projectDashboard" path="dashboard/" handler={ProjectDashboard} />
        <Route name="projectReleases" path="releases/" handler={ProjectReleases} />
        <Route name="releaseDetails" path="releases/:version/" handler={ReleaseDetails}>
          <DefaultRoute name="releaseNewEvents" handler={ReleaseNewEvents} />
        </Route>
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
  </Route>
);

module.exports = routes;
