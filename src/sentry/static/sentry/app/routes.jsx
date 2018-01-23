import {Redirect, Route, IndexRoute, IndexRedirect} from 'react-router';
import React from 'react';

import AccountAuthorizations from './views/accountAuthorizations';
import AccountLayout from './views/accountLayout';

import AdminBuffer from './views/adminBuffer';
import AdminLayout from './views/adminLayout';
import AdminOrganizations from './views/adminOrganizations';
import AdminOverview from './views/adminOverview';
import AdminProjects from './views/adminProjects';
import AdminQueue from './views/adminQueue';
import AdminQuotas from './views/adminQuotas';
import AdminSettings from './views/adminSettings';
import AdminUsers from './views/adminUsers';
import ApiApplicationDetails from './views/apiApplicationDetails';
import ApiApplications from './views/apiApplications';
import ApiLayout from './views/apiLayout';
import ApiNewToken from './views/apiNewToken';
import ApiTokens from './views/apiTokens';
import App from './views/app';
import CreateProject from './views/onboarding/createProject';
import GroupActivity from './views/groupActivity';
import GroupDetails from './views/groupDetails';
import GroupEventDetails from './views/groupEventDetails';
import GroupEvents from './views/groupEvents';
import GroupMergedView from './views/groupMerged/groupMergedView';
import GroupSimilarView from './views/groupSimilar/groupSimilarView';
import GroupTagValues from './views/groupTagValues';
import GroupTags from './views/groupTags';
import GroupUserReports from './views/groupUserReports';
import HookStore from './stores/hookStore';
import InviteMember from './views/inviteMember/inviteMember';
import LazyLoad from './components/lazyLoad';
import MyIssuesAssignedToMe from './views/myIssues/assignedToMe';
import MyIssuesBookmarked from './views/myIssues/bookmarked';
import MyIssuesViewed from './views/myIssues/viewed';
import NewProject from './views/projectInstall/newProject';
import OnboardingConfigure from './views/onboarding/configure/index';
import OnboardingWizard from './views/onboarding/index';
import OrganizationApiKeyDetailsView from './views/settings/organization/apiKeys/organizationApiKeyDetailsView';
import OrganizationApiKeysView from './views/settings/organization/apiKeys/organizationApiKeysView';
import OrganizationAuditLogView from './views/settings/organization/auditLog/auditLogView';
import OrganizationAuthView from './views/settings/organization/auth/organizationAuthView';
import OrganizationContext from './views/organizationContext';
import OrganizationCreate from './views/organizationCreate';
import OrganizationDashboard from './views/organizationDashboard';
import OrganizationDetails from './views/organizationDetails';
import OrganizationHomeContainer from './components/organizations/homeContainer';
import OrganizationIntegrations from './views/organizationIntegrations';
import OrganizationMemberDetail from './views/settings/organization/members/organizationMemberDetail';
import OrganizationMembersView from './views/settings/organization/members/organizationMembersView';
import OrganizationPicker from './views/settings/components/organizationPicker';
import OrganizationProjectsView from './views/settings/organization/projects/organizationProjectsView';
import OrganizationRateLimits from './views/organizationRateLimits';
import OrganizationRepositoriesView from './views/organizationRepositoriesView';
import OrganizationGeneralSettingsView from './views/settings/organization/general/organizationGeneralSettingsView';
import OrganizationStats from './views/organizationStats';
import OrganizationTeams from './views/organizationTeams';
import ProjectAlertRules from './views/projectAlertRules';
import ProjectAlertSettings from './views/projectAlertSettings';
import ProjectTags from './views/projectTags';
import ProjectChooser from './views/projectChooser';
import ProjectCspSettings from './views/projectCspSettings';
import ProjectDashboard from './views/projectDashboard';
import ProjectDataForwarding from './views/projectDataForwarding';
import ProjectDebugSymbols from './views/projectDebugSymbols';
import ProjectDetails from './views/projectDetails';
import ProjectDocsContext from './views/projectInstall/docsContext';
import ProjectEvents from './views/projectEvents';
import ProjectFilters from './views/projectFilters';
import ProjectGeneralSettings from './views/projectGeneralSettings';
import ProjectGettingStarted from './views/projectInstall/gettingStarted';
import ProjectInstallOverview from './views/projectInstall/overview';
import ProjectInstallPlatform from './views/projectInstall/platform';
import ProjectKeyDetails from './views/projectKeyDetails';
import ProjectKeys from './views/projectKeys';
import ProjectPicker from './views/settings/components/projectPicker';
import ProjectProcessingIssues from './views/projectProcessingIssues';
import ProjectIssueTracking from './views/projectIssueTracking';
import ProjectReleaseTracking from './views/projectReleaseTracking';
import ProjectReleases from './views/projectReleases';
import ProjectSavedSearches from './views/projectSavedSearches';
import ProjectSettings from './views/projectSettings';
import ProjectUserReportSettings from './views/projectUserReportSettings';
import ProjectUserReports from './views/projectUserReports';
import ProjectPlugins from './views/projectPlugins';
import ProjectPluginDetails from './views/projectPluginDetails';
import ReleaseAllEvents from './views/releaseAllEvents';
import ReleaseArtifacts from './views/releaseArtifacts';
import ReleaseCommits from './views/releases/releaseCommits';
import ReleaseDetails from './views/releaseDetails';
import ReleaseNewEvents from './views/releaseNewEvents';
import ReleaseOverview from './views/releases/releaseOverview';
import RouteNotFound from './views/routeNotFound';
import SetCallsignsAction from './views/requiredAdminActions/setCallsigns';
import SettingsProjectProvider from './views/settings/settingsProjectProvider';
import SettingsWrapper from './views/settings/settingsWrapper';
import SharedGroupDetails from './views/sharedGroupDetails';
import Stream from './views/stream';
import TeamCreate from './views/teamCreate';
import TeamDetails from './views/teamDetails';
import TeamMembers from './views/teamMembers';
import TeamSettings from './views/teamSettings';
import errorHandler from './utils/errorHandler';

function appendTrailingSlash(nextState, replace) {
  let lastChar = nextState.location.pathname.slice(-1);
  if (lastChar !== '/') {
    replace(nextState.location.pathname + '/');
  }
}

/**
 * Use react-router to lazy load a route. Use this for codesplitting containers (e.g. SettingsLayout)
 *
 * The method for lazy loading a route leaf node is using the <LazyLoad> component + `componentPromise`.
 * The reason for this is because react-router handles the route tree better and if we use <LazyLoad> it will end
 * up having to re-render more components than necesssary.
 */
const lazyLoad = cb => m => cb(null, m.default);

const accountSettingsRoutes = [
  <IndexRedirect key="account-settings-index" to="notifications/" />,
  <Route key="notifications/" path="notifications/" name="Notifications">
    <IndexRoute
      componentPromise={() => import('./views/settings/account/accountNotifications')}
      component={errorHandler(LazyLoad)}
    />
    <Route
      path="project-alerts/"
      name="Fine Tune Alerts"
      componentPromise={() =>
        import('./views/settings/account/accountNotificationFineTuning')}
      component={errorHandler(LazyLoad)}
    />
  </Route>,
  <Route
    key="emails/"
    path="emails/"
    name="Emails"
    componentPromise={() => import('./views/settings/account/accountEmails')}
    component={errorHandler(LazyLoad)}
  />,
  <Route
    key="avatar/"
    path="avatar/"
    name="Avatar"
    componentPromise={() => import('./views/settings/account/avatar')}
    component={errorHandler(LazyLoad)}
  />,

  <Route
    key="appearance/"
    path="appearance/"
    name="Appearance"
    componentPromise={() =>
      import(/*webpackChunkName: "AccountAppearance"*/ './views/settings/account/accountAppearance')}
    component={errorHandler(LazyLoad)}
  />,

  <Route
    key="authorizations/"
    path="authorizations/"
    componentPromise={() =>
      import(/*webpackChunkName: "AccountAuthorizations"*/ './views/settings/account/accountAuthorizations')}
    component={errorHandler(LazyLoad)}
  />,
  <Route
    key="subscriptions/"
    path="subscriptions/"
    name="Subscriptions"
    componentPromise={() =>
      import(/*webpackChunkName: "AccountSubscriptions"*/ './views/settings/account/accountSubscriptions')}
    component={errorHandler(LazyLoad)}
  />,

  <Route
    key="identities/"
    path="identities/"
    name="Identities"
    componentPromise={() =>
      import(/*webpackChunkName: "AccountSocialIdentities"*/ './views/settings/account/accountIdentities')}
    component={errorHandler(LazyLoad)}
  />,

  <Route key="api" path="api/" name="API">
    <IndexRedirect to="auth-tokens/" />

    <Route path="auth-tokens/" name="Auth Tokens">
      <IndexRoute
        componentPromise={() =>
          import(/*webpackChunkName: "ApiTokensIndex"*/ './views/settings/account/apiTokens')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="new-token/"
        name="Create New Token"
        componentPromise={() =>
          import(/*webpackChunkName: "ApiTokenCreate"*/ './views/settings/account/apiNewToken')}
        component={errorHandler(LazyLoad)}
      />
    </Route>

    <Route path="applications/" name="Applications">
      <IndexRoute
        componentPromise={() =>
          import(/*webpackChunkName: "ApiApplications"*/ './views/settings/account/apiApplications')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path=":appId/"
        name="Details"
        componentPromise={() =>
          import(/*webpackChunkName: "ApiApplicationDetails"*/ './views/settings/account/apiApplicationDetails')}
        component={errorHandler(LazyLoad)}
      />
    </Route>
  </Route>,
];

const projectSettingsRoutes = [
  <IndexRedirect key="projects-index" to="settings/" />,
  <Route
    key="settings/"
    path="settings/"
    name="General"
    component={errorHandler(ProjectGeneralSettings)}
  />,
  <Route
    key="alerts/"
    name="Alerts"
    path="alerts/"
    component={errorHandler(ProjectAlertSettings)}
  />,
  <Route key="tags/" name="Tags" path="tags/" component={errorHandler(ProjectTags)} />,
  <Route
    key="alerts/rules/"
    path="alerts/rules/"
    name="Alert Rules"
    component={errorHandler(ProjectAlertRules)}
  />,
  <Route
    key="issue-tracking/"
    path="issue-tracking/"
    name="Issue Tracking"
    component={errorHandler(ProjectIssueTracking)}
  />,
  <Route
    key="release-tracking/"
    path="release-tracking/"
    name="Release Tracking"
    component={errorHandler(ProjectReleaseTracking)}
  />,
  <Route
    key="data-forwarding/"
    path="data-forwarding/"
    name="Data Forwarding"
    component={errorHandler(ProjectDataForwarding)}
  />,
  <Route
    key="saved-searches/"
    path="saved-searches/"
    name="Saved Searches"
    component={errorHandler(ProjectSavedSearches)}
  />,
  <Route
    key="debug-symbols/"
    path="debug-symbols/"
    name="Debug Information Files"
    component={errorHandler(ProjectDebugSymbols)}
  />,
  <Route
    key="processing-issues/"
    path="processing-issues/"
    name="Processing Issues"
    component={errorHandler(ProjectProcessingIssues)}
  />,
  <Route
    key="filters/"
    path="filters/"
    name="Inbound Filters"
    component={errorHandler(ProjectFilters)}
  />,
  <Route
    key="keys/"
    path="keys/"
    name="Client Keys"
    component={errorHandler(ProjectKeys)}
  />,
  <Route
    key="keys/:keyId/"
    path="keys/:keyId/"
    name="Client Key Details"
    component={errorHandler(ProjectKeyDetails)}
  />,
  <Route
    key="user-feedback/"
    path="user-feedback/"
    name="User Feedback"
    component={errorHandler(ProjectUserReportSettings)}
  />,
  <Route
    key="csp/"
    path="csp/"
    name="CSP Reports"
    component={errorHandler(ProjectCspSettings)}
  />,
  <Route
    key="plugins/"
    path="plugins/"
    name="Integrations"
    component={errorHandler(ProjectPlugins)}
  />,
  <Route
    key="plugins/:pluginId/"
    path="plugins/:pluginId/"
    name="Integration Details"
    component={errorHandler(ProjectPluginDetails)}
  />,
  <Route
    key="install/"
    path="install/"
    name="Basic Configuration"
    component={errorHandler(ProjectDocsContext)}
  >
    <IndexRoute component={errorHandler(ProjectInstallOverview)} />
    <Route path=":platform/" component={errorHandler(ProjectInstallPlatform)} />
  </Route>,
];

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

  // This is declared in the routes() function because some routes need the
  // hook store which is not available at import time.
  const orgSettingsRoutes = [
    <IndexRedirect key="index-org-settings" to="settings/" />,

    <Route
      key="projects"
      path="projects/"
      name="Projects"
      component={errorHandler(OrganizationProjectsView)}
    />,

    <Route
      key="settings"
      path="settings/"
      name="General"
      component={errorHandler(OrganizationGeneralSettingsView)}
    />,

    <Route
      key="api-keys"
      path="api-keys/"
      name="API Key"
      component={errorHandler(OrganizationApiKeysView)}
    />,

    <Route
      key="api-keys-detail"
      path="api-keys/:apiKey/"
      component={errorHandler(OrganizationApiKeyDetailsView)}
    />,

    <Route
      key="audit-log"
      path="audit-log/"
      name="Audit Log"
      component={errorHandler(OrganizationAuditLogView)}
    />,

    <Route
      key="auth"
      path="auth/"
      name="Auth Providers"
      component={errorHandler(OrganizationAuthView)}
    />,

    <Route
      key="integrations"
      path="integrations/"
      name="Integrations"
      component={errorHandler(OrganizationIntegrations)}
    />,

    <Route key="members" path="members/" name="Members">
      <IndexRoute
        component={
          HookStore.get('component:org-members-view').length
            ? HookStore.get('component:org-members-view')[0]()
            : OrganizationMembersView
        }
      />
      <Route path="new/" name="Invite" component={errorHandler(InviteMember)} />,
      <Route
        path=":memberId/"
        name="Details"
        component={errorHandler(OrganizationMemberDetail)}
      />,
    </Route>,

    <Route
      key="rate-limits"
      path="rate-limits/"
      name="Rate Limits"
      component={errorHandler(OrganizationRateLimits)}
    />,

    <Route
      key="repos"
      path="repos/"
      name="Repositories"
      component={errorHandler(OrganizationRepositoriesView)}
    />,

    <Route
      key="settings"
      path="settings/"
      component={errorHandler(OrganizationGeneralSettingsView)}
    />,

    <Route key="teams" name="Project & Teams" path="teams/">
      <IndexRedirect to="your-teams" />
      <Route
        path="all-teams/"
        name="All Teams"
        allTeams
        component={errorHandler(OrganizationTeams)}
      />

      <Route
        name="Your Teams"
        path="your-teams/"
        component={errorHandler(OrganizationTeams)}
      />

      <Route
        key="team-details"
        name="Team"
        path=":teamId/"
        component={errorHandler(TeamDetails)}
      >
        <IndexRedirect to="settings/" />
        <Route path="settings/" name="Settings" component={errorHandler(TeamSettings)} />
        <Route path="members/" name="Members" component={errorHandler(TeamMembers)} />
      </Route>
    </Route>,

    <Route
      key="org-stats"
      name="Stats"
      path="stats/"
      component={errorHandler(OrganizationStats)}
    />,
  ];

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

      <Route newnew path="/settings/" name="Settings" component={SettingsWrapper}>
        <IndexRoute
          getComponent={(loc, cb) =>
            import('./views/settings/settingsIndex').then(lazyLoad(cb))}
        />

        <Route
          path="account/"
          name="Account"
          getComponent={(loc, cb) =>
            import('./views/settings/account/accountSettingsLayout').then(lazyLoad(cb))}
        >
          {accountSettingsRoutes}
        </Route>

        <Route path="organization/">
          <IndexRoute component={errorHandler(OrganizationPicker)} />

          <Route
            name="Organization"
            path=":orgId/"
            component={errorHandler(OrganizationContext)}
          >
            <Route
              getComponent={(loc, cb) =>
                import('./views/settings/organization/organizationSettingsLayout').then(
                  lazyLoad(cb)
                )}
            >
              {orgSettingsRoutes}
            </Route>

            <Route path="project/">
              <IndexRoute component={errorHandler(ProjectPicker)} />
              <Route
                name="Project"
                path=":projectId/"
                getComponent={(loc, cb) =>
                  import('./views/settings/project/projectSettingsLayout').then(
                    lazyLoad(cb)
                  )}
              >
                <Route component={errorHandler(SettingsProjectProvider)}>
                  {projectSettingsRoutes}
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="/api/new-token/" component={errorHandler(ApiNewToken)} />

      <Route path="/manage/" component={errorHandler(AdminLayout)}>
        <IndexRoute component={errorHandler(AdminOverview)} />
        <Route path="buffer/" component={errorHandler(AdminBuffer)} />
        <Route path="organizations/" component={errorHandler(AdminOrganizations)} />
        <Route path="projects/" component={errorHandler(AdminProjects)} />
        <Route path="queue/" component={errorHandler(AdminQueue)} />
        <Route path="quotas/" component={errorHandler(AdminQuotas)} />
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
          path="/organizations/:orgId/teams/new/"
          component={errorHandler(TeamCreate)}
        />

        <Route path="/organizations/:orgId/" component={OrganizationHomeContainer}>
          {hooksOrgRoutes}
          {orgSettingsRoutes}
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
          path="/organizations/:orgId/actions/set-callsigns/"
          component={errorHandler(SetCallsignsAction)}
        />

        <Route
          path=":projectId/getting-started/"
          component={errorHandler(ProjectGettingStarted)}
        >
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
            component={errorHandler(ReleaseDetails)}
          >
            <IndexRoute component={errorHandler(ReleaseOverview)} />
            <Route path="new-events/" component={errorHandler(ReleaseNewEvents)} />
            <Route path="all-events/" component={errorHandler(ReleaseAllEvents)} />
            <Route path="artifacts/" component={errorHandler(ReleaseArtifacts)} />
            <Route path="commits/" component={errorHandler(ReleaseCommits)} />
          </Route>
          <Route path="user-feedback/" component={errorHandler(ProjectUserReports)} />

          <Route path="settings/" component={errorHandler(ProjectSettings)}>
            {projectSettingsRoutes}
          </Route>

          <Redirect from="group/:groupId/" to="issues/:groupId/" />
          <Route
            path="issues/:groupId/"
            component={errorHandler(GroupDetails)}
            ignoreScrollBehavior
          >
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
