import {Redirect, Route, IndexRoute, IndexRedirect} from 'react-router';
import React from 'react';

import AcceptProjectTransfer from 'app/views/acceptProjectTransfer';
import AccountAuthorizations from 'app/views/accountAuthorizations';
import AccountLayout from 'app/views/accountLayout';
import AdminAgents from 'app/views/adminAgents';
import AdminBuffer from 'app/views/adminBuffer';
import AdminLayout from 'app/views/adminLayout';
import AdminOrganizations from 'app/views/adminOrganizations';
import AdminOverview from 'app/views/adminOverview';
import AdminProjects from 'app/views/adminProjects';
import AdminQueue from 'app/views/adminQueue';
import AdminQuotas from 'app/views/adminQuotas';
import AdminSettings from 'app/views/adminSettings';
import AdminUsers from 'app/views/adminUsers';
import ApiApplicationDetails from 'app/views/apiApplicationDetails';
import ApiApplications from 'app/views/apiApplications';
import ApiLayout from 'app/views/apiLayout';
import ApiNewToken from 'app/views/apiNewToken';
import ApiTokens from 'app/views/apiTokens';
import App from 'app/views/app';
import CreateProject from 'app/views/onboarding/createProject';
import GroupDetails from 'app/views/groupDetails';
import GroupEvents from 'app/views/groupEvents';
import GroupEventDetails from 'app/views/groupEventDetails';
import GroupMergedView from 'app/views/groupMerged/groupMergedView';
import GroupSimilarView from 'app/views/groupSimilar/groupSimilarView';
import GroupTagValues from 'app/views/groupTagValues';
import GroupTags from 'app/views/groupTags';
import GroupUserReports from 'app/views/groupUserReports';
import HookStore from 'app/stores/hookStore';
import InviteMember from 'app/views/inviteMember/inviteMember';
import LazyLoad from 'app/components/lazyLoad';
import MyIssuesAssignedToMe from 'app/views/myIssues/assignedToMe';
import MyIssuesBookmarked from 'app/views/myIssues/bookmarked';
import MyIssuesViewed from 'app/views/myIssues/viewed';
import NewProject from 'app/views/projectInstall/newProject';
import OnboardingConfigure from 'app/views/onboarding/configure/index';
import OnboardingWizard from 'app/views/onboarding/index';
import OrganizationActivity from 'app/views/organizationActivity';
import OrganizationApiKeyDetailsView from 'app/views/settings/organization/apiKeys/organizationApiKeyDetailsView';
import OrganizationApiKeysView from 'app/views/settings/organization/apiKeys/organizationApiKeysView';
import OrganizationAuditLogView from 'app/views/settings/organization/auditLog/auditLogView';
import OrganizationContext from 'app/views/organizationContext';
import OrganizationCreate from 'app/views/organizationCreate';
import OrganizationDashboard from 'app/views/organizationDashboard';
import OrganizationDetails from 'app/views/organizationDetails';
import OrganizationHomeContainer from 'app/components/organizations/homeContainer';
import OrganizationMemberDetail from 'app/views/settings/organization/members/organizationMemberDetail';
import OrganizationMembersView from 'app/views/settings/organization/members/organizationMembersView';
import OrganizationProjectsView from 'app/views/settings/organization/projects/organizationProjectsView';
import OrganizationRateLimits from 'app/views/organizationRateLimits';
import OrganizationRoot from 'app/views/organizationRoot';
import OrganizationRepositoriesView from 'app/views/organizationRepositoriesView';
import OrganizationGeneralSettingsView from 'app/views/settings/organization/general/organizationGeneralSettingsView';
import OrganizationStats from 'app/views/organizationStats';
import OrganizationTeams from 'app/views/organizationTeams';
import OrganizationTeamsProjectsView from 'app/views/organizationTeamsProjects';
import ProjectAlertRules from 'app/views/settings/projectAlerts/projectAlertRules';
import ProjectAlertRuleDetails from 'app/views/settings/projectAlerts/projectAlertRuleDetails';
import ProjectAlertSettings from 'app/views/settings/projectAlerts/projectAlertSettings';
import ProjectEnvironments from 'app/views/projectEnvironments';
import ProjectTags from 'app/views/projectTags';
import ProjectChooser from 'app/views/projectChooser';
import ProjectDashboard from 'app/views/projectDashboard';
import ProjectDataForwarding from 'app/views/projectDataForwarding';
import ProjectDebugSymbols from 'app/views/projectDebugSymbols';
import ProjectDetails from 'app/views/projectDetails';
import ProjectDocsContext from 'app/views/projectInstall/docsContext';
import ProjectEvents from 'app/views/projectEvents';
import ProjectGeneralSettings from 'app/views/projectGeneralSettings';
import ProjectGettingStarted from 'app/views/projectInstall/gettingStarted';
import ProjectInstallOverview from 'app/views/projectInstall/overview';
import ProjectInstallPlatform from 'app/views/projectInstall/platform';
import ProjectIssueTracking from 'app/views/projectIssueTracking';
import ProjectReleases from 'app/views/projectReleases';
import ProjectSavedSearches from 'app/views/projectSavedSearches';
import ProjectSettings from 'app/views/projectSettings';
import ProjectUserReports from 'app/views/projectUserReports';
import ProjectPlugins from 'app/views/projectPlugins';
import ProjectPluginDetails from 'app/views/projectPluginDetails';
import ReleaseAllEvents from 'app/views/releaseAllEvents';
import ReleaseArtifacts from 'app/views/releaseArtifacts';
import ReleaseCommits from 'app/views/releases/releaseCommits';
import ReleaseDetails from 'app/views/releaseDetails';
import ReleaseNewEvents from 'app/views/releaseNewEvents';
import ReleaseOverview from 'app/views/releases/releaseOverview';
import RouteNotFound from 'app/views/routeNotFound';
import SettingsProjectProvider from 'app/views/settings/components/settingsProjectProvider';
import SettingsWrapper from 'app/views/settings/components/settingsWrapper';
import Stream from 'app/views/stream';
import TeamCreate from 'app/views/teamCreate';
import TeamDetails from 'app/views/teamDetails';
import TeamMembers from 'app/views/teamMembers';
import TeamSettings from 'app/views/teamSettings';
import TeamProjects from 'app/views/settings/team/teamProjects';
import errorHandler from 'app/utils/errorHandler';

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
    <IndexRoute name="General" component={errorHandler(ProjectGeneralSettings)} />
    <Route
      path="teams/"
      name="Teams"
      componentPromise={() =>
        import(/*webpackChunkName: "ProjectTeams"*/ './views/settings/project/projectTeams')}
      component={errorHandler(LazyLoad)}
    />
    <Route name="Alerts" path="alerts/">
      <IndexRoute component={errorHandler(ProjectAlertSettings)} />
      <Route path="rules/" name="Rules" component={null}>
        <IndexRoute component={errorHandler(ProjectAlertRules)} />
        <Route path="new/" name="New" component={errorHandler(ProjectAlertRuleDetails)} />
        <Route
          path=":ruleId/"
          name="Edit"
          component={errorHandler(ProjectAlertRuleDetails)}
        />
      </Route>
    </Route>
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
      name="Issue Owners"
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
    <Route
      key="hooks/"
      path="hooks/"
      name="Service Hooks"
      componentPromise={() =>
        import(/*webpackChunkName: "ProjectServiceHooks"*/ './views/settings/project/projectServiceHooks')}
      component={errorHandler(LazyLoad)}
    />
    <Route
      key="hooks/new/"
      path="hooks/new/"
      name="Create Service Hook"
      componentPromise={() =>
        import(/*webpackChunkName: "ProjectCreateServiceHook"*/ './views/settings/project/projectCreateServiceHook')}
      component={errorHandler(LazyLoad)}
    />
    <Route
      key="hooks/:hookId/"
      path="hooks/:hookId/"
      name="Service Hook Details"
      componentPromise={() =>
        import(/*webpackChunkName: "ProjectServiceHookDetails"*/ './views/settings/project/projectServiceHookDetails')}
      component={errorHandler(LazyLoad)}
    />
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
    <Redirect from="csp/" to="security-headers/" />
    <Route key="security-headers/" path="security-headers/" name="Security Headers">
      <IndexRoute
        componentPromise={() =>
          import(/*webpackChunkName: "ProjectSecurityHeaders"*/ './views/settings/projectSecurityHeaders')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="csp/"
        key="csp/"
        name="Content Security Policy"
        componentPromise={() =>
          import(/*webpackChunkName: "ProjectCspReports"*/ './views/settings/projectSecurityHeaders/csp')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="expect-ct/"
        key="expect-ct/"
        name="Certificate Transparency"
        componentPromise={() =>
          import(/*webpackChunkName: "ProjectExpectCtReports"*/ './views/settings/projectSecurityHeaders/expectCt')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="hpkp/"
        key="hpkp/"
        name="HPKP"
        componentPromise={() =>
          import(/*webpackChunkName: "ProjectHpkpReports"*/ './views/settings/projectSecurityHeaders/hpkp')}
        component={errorHandler(LazyLoad)}
      />
    </Route>
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
    />
    <Route
      path="install/"
      name="Configuration"
      component={errorHandler(ProjectDocsContext)}
    >
      <IndexRoute component={errorHandler(ProjectInstallOverview)} />
      <Route
        path=":platform/"
        name="Docs"
        component={errorHandler(ProjectInstallPlatform)}
      />
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
      <IndexRoute
        name="General"
        component={errorHandler(OrganizationGeneralSettingsView)}
      />

      <Route
        path="projects/"
        name="Projects"
        component={errorHandler(OrganizationProjectsView)}
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
        componentPromise={() =>
          import(/*webpackChunkName: OrganizationAuthView*/ './views/settings/organization/auth/organizationAuthView')}
        component={errorHandler(LazyLoad)}
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
    </React.Fragment>
  );

  return (
    <Route path="/" component={errorHandler(App)}>
      <Route path="/accept-transfer/" component={errorHandler(AcceptProjectTransfer)} />
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

      <Route path="/api/new-token/" component={errorHandler(ApiNewToken)} />

      <Route path="/manage/" component={errorHandler(AdminLayout)}>
        <IndexRoute component={errorHandler(AdminOverview)} />
        <Route path="buffer/" component={errorHandler(AdminBuffer)} />
        <Route path="agents/" component={errorHandler(AdminAgents)} />
        <Route path="organizations/" component={errorHandler(AdminOrganizations)} />
        <Route path="projects/" component={errorHandler(AdminProjects)} />
        <Route path="queue/" component={errorHandler(AdminQueue)} />
        <Route path="quotas/" component={errorHandler(AdminQuotas)} />
        <Route path="settings/" component={errorHandler(AdminSettings)} />
        <Route path="users/" component={errorHandler(AdminUsers)} />
        {hooksAdminRoutes}
      </Route>

      <Redirect from="/share/group/:shareId/" to="/share/issue/:shareId/" />
      <Route
        path="/share/issue/:shareId/"
        componentPromise={() =>
          import(/*webpackChunkName:"SharedGroupDetails"*/ './views/sharedGroupDetails')}
        component={errorHandler(LazyLoad)}
      />

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
        <Route component={errorHandler(OrganizationRoot)}>
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
            <Route
              path="projects/"
              component={errorHandler(OrganizationTeamsProjectsView)}
            />
            {hooksOrgRoutes}
            {orgSettingsRoutes}
            <Route path="stats/" component={errorHandler(OrganizationStats)} />
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
        </Route>

        <Route
          path=":projectId/getting-started/"
          component={errorHandler(ProjectGettingStarted)}
        >
          <IndexRoute component={errorHandler(ProjectInstallOverview)} />
          <Route path=":platform/" component={errorHandler(ProjectInstallPlatform)} />
        </Route>

        <Route path=":projectId/" component={errorHandler(ProjectDetails)}>
          <IndexRoute component={errorHandler(Stream)} />
          <Route path="issues/" component={errorHandler(Stream)} />

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

            <Route
              path="activity/"
              componentPromise={() =>
                import(/*webpackChunkName: "GroupActivity"*/ './views/groupActivity')}
              component={errorHandler(LazyLoad)}
            />

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
