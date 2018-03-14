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
import OrganizationActivity from './views/organizationActivity';
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
import ProjectAlertRuleDetails from './views/projectAlertRuleDetails';
import ProjectAlertSettings from './views/projectAlertSettings';
import ProjectEnvironments from './views/projectEnvironments';
import ProjectTags from './views/projectTags';
import ProjectChooser from './views/projectChooser';
import ProjectDashboard from './views/projectDashboard';
import ProjectDataForwarding from './views/projectDataForwarding';
import ProjectDebugSymbols from './views/projectDebugSymbols';
import ProjectDetails from './views/projectDetails';
import ProjectDocsContext from './views/projectInstall/docsContext';
import ProjectEvents from './views/projectEvents';
import ProjectGeneralSettings from './views/projectGeneralSettings';
import ProjectGettingStarted from './views/projectInstall/gettingStarted';
import ProjectInstallOverview from './views/projectInstall/overview';
import ProjectInstallPlatform from './views/projectInstall/platform';
import ProjectPicker from './views/settings/components/projectPicker';
import ProjectIssueTracking from './views/projectIssueTracking';
import ProjectReleases from './views/projectReleases';
import ProjectSavedSearches from './views/projectSavedSearches';
import ProjectSettings from './views/projectSettings';
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
import SettingsProjectProvider from './views/settings/settingsProjectProvider';
import SettingsWrapper from './views/settings/settingsWrapper';
import SharedGroupDetails from './views/sharedGroupDetails';
import Stream from './views/stream';
import TeamCreate from './views/teamCreate';
import TeamDetails from './views/teamDetails';
import TeamMembers from './views/teamMembers';
import TeamSettings from './views/teamSettings';
import TeamProjects from './views/settings/team/teamProjects';
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

const accountSettingsRoutes = (
  <React.Fragment>
    <IndexRedirect to="details/" />

    <Route
      path="details/"
      name="Details"
      componentPromise={() =>
        import(/* webpackChunkName: "AccountDetails" */ './views/settings/account/accountDetails')}
      component={errorHandler(LazyLoad)}
    />

    <Route path="notifications/" name="Notifications">
      <IndexRoute
        componentPromise={() =>
          import(/* webpackChunkName: "AccountNotifications" */ './views/settings/account/accountNotifications')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path=":fineTuneType/"
        name="Fine Tune Alerts"
        componentPromise={() =>
          import(/* webpackChunkName: "AccountNotificationsFineTuning" */ './views/settings/account/accountNotificationFineTuning')}
        component={errorHandler(LazyLoad)}
      />
    </Route>
    <Route
      path="emails/"
      name="Emails"
      componentPromise={() =>
        import(/* webpackChunkName: "AccountEmails" */ './views/settings/account/accountEmails')}
      component={errorHandler(LazyLoad)}
    />

    <Route
      path="authorizations/"
      componentPromise={() =>
        import(/*webpackChunkName: "AccountAuthorizations"*/ './views/settings/account/accountAuthorizations')}
      component={errorHandler(LazyLoad)}
    />

    <Route name="Security" path="security/">
      <IndexRoute
        componentPromise={() =>
          import(/*webpackChunkName: "AccountSecurity"*/ './views/settings/account/accountSecurity/index')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path=":authId/enroll/"
        name="Enroll"
        componentPromise={() =>
          import(/*webpackChunkName: "AccountSecurityEnroll"*/ './views/settings/account/accountSecurity/accountSecurityEnroll')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path=":authId/"
        name="Details"
        componentPromise={() =>
          import(/*webpackChunkName: "AccountSecurityDetails"*/ './views/settings/account/accountSecurity/accountSecurityDetails')}
        component={errorHandler(LazyLoad)}
      />
    </Route>

    <Route
      path="subscriptions/"
      name="Subscriptions"
      componentPromise={() =>
        import(/*webpackChunkName: "AccountSubscriptions"*/ './views/settings/account/accountSubscriptions')}
      component={errorHandler(LazyLoad)}
    />

    <Route
      path="identities/"
      name="Identities"
      componentPromise={() =>
        import(/*webpackChunkName: "AccountSocialIdentities"*/ './views/settings/account/accountIdentities')}
      component={errorHandler(LazyLoad)}
    />

    <Route path="api/" name="API">
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
    </Route>

    <Route
      path="close-account/"
      name="Close Account"
      componentPromise={() =>
        import(/*webpackChunkName: "AccountClose"*/ './views/settings/account/accountClose')}
      component={errorHandler(LazyLoad)}
    />
  </React.Fragment>
);

const projectSettingsRoutes = (
  <React.Fragment>
    <IndexRedirect to="settings/" />
    <Route
      path="settings/"
      name="General"
      component={errorHandler(ProjectGeneralSettings)}
    />
    <Route
      path="teams/"
      name="Teams"
      componentPromise={() =>
        import(/*webpackChunkName: "ProjectTeams"*/ './views/settings/project/projectTeams')}
      component={errorHandler(LazyLoad)}
    />
    <Route name="Alerts" path="alerts/" component={errorHandler(ProjectAlertSettings)} />
    <Route
      path="alerts/rules/"
      name="Alert Rules"
      component={errorHandler(ProjectAlertRules)}
    />
    <Route
      path="alerts/rules/new/"
      name="New Alert Rule"
      component={errorHandler(ProjectAlertRuleDetails)}
    />
    <Route
      path="alerts/rules/:ruleId/"
      name="Edit Alert Rule"
      component={errorHandler(ProjectAlertRuleDetails)}
    />
    <Route
      name="Environments"
      path="environments/"
      component={errorHandler(ProjectEnvironments)}
    />
    <Route
      name="Hidden Environments"
      path="environments/hidden/"
      component={errorHandler(ProjectEnvironments)}
    />
    <Route name="Tags" path="tags/" component={errorHandler(ProjectTags)} />
    <Route
      path="issue-tracking/"
      name="Issue Tracking"
      component={errorHandler(ProjectIssueTracking)}
    />
    <Route
      path="release-tracking/"
      name="Release Tracking"
      componentPromise={() =>
        import(/* webpackChunkName: "ProjectReleaseTracking" */ './views/settings/project/projectReleaseTracking')}
      component={errorHandler(LazyLoad)}
    />
    <Route
      path="ownership/"
      name="Issue Ownership"
      componentPromise={() =>
        import(/* webpackChunkName: "projectOwnership" */ './views/settings/project/projectOwnership')}
      component={errorHandler(LazyLoad)}
    />
    <Route
      path="data-forwarding/"
      name="Data Forwarding"
      component={errorHandler(ProjectDataForwarding)}
    />
    <Route
      path="saved-searches/"
      name="Saved Searches"
      component={errorHandler(ProjectSavedSearches)}
    />
    <Route
      path="debug-symbols/"
      name="Debug Information Files"
      component={errorHandler(ProjectDebugSymbols)}
    />
    <Route
      key="processing-issues/"
      path="processing-issues/"
      name="Processing Issues"
      componentPromise={() =>
        import(/*webpackChunkName: "ProjectProcessingIssues"*/ './views/settings/project/projectProcessingIssues')}
      component={errorHandler(LazyLoad)}
    />
    <Route
      path="filters/"
      name="Inbound Filters"
      componentPromise={() =>
        import(/* webpackChunkName: "ProjectFilters" */ './views/settings/project/projectFilters')}
      component={errorHandler(LazyLoad)}
    >
      <IndexRedirect to="data-filters/" />
      <Route path=":filterType/" />
    </Route>
    <Route path="keys/" name="Client Keys">
      <IndexRoute
        componentPromise={() =>
          import(/*webpackChunkName: "ProjectKeys"*/ './views/settings/project/projectKeys')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path=":keyId/"
        name="Details"
        componentPromise={() =>
          import(/*webpackChunkName: "ProjectKeyDetails"*/ './views/settings/project/projectKeys/projectKeyDetails')}
        component={errorHandler(LazyLoad)}
      />
    </Route>
    <Route
      path="user-feedback/"
      name="User Feedback"
      componentPromise={() =>
        import(/*webpackChunkName: "ProjectUserFeedbackSettings"*/ './views/settings/project/projectUserFeedback')}
      component={errorHandler(LazyLoad)}
    />
    <Route
      key="csp/"
      path="csp/"
      name="CSP Reports"
      componentPromise={() =>
        import(/*webpackChunkName: "ProjectCspReports"*/ './views/settings/project/projectCspReports')}
      component={errorHandler(LazyLoad)}
    />
    <Route path="plugins/" name="Integrations" component={errorHandler(ProjectPlugins)} />
    <Route
      path="plugins/:pluginId/"
      name="Integration Details"
      component={errorHandler(ProjectPluginDetails)}
    />
    {/* XXX(epurkhiser): This lives under project configurations for now until
        we've migrated enough integrations that it can live at the org level. */}
    <Route
      path="integrations/:providerKey/"
      name="Integration Configuration"
      componentPromise={() =>
        import(/* webpackChunkName: "OrganizationIntegrationConfig" */ './views/organizationIntegrationConfig')}
      component={errorHandler(LazyLoad)}
    />,
    <Route
      path="install/"
      name="Basic Configuration"
      component={errorHandler(ProjectDocsContext)}
    >
      <IndexRoute component={errorHandler(ProjectInstallOverview)} />
      <Route path=":platform/" component={errorHandler(ProjectInstallPlatform)} />
    </Route>
  </React.Fragment>
);

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
  const orgSettingsRoutes = (
    <React.Fragment>
      <IndexRedirect to="settings/" />

      <Route
        path="projects/"
        name="Projects"
        component={errorHandler(OrganizationProjectsView)}
      />

      <Route
        path="settings/"
        name="General"
        component={errorHandler(OrganizationGeneralSettingsView)}
      />

      <Route
        path="api-keys/"
        name="API Key"
        component={errorHandler(OrganizationApiKeysView)}
      />

      <Route
        path="api-keys/:apiKey/"
        component={errorHandler(OrganizationApiKeyDetailsView)}
      />

      <Route
        path="audit-log/"
        name="Audit Log"
        component={errorHandler(OrganizationAuditLogView)}
      />

      <Route
        path="auth/"
        name="Auth Providers"
        component={errorHandler(OrganizationAuthView)}
      />

      <Route
        path="integrations/"
        name="Integrations"
        component={errorHandler(OrganizationIntegrations)}
      />

      <Route path="members/" name="Members">
        <IndexRoute
          component={
            HookStore.get('component:org-members-view').length
              ? HookStore.get('component:org-members-view')[0]()
              : OrganizationMembersView
          }
        />
        <Route path="new/" name="Invite" component={errorHandler(InviteMember)} />
        <Route
          path=":memberId/"
          name="Details"
          component={errorHandler(OrganizationMemberDetail)}
        />
      </Route>

      <Route
        path="rate-limits/"
        name="Rate Limits"
        component={errorHandler(OrganizationRateLimits)}
      />

      <Route
        path="repos/"
        name="Repositories"
        component={errorHandler(OrganizationRepositoriesView)}
      />

      <Route path="settings/" component={errorHandler(OrganizationGeneralSettingsView)} />

      <Route name="Teams" path="teams/">
        <IndexRoute component={errorHandler(OrganizationTeams)} />

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

        <Route name="Team" path=":teamId/" component={errorHandler(TeamDetails)}>
          <IndexRedirect to="members/" />
          <Route path="members/" name="Members" component={errorHandler(TeamMembers)} />
          <Route
            path="projects/"
            name="Projects"
            component={errorHandler(TeamProjects)}
          />
          <Route
            path="settings/"
            name="settings"
            component={errorHandler(TeamSettings)}
          />
        </Route>
      </Route>

      <Route name="Stats" path="stats/" component={errorHandler(OrganizationStats)} />
    </React.Fragment>
  );

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
            import(/* webpackChunkName: "SettingsIndex" */ './views/settings/settingsIndex').then(
              lazyLoad(cb)
            )}
        />

        <Route
          path="account/"
          name="Account"
          getComponent={(loc, cb) =>
            import(/* webpackChunkName: "AccountSettingsLayout" */ './views/settings/account/accountSettingsLayout').then(
              lazyLoad(cb)
            )}
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
                import(/*webpackChunkName: "OrganizationSettingsLayout" */ './views/settings/organization/organizationSettingsLayout').then(
                  lazyLoad(cb)
                )}
            >
              {hooksOrgRoutes}
              {orgSettingsRoutes}
            </Route>

            <Route path="project/">
              <IndexRoute component={errorHandler(ProjectPicker)} />
              <Route
                name="Project"
                path=":projectId/"
                getComponent={(loc, cb) =>
                  import(/*webpackChunkName: "ProjectSettingsLayout" */ './views/settings/project/projectSettingsLayout').then(
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
          path="/organizations/:orgId/activity/"
          component={errorHandler(OrganizationActivity)}
        />

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
