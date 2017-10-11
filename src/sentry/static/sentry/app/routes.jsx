import React from 'react';
import {Redirect, Route, IndexRoute, IndexRedirect} from 'react-router';

import HookStore from './stores/hookStore';

import AccountAuthorizations from './views/accountAuthorizations';

import AccountLayout from './views/accountLayout';
import ApiApplications from './views/apiApplications';
import ApiApplicationDetails from './views/apiApplicationDetails';
import ApiLayout from './views/apiLayout';
import ApiNewToken from './views/apiNewToken';
import ApiTokens from './views/apiTokens';
import AdminBuffer from './views/adminBuffer';
import AdminLayout from './views/adminLayout';
import AdminOrganizations from './views/adminOrganizations';
import AdminOverview from './views/adminOverview';
import AdminProjects from './views/adminProjects';
import AdminQueue from './views/adminQueue';
import AdminSettings from './views/adminSettings';
import AdminUsers from './views/adminUsers';
import App from './views/app';
import GroupActivity from './views/groupActivity';
import GroupDetails from './views/groupDetails';
import GroupEventDetails from './views/groupEventDetails';
import GroupEvents from './views/groupEvents';
import GroupTags from './views/groupTags';
import GroupTagValues from './views/groupTagValues';
import GroupUserReports from './views/groupUserReports';
import GroupSimilarView from './views/groupSimilar/groupSimilarView';
import GroupMergedView from './views/groupMerged/groupMergedView';
import MyIssuesAssignedToMe from './views/myIssues/assignedToMe';
import MyIssuesBookmarked from './views/myIssues/bookmarked';
import MyIssuesViewed from './views/myIssues/viewed';
import OrganizationAuditLog from './views/organizationAuditLog';
import OrganizationApiKeysView
  from './views/settings/organization/apiKeys/organizationApiKeysView';
import OrganizationApiKeyDetailsView
  from './views/settings/organization/apiKeys/organizationApiKeyDetailsView';
import OrganizationCreate from './views/organizationCreate';
import OrganizationDashboard from './views/organizationDashboard';
import OrganizationDetails from './views/organizationDetails';
import OrganizationContext from './views/organizationContext';
import OrganizationIntegrations from './views/organizationIntegrations';
import OrganizationAuthView
  from './views/settings/organization/auth/organizationAuthView';
import OrganizationRateLimits from './views/organizationRateLimits';
import OrganizationRepositories from './views/organizationRepositories';
import OrganizationSettings from './views/organizationSettings';
import OrganizationStats from './views/organizationStats';
import OrganizationTeams from './views/organizationTeams';
import OnboardingWizard from './views/onboarding/index';
import CreateProject from './views/onboarding/createProject';

import OnboardingConfigure from './views/onboarding/configure/index';

import AllTeamsList from './views/organizationTeams/allTeamsList';
import ProjectAlertSettings from './views/projectAlertSettings';
import ProjectAlertRules from './views/projectAlertRules';
import ProjectReleaseTracking from './views/projectReleaseTracking';
import ProjectChooser from './views/projectChooser';
import ProjectCspSettings from './views/projectCspSettings';
import ProjectDashboard from './views/projectDashboard';
import ProjectDataForwarding from './views/projectDataForwarding';
import ProjectDetails from './views/projectDetails';
import ProjectEvents from './views/projectEvents';
import ProjectFilters from './views/projectFilters';
import NewProject from './views/projectInstall/newProject';
import ProjectGettingStarted from './views/projectInstall/gettingStarted';
import ProjectDocsContext from './views/projectInstall/docsContext';
import ProjectInstallOverview from './views/projectInstall/overview';
import ProjectInstallPlatform from './views/projectInstall/platform';
import ProjectReleases from './views/projectReleases';
import ProjectSavedSearches from './views/projectSavedSearches';
import ProjectDebugSymbols from './views/projectDebugSymbols';
import ProjectKeys from './views/projectKeys';
import ProjectKeyDetails from './views/projectKeyDetails';
import ProjectProcessingIssues from './views/projectProcessingIssues';
import ProjectSettings from './views/projectSettings';
import ProjectUserReports from './views/projectUserReports';
import ProjectUserReportSettings from './views/projectUserReportSettings';
import ReleaseAllEvents from './views/releaseAllEvents';
import ReleaseArtifacts from './views/releaseArtifacts';
import ReleaseCommits from './views/releases/releaseCommits';
import ReleaseDetails from './views/releaseDetails';
import ReleaseNewEvents from './views/releaseNewEvents';
import ReleaseOverview from './views/releases/releaseOverview';
import RouteNotFound from './views/routeNotFound';
import SharedGroupDetails from './views/sharedGroupDetails';
import Stream from './views/stream';
import TeamCreate from './views/teamCreate';
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

function routes() {
  let hooksRoutes = [];
  HookStore.get('routes').forEach(cb => {
    hooksRoutes.push(cb());
  });

  let hooksAdminRoutes = [];
  HookStore.get('routes:admin').forEach(cb => {
    hooksAdminRoutes.push(cb());
  });

  let hooksOrgRoutes = [];
  HookStore.get('routes:organization').forEach(cb => {
    hooksOrgRoutes.push(cb());
  });

  return (
    <Route path="/" component={errorHandler(App)}>

      <Route path="/account/" component={errorHandler(AccountLayout)}>
        <Route path="authorizations/" component={errorHandler(AccountAuthorizations)} />
      </Route>

      <Route path="/api/" component={errorHandler(ApiLayout)}>
        <IndexRoute component={errorHandler(ApiTokens)} />
        <Route path="applications/" component={errorHandler(ApiApplications)} />
        <Route
          path="applications/:appId/"
          component={errorHandler(ApiApplicationDetails)}
        />
      </Route>

      <Route path="/api/new-token/" component={errorHandler(ApiNewToken)} />

      <Route path="/manage/" component={errorHandler(AdminLayout)}>
        <IndexRoute component={errorHandler(AdminOverview)} />
        <Route path="buffer/" component={errorHandler(AdminBuffer)} />
        <Route path="organizations/" component={errorHandler(AdminOrganizations)} />
        <Route path="projects/" component={errorHandler(AdminProjects)} />
        <Route path="queue/" component={errorHandler(AdminQueue)} />
        <Route path="settings/" component={errorHandler(AdminSettings)} />
        <Route path="users/" component={errorHandler(AdminUsers)} />
        {hooksAdminRoutes}
      </Route>

      <Redirect from="/share/group/:shareId/" to="/share/issue/:shareId/" />
      <Route path="/share/issue/:shareId/" component={errorHandler(SharedGroupDetails)} />

      <Route path="/organizations/new/" component={errorHandler(OrganizationCreate)} />

      <Route path="/onboarding/:orgId/" component={errorHandler(OrganizationContext)}>
        <Route path="" component={errorHandler(OnboardingWizard)}>
          <IndexRoute component={errorHandler(CreateProject)} />
          <Route
            path=":projectId/configure/(:platform)"
            component={errorHandler(OnboardingConfigure)}
          />
        </Route>
      </Route>

      <Route path="/:orgId/" component={errorHandler(OrganizationDetails)}>
        <IndexRoute component={errorHandler(OrganizationDashboard)} />
        <Route
          path="/organizations/:orgId/api-keys/:apiKey/"
          component={errorHandler(OrganizationApiKeyDetailsView)}
        />
        <Route
          path="/organizations/:orgId/api-keys/"
          component={errorHandler(OrganizationApiKeysView)}
        />
        <Route
          path="/organizations/:orgId/audit-log/"
          component={errorHandler(OrganizationAuditLog)}
        />
        <Route
          path="/organizations/:orgId/auth/"
          component={errorHandler(OrganizationAuthView)}
        />
        <Route
          path="/organizations/:orgId/repos/"
          component={errorHandler(OrganizationRepositories)}
        />
        <Route
          path="/organizations/:orgId/integrations/"
          component={errorHandler(OrganizationIntegrations)}
        />
        <Route
          path="/organizations/:orgId/settings/"
          component={errorHandler(OrganizationSettings)}
        />
        <Route
          path="/organizations/:orgId/teams/"
          component={errorHandler(OrganizationTeams)}
        />
        <Route
          path="/organizations/:orgId/teams/new/"
          component={errorHandler(TeamCreate)}
        />
        <Route
          path="/organizations/:orgId/teams/:teamId/"
          component={errorHandler(TeamDetails)}>
          <IndexRedirect to="settings/" />
          <Route path="settings/" component={errorHandler(TeamSettings)} />
          <Route path="members/" component={errorHandler(TeamMembers)} />
        </Route>

        <Route
          path="/organizations/:orgId/all-teams/"
          component={errorHandler(OrganizationTeams)}>
          <IndexRoute component={errorHandler(AllTeamsList)} />
        </Route>
        <Route
          path="/organizations/:orgId/issues/assigned/"
          component={errorHandler(MyIssuesAssignedToMe)}
        />
        <Route
          path="/organizations/:orgId/issues/bookmarks/"
          component={errorHandler(MyIssuesBookmarked)}
        />
        <Route
          path="/organizations/:orgId/issues/history/"
          component={errorHandler(MyIssuesViewed)}
        />

        <Route
          path="/organizations/:orgId/projects/new/"
          component={errorHandler(NewProject)}
        />

        <Route
          path="/organizations/:orgId/projects/choose/"
          component={errorHandler(ProjectChooser)}
        />
        <Route
          path="/organizations/:orgId/rate-limits/"
          component={errorHandler(OrganizationRateLimits)}
        />
        <Route
          path="/organizations/:orgId/stats/"
          component={errorHandler(OrganizationStats)}
        />

        <Route
          path="/organizations/:orgId/actions/set-callsigns/"
          component={errorHandler(SetCallsignsAction)}
        />

        {hooksOrgRoutes}

        <Route
          path=":projectId/getting-started/"
          component={errorHandler(ProjectGettingStarted)}>
          <IndexRoute component={errorHandler(ProjectInstallOverview)} />
          <Route path=":platform/" component={errorHandler(ProjectInstallPlatform)} />
        </Route>

        <Route path=":projectId/" component={errorHandler(ProjectDetails)}>
          <IndexRoute component={errorHandler(Stream)} />
          <Route path="searches/:searchId/" component={errorHandler(Stream)} />
          <Route path="dashboard/" component={errorHandler(ProjectDashboard)} />
          <Route path="events/" component={errorHandler(ProjectEvents)} />
          <Route path="releases/" component={errorHandler(ProjectReleases)} />
          <Route
            name="releaseDetails"
            path="releases/:version/"
            component={errorHandler(ReleaseDetails)}>
            <IndexRoute component={errorHandler(ReleaseOverview)} />
            <Route path="new-events/" component={errorHandler(ReleaseNewEvents)} />
            <Route path="all-events/" component={errorHandler(ReleaseAllEvents)} />
            <Route path="artifacts/" component={errorHandler(ReleaseArtifacts)} />
            <Route path="commits/" component={errorHandler(ReleaseCommits)} />
          </Route>
          <Route path="user-feedback/" component={errorHandler(ProjectUserReports)} />
          <Route path="settings/" component={errorHandler(ProjectSettings)}>
            <Route path="alerts/" component={errorHandler(ProjectAlertSettings)} />
            <Route path="alerts/rules/" component={errorHandler(ProjectAlertRules)} />
            <Route
              path="release-tracking/"
              component={errorHandler(ProjectReleaseTracking)}
            />
            <Route
              path="data-forwarding/"
              component={errorHandler(ProjectDataForwarding)}
            />
            <Route path="debug-symbols/" component={errorHandler(ProjectDebugSymbols)} />
            <Route path="filters/" component={errorHandler(ProjectFilters)} />
            <Route
              path="saved-searches/"
              component={errorHandler(ProjectSavedSearches)}
            />
            <Route path="keys/" component={errorHandler(ProjectKeys)} />
            <Route path="keys/:keyId/" component={errorHandler(ProjectKeyDetails)} />
            <Route
              path="processing-issues/"
              component={errorHandler(ProjectProcessingIssues)}
            />
            <Route
              path="user-feedback/"
              component={errorHandler(ProjectUserReportSettings)}
            />
            <Route path="csp/" component={errorHandler(ProjectCspSettings)} />
            <Route path="install/" component={errorHandler(ProjectDocsContext)}>
              <IndexRoute component={errorHandler(ProjectInstallOverview)} />
              <Route path=":platform/" component={errorHandler(ProjectInstallPlatform)} />
            </Route>
          </Route>
          <Redirect from="group/:groupId/" to="issues/:groupId/" />
          <Route
            path="issues/:groupId/"
            component={errorHandler(GroupDetails)}
            ignoreScrollBehavior>
            <IndexRoute component={errorHandler(GroupEventDetails)} />

            <Route path="activity/" component={errorHandler(GroupActivity)} />
            <Route path="events/:eventId/" component={errorHandler(GroupEventDetails)} />
            <Route path="events/" component={errorHandler(GroupEvents)} />
            <Route path="tags/" component={errorHandler(GroupTags)} />
            <Route path="tags/:tagKey/" component={errorHandler(GroupTagValues)} />
            <Route path="feedback/" component={errorHandler(GroupUserReports)} />
            <Route path="similar/" component={errorHandler(GroupSimilarView)} />
            <Route path="merged/" component={errorHandler(GroupMergedView)} />

          </Route>
        </Route>
      </Route>

      {hooksRoutes}

      <Route
        path="*"
        component={errorHandler(RouteNotFound)}
        onEnter={appendTrailingSlash}
      />
    </Route>
  );
}

export default routes;
