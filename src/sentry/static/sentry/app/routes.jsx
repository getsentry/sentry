import React from 'react';
import {Redirect, Route, IndexRoute} from 'react-router';

import Admin from './views/admin';
import AdminOrganizations from './views/adminOrganizations';
import AdminOverview from './views/adminOverview';
import App from './views/app';
import GroupActivity from './views/groupActivity';
import GroupDetails from './views/groupDetails';
import GroupEventDetails from './views/groupEventDetails';
import GroupEvents from './views/groupEvents';
import GroupTags from './views/groupTags';
import GroupTagValues from './views/groupTagValues';
import GroupUserReports from './views/groupUserReports';
import OrganizationDetails from './views/organizationDetails';
import OrganizationStats from './views/organizationStats';
import OrganizationTeams from './views/organizationTeams';
import ProjectDashboard from './views/projectDashboard';
import ProjectDetails from './views/projectDetails';
import ProjectInstall from './views/projectInstall';
import ProjectInstallOverview from './views/projectInstall/overview';
import ProjectInstallPlatform from './views/projectInstall/platform';
import ProjectReleases from './views/projectReleases';
import ProjectSettings from './views/projectSettings';
import ReleaseAllEvents from './views/releaseAllEvents';
import ReleaseArtifacts from './views/releaseArtifacts';
import ReleaseDetails from './views/releaseDetails';
import ReleaseNewEvents from './views/releaseNewEvents';
import RouteNotFound from './views/routeNotFound';
import SharedGroupDetails from './views/sharedGroupDetails';
import Stream from './views/stream';

function appendTrailingSlash(nextState, replaceState) {
  let lastChar = nextState.location.pathname.slice(-1);
  if (lastChar !== '/') {
    replaceState(nextState, nextState.location.pathname + '/');
  }
}

let routes = (
  <Route path="/" component={App}>
    <Route path="/organizations/:orgId/" component={OrganizationDetails}>
      <Route path="stats/" component={OrganizationStats} />
    </Route>

    <Route path="/manage/" component={Admin}>
      <Route path="organizations/" component={AdminOrganizations} />
      <IndexRoute component={AdminOverview} />
    </Route>

    <Redirect from="/share/group/:shareId/" to="/share/issue/:shareId/" />
    <Route path="/share/issue/:shareId/" component={SharedGroupDetails} />

    <Route path="/:orgId/" component={OrganizationDetails}>
      <IndexRoute component={OrganizationTeams} />
      <Route path=":projectId/" component={ProjectDetails}>
        <IndexRoute component={Stream} />
        <Route path="dashboard/" component={ProjectDashboard} />
        <Route path="releases/" component={ProjectReleases} />
        <Route name="releaseDetails" path="releases/:version/" component={ReleaseDetails}>
          <IndexRoute component={ReleaseNewEvents} />
          <Route path="all-events/" component={ReleaseAllEvents} />
          <Route path="artifacts/" component={ReleaseArtifacts} />
        </Route>
        <Route path="settings/" component={ProjectSettings}>
          <Route path="install/" component={ProjectInstall}>
            <IndexRoute component={ProjectInstallOverview}/>
            <Route path=":platform/" component={ProjectInstallPlatform}/>
          </Route>
        </Route>
        <Redirect from="group/:groupId/" to="issues/:groupId/" />
        <Route path="issues/:groupId/" component={GroupDetails}
               ignoreScrollBehavior>
          <IndexRoute component={GroupEventDetails} />

          <Route path="activity/" component={GroupActivity} />
          <Route path="events/:eventId/" component={GroupEventDetails} />
          <Route path="events/" component={GroupEvents} />
          <Route path="tags/" component={GroupTags} />
          <Route path="tags/:tagKey/" component={GroupTagValues} />
          <Route path="reports/" component={GroupUserReports} />
        </Route>
      </Route>
    </Route>

    <Route path="*" component={RouteNotFound} onEnter={appendTrailingSlash}/>
  </Route>
);

export default routes;
