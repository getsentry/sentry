import React from 'react';
import {Redirect, Route, IndexRoute} from 'react-router';

import Admin from './views/admin';
import AdminBuffer from './views/adminBuffer';
import AdminOrganizations from './views/adminOrganizations';
import AdminOverview from './views/adminOverview';
import AdminSettings from './views/adminSettings';
import App from './views/app';
import GroupActivity from './views/groupActivity';
import GroupDetails from './views/groupDetails';
import GroupEventDetails from './views/groupEventDetails';
import GroupEvents from './views/groupEvents';
import GroupHashes from './views/groupHashes';
import GroupTags from './views/groupTags';
import GroupTagValues from './views/groupTagValues';
import GroupUserReports from './views/groupUserReports';
import MyIssuesAssignedToMe from './views/myIssues/assignedToMe';
import MyIssuesBookmarked from './views/myIssues/bookmarked';
import MyIssuesViewed from './views/myIssues/viewed';
import OrganizationAuditLog from './views/organizationAuditLog';
import OrganizationDashboard from './views/organizationDashboard';
import OrganizationDetails from './views/organizationDetails';
import OrganizationRateLimits from './views/organizationRateLimits';
import OrganizationStats from './views/organizationStats';
import OrganizationTeams from './views/organizationTeams';
import AllTeamsList from './views/organizationTeams/allTeamsList';
import ProjectChooser from './views/projectChooser';
import ProjectCspSettings from './views/projectCspSettings';
import ProjectDashboard from './views/projectDashboard';
import ProjectDetails from './views/projectDetails';
import ProjectEvents from './views/projectEvents';
import ProjectInstall from './views/projectInstall';
import ProjectInstallOverview from './views/projectInstall/overview';
import ProjectInstallPlatform from './views/projectInstall/platform';
import ProjectReleases from './views/projectReleases';
import ProjectSavedSearches from './views/projectSavedSearches';
import ProjectDebugSymbols from './views/projectDebugSymbols';
import ProjectSettings from './views/projectSettings';
import ProjectUserReports from './views/projectUserReports';
import ProjectUserReportSettings from './views/projectUserReportSettings';
import ReleaseAllEvents from './views/releaseAllEvents';
import ReleaseArtifacts from './views/releaseArtifacts';
import ReleaseDetails from './views/releaseDetails';
import ReleaseNewEvents from './views/releaseNewEvents';
import RouteNotFound from './views/routeNotFound';
import SharedGroupDetails from './views/sharedGroupDetails';
import Stream from './views/stream';
import TeamDetails from './views/teamDetails';
import TeamMembers from './views/teamMembers';
import TeamSettings from './views/teamSettings';

import SetCallsignsAction from './views/requiredAdminActions/setCallsigns';

import errorHandler from './utils/errorHandler';

function appendTrailingSlash(nextState, replaceState) {
  let lastChar = nextState.location.pathname.slice(-1);
  if (lastChar !== '/') {
    replaceState(nextState, nextState.location.pathname + '/');
  }
}

let routes = (
  <Route path="/" component={errorHandler(App)}>
    <Route path="/manage/" component={errorHandler(Admin)}>
      <IndexRoute component={errorHandler(AdminOverview)} />
      <Route path="buffer/" component={errorHandler(AdminBuffer)} />
      <Route path="organizations/" component={errorHandler(AdminOrganizations)} />
      <Route path="settings/" component={errorHandler(AdminSettings)} />
    </Route>

    <Redirect from="/share/group/:shareId/" to="/share/issue/:shareId/" />
    <Route path="/share/issue/:shareId/" component={errorHandler(SharedGroupDetails)} />

    <Route path="/:orgId/" component={errorHandler(OrganizationDetails)}>
      <IndexRoute component={errorHandler(OrganizationDashboard)}/>

      <Route path="/organizations/:orgId/audit-log/" component={errorHandler(OrganizationAuditLog)} />
      <Route path="/organizations/:orgId/teams/" component={errorHandler(OrganizationTeams)} />
      <Route path="/organizations/:orgId/all-teams/" component={errorHandler(OrganizationTeams)}>
        <IndexRoute component={errorHandler(AllTeamsList)}/>
      </Route>
      <Route path="/organizations/:orgId/issues/assigned/" component={errorHandler(MyIssuesAssignedToMe)} />
      <Route path="/organizations/:orgId/issues/bookmarks/" component={errorHandler(MyIssuesBookmarked)} />
      <Route path="/organizations/:orgId/issues/history/" component={errorHandler(MyIssuesViewed)} />
      <Route path="/organizations/:orgId/projects/choose/" component={errorHandler(ProjectChooser)} />
      <Route path="/organizations/:orgId/rate-limits/" component={errorHandler(OrganizationRateLimits)} />
      <Route path="/organizations/:orgId/stats/" component={errorHandler(OrganizationStats)} />
      <Route path="/organizations/:orgId/teams/:teamId/" component={errorHandler(TeamDetails)}>
        <Route path="settings/" component={errorHandler(TeamSettings)} />
        <Route path="members/" component={errorHandler(TeamMembers)} />
      </Route>
      <Route path="/organizations/:orgId/actions/set-callsigns/" component={errorHandler(SetCallsignsAction)} />

      <Route path=":projectId/" component={errorHandler(ProjectDetails)}>
        <IndexRoute component={errorHandler(Stream)} />
        <Route path="searches/:searchId/" component={errorHandler(Stream)} />
        <Route path="dashboard/" component={errorHandler(ProjectDashboard)} />
        <Route path="events/" component={errorHandler(ProjectEvents)} />
        <Route path="releases/" component={errorHandler(ProjectReleases)} />
        <Route name="releaseDetails" path="releases/:version/" component={errorHandler(ReleaseDetails)}>
          <IndexRoute component={errorHandler(ReleaseNewEvents)} />
          <Route path="all-events/" component={errorHandler(ReleaseAllEvents)} />
          <Route path="artifacts/" component={errorHandler(ReleaseArtifacts)} />
        </Route>
        <Route path="user-feedback/" component={errorHandler(ProjectUserReports)} />
        <Route path="settings/" component={errorHandler(ProjectSettings)}>
          <Route path="install/" component={errorHandler(ProjectInstall)}>
            <IndexRoute component={errorHandler(ProjectInstallOverview)}/>
            <Route path=":platform/" component={errorHandler(ProjectInstallPlatform)}/>
          </Route>
          <Route path="saved-searches/" component={errorHandler(ProjectSavedSearches)} />
          <Route path="debug-symbols/" component={errorHandler(ProjectDebugSymbols)} />
          <Route path="user-feedback/" component={errorHandler(ProjectUserReportSettings)} />
          <Route path="csp/" component={errorHandler(ProjectCspSettings)} />
        </Route>
        <Redirect from="group/:groupId/" to="issues/:groupId/" />
        <Route path="issues/:groupId/" component={errorHandler(GroupDetails)}
               ignoreScrollBehavior>
          <IndexRoute component={errorHandler(GroupEventDetails)} />

          <Route path="activity/" component={errorHandler(GroupActivity)} />
          <Route path="events/:eventId/" component={errorHandler(GroupEventDetails)} />
          <Route path="events/" component={errorHandler(GroupEvents)} />
          <Route path="hashes/" component={errorHandler(GroupHashes)} />
          <Route path="tags/" component={errorHandler(GroupTags)} />
          <Route path="tags/:tagKey/" component={errorHandler(GroupTagValues)} />
          <Route path="feedback/" component={errorHandler(GroupUserReports)} />
        </Route>
      </Route>
    </Route>

    <Route path="*" component={errorHandler(RouteNotFound)} onEnter={appendTrailingSlash}/>
  </Route>
);

export default routes;
