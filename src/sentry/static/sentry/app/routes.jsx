import {Redirect, Route, IndexRoute, IndexRedirect} from 'react-router';
import React from 'react';

import App from 'app/views/app';
import CreateProject from 'app/views/onboarding/createProject';
import GroupDetails from 'app/views/groupDetails';
import GroupEvents from 'app/views/groupEvents';
import GroupEventDetails from 'app/views/groupEventDetails';
import GroupMergedView from 'app/views/groupMerged/groupMergedView';
import GroupSimilarView from 'app/views/groupSimilar/groupSimilarView';
import GroupTagValues from 'app/views/groupTagValues';
import GroupTags from 'app/views/groupTags';
import GroupUserFeedback from 'app/views/groupUserFeedback';
import HookOrDefault from 'app/components/hookOrDefault';
import HookStore from 'app/stores/hookStore';
import LazyLoad from 'app/components/lazyLoad';
import MyIssuesAssignedToMe from 'app/views/myIssues/assignedToMe';
import MyIssuesBookmarked from 'app/views/myIssues/bookmarked';
import MyIssuesViewed from 'app/views/myIssues/viewed';
import NewProject from 'app/views/projectInstall/newProject';
import OnboardingConfigure from 'app/views/onboarding/configure/index';
import OnboardingWizard from 'app/views/onboarding/index';
import OrganizationActivity from 'app/views/organizationActivity';
import OrganizationAuth from 'app/views/settings/organizationAuth/index';
import OrganizationContext from 'app/views/organizationContext';
import OrganizationCreate from 'app/views/organizationCreate';
import OrganizationDashboard from 'app/views/organizationDashboard';
import OrganizationDetails from 'app/views/organizationDetails';
import OrganizationHomeContainer from 'app/components/organizations/homeContainer';
import OrganizationMembers from 'app/views/settings/organizationMembers';
import OrganizationRoot from 'app/views/organizationRoot';
import OrganizationStats from 'app/views/organizationStats';
import ProjectEnvironments from 'app/views/projectEnvironments';
import ProjectTags from 'app/views/projectTags';
import ProjectChooser from 'app/views/projectChooser';
import ProjectDashboard from 'app/views/projectDashboard';
import ProjectDataForwarding from 'app/views/projectDataForwarding';
import ProjectDebugSymbols from 'app/views/projectDebugSymbols';
import ProjectDetails from 'app/views/projectDetails';
import ProjectDocsContext from 'app/views/projectInstall/docsContext';
import ProjectEvents from 'app/views/projectEvents';
import ProjectGettingStarted from 'app/views/projectInstall/gettingStarted';
import ProjectInstallOverview from 'app/views/projectInstall/overview';
import ProjectInstallPlatform from 'app/views/projectInstall/platform';
import ProjectReleases from 'app/views/projectReleases';
import ProjectSavedSearches from 'app/views/projectSavedSearches';
import ProjectSettings from 'app/views/projectSettings';
import ProjectUserFeedback from 'app/views/projectUserFeedback';
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
        <Route
          componentPromise={() =>
            import(/*webpackChunkName: "AccountSecurityWrapper"*/ './views/settings/account/accountSecurity/accountSecurityWrapper')}
          component={errorHandler(LazyLoad)}
        >
          <IndexRoute
            componentPromise={() =>
              import(/*webpackChunkName: "AccountSecurity"*/ './views/settings/account/accountSecurity/index')}
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="session-history/"
            name="Session History"
            componentPromise={() =>
              import(/*webpackChunkName: "AccountSecuritySessionHistory"*/ './views/settings/account/accountSecurity/accountSecuritySessionHistory')}
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="mfa/:authId/"
            name="Details"
            componentPromise={() =>
              import(/*webpackChunkName: "AccountSecurityDetails"*/ './views/settings/account/accountSecurity/accountSecurityDetails')}
            component={errorHandler(LazyLoad)}
          />
        </Route>

        <Route
          path="mfa/:authId/enroll/"
          name="Enroll"
          componentPromise={() =>
            import(/*webpackChunkName: "AccountSecurityEnroll"*/ './views/settings/account/accountSecurity/accountSecurityEnroll')}
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
      <IndexRoute
        name="General"
        componentPromise={() =>
          import(/*webpackChunkName: "ProjectGeneralSettings"*/ 'app/views/settings/projectGeneralSettings')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="teams/"
        name="Teams"
        componentPromise={() =>
          import(/*webpackChunkName: "ProjectTeams"*/ './views/settings/project/projectTeams')}
        component={errorHandler(LazyLoad)}
      />
      <Route name="Alerts" path="alerts/">
        <IndexRoute
          component={errorHandler(LazyLoad)}
          componentPromise={() =>
            import(/*webpackChunkName: "ProjectAlertSettings"*/ './views/settings/projectAlerts/projectAlertSettings')}
        />
        <Route path="rules/" name="Rules" component={null}>
          <IndexRoute
            component={errorHandler(LazyLoad)}
            componentPromise={() =>
              import(/*webpackChunkName: "ProjectAlertRules"*/ './views/settings/projectAlerts/projectAlertRules')}
          />
          <Route
            path="new/"
            name="New"
            component={errorHandler(LazyLoad)}
            componentPromise={() =>
              import(/*webpackChunkName: "ProjectAlertRuleDetails"*/ './views/settings/projectAlerts/projectAlertRuleDetails')}
          />
          <Route
            path=":ruleId/"
            name="Edit"
            componentPromise={() =>
              import(/*webpackChunkName: "ProjectAlertRuleDetails"*/ './views/settings/projectAlerts/projectAlertRuleDetails')}
            component={errorHandler(LazyLoad)}
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
      <Redirect from="issue-tracking/" to="/settings/:orgId/:projectId/plugins/" />
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
        path="hooks/"
        name="Service Hooks"
        componentPromise={() =>
          import(/*webpackChunkName: "ProjectServiceHooks"*/ './views/settings/project/projectServiceHooks')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="hooks/new/"
        name="Create Service Hook"
        componentPromise={() =>
          import(/*webpackChunkName: "ProjectCreateServiceHook"*/ './views/settings/project/projectCreateServiceHook')}
        component={errorHandler(LazyLoad)}
      />
      <Route
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
      <Route path="security-headers/" name="Security Headers">
        <IndexRoute
          componentPromise={() =>
            import(/*webpackChunkName: "ProjectSecurityHeaders"*/ './views/settings/projectSecurityHeaders')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="csp/"
          name="Content Security Policy"
          componentPromise={() =>
            import(/*webpackChunkName: "ProjectCspReports"*/ './views/settings/projectSecurityHeaders/csp')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="expect-ct/"
          name="Certificate Transparency"
          componentPromise={() =>
            import(/*webpackChunkName: "ProjectExpectCtReports"*/ './views/settings/projectSecurityHeaders/expectCt')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="hpkp/"
          name="HPKP"
          componentPromise={() =>
            import(/*webpackChunkName: "ProjectHpkpReports"*/ './views/settings/projectSecurityHeaders/hpkp')}
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route path="plugins/" name="Integrations">
        <IndexRoute component={errorHandler(ProjectPlugins)} />
        <Route
          path=":pluginId/"
          name="Integration Details"
          component={errorHandler(ProjectPluginDetails)}
        />
      </Route>
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

  // This is declared in the routes() function because some routes need the
  // hook store which is not available at import time.
  const orgSettingsRoutes = (
    <React.Fragment>
      <IndexRoute
        name="General"
        componentPromise={() =>
          import(/*webpackChunkName: OrganizationGeneralSettings*/ './views/settings/organizationGeneralSettings')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="projects/"
        name="Projects"
        componentPromise={() =>
          import(/*webpackChunkName: OrganizationProjects*/ './views/settings/organizationProjects')}
        component={errorHandler(LazyLoad)}
      />

      <Route path="api-keys/" name="API Key">
        <IndexRoute
          componentPromise={() =>
            import(/*webpackChunkName: OrganizationApiKeys*/ './views/settings/organizationApiKeys')}
          component={errorHandler(LazyLoad)}
        />

        <Route
          path=":apiKey/"
          name="Details"
          componentPromise={() =>
            import(/*webpackChunkName: OrganizationApiKeyDetails*/ './views/settings/organizationApiKeys/organizationApiKeyDetails')}
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Route
        path="audit-log/"
        name="Audit Log"
        componentPromise={() =>
          import(/*webpackChunkName: OrganizationAuditLog*/ './views/settings/organizationAuditLog')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="auth/"
        name="Auth Providers"
        component={HookOrDefault({
          hookName: 'component:org-auth-view',
          defaultComponent: OrganizationAuth,
        })}
      />

      <Route path="members/" name="Members">
        <IndexRoute
          component={
            HookStore.get('component:org-members-view').length
              ? HookStore.get('component:org-members-view')[0]()
              : OrganizationMembers
          }
        />

        <Route
          path="new/"
          name="Invite"
          componentPromise={() =>
            import(/*webpackChunkName: InviteMember*/ './views/settings/organizationMembers/inviteMember')}
          component={errorHandler(LazyLoad)}
        />

        <Route
          path=":memberId/"
          name="Details"
          componentPromise={() =>
            import(/*webpackChunkName: OrganizationMemberDetail*/ './views/settings/organizationMembers/organizationMemberDetail')}
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Route
        path="rate-limits/"
        name="Rate Limits"
        componentPromise={() =>
          import(/*webpackChunkName: OrganizationRateLimits*/ './views/settings/organizationRateLimits')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="repos/"
        name="Repositories"
        componentPromise={() =>
          import(/*webpackChunkName: OrganizationRepositories*/ './views/settings/organizationRepositories')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="settings/"
        componentPromise={() =>
          import(/*webpackChunkName: OrganizationGeneralSettings*/ './views/settings/organizationGeneralSettings')}
        component={errorHandler(LazyLoad)}
      />

      <Route name="Teams" path="teams/">
        <IndexRoute
          componentPromise={() =>
            import(/*webpackChunkName: OrganizationTeams*/ './views/settings/organizationTeams')}
          component={errorHandler(LazyLoad)}
        />

        <Route
          name="Team"
          path=":teamId/"
          componentPromise={() =>
            import(/*webpackChunkName: TeamDetails*/ './views/settings/organizationTeams/teamDetails')}
          component={errorHandler(LazyLoad)}
        >
          <IndexRedirect to="members/" />
          <Route
            path="members/"
            name="Members"
            componentPromise={() =>
              import(/*webpackChunkName: TeamMembers*/ './views/settings/organizationTeams/teamMembers')}
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="projects/"
            name="Projects"
            componentPromise={() =>
              import(/*webpackChunkName: TeamProjects*/ './views/settings/organizationTeams/teamProjects')}
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="settings/"
            name="settings"
            componentPromise={() =>
              import(/*webpackChunkName: TeamSettings*/ './views/settings/organizationTeams/teamSettings')}
            component={errorHandler(LazyLoad)}
          />
        </Route>
      </Route>

      <Route name="Integrations" path="integrations/">
        <IndexRoute
          componentPromise={() =>
            import(/*webpackChunkName: OrganizationIntegrations*/ './views/organizationIntegrations')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="Configure Integration"
          path=":providerKey/:integrationId/"
          componentPromise={() =>
            import(/*webpackChunkName: ConfigureIntegration*/ './views/settings/organizationIntegrations/configureIntegration')}
          component={errorHandler(LazyLoad)}
        />
      </Route>
    </React.Fragment>
  );

  return (
    <Route path="/" component={errorHandler(App)}>
      <Route
        path="/accept-transfer/"
        componentPromise={() =>
          import(/*webpackChunkName:"AcceptProjectTransfer"*/ 'app/views/acceptProjectTransfer')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="/extensions/vsts/link/"
        getComponent={(loc, cb) =>
          import(/*webpackChunkName: "VSTSOrganizationLink" */ './views/vstsOrganizationLink').then(
            lazyLoad(cb)
          )}
      />

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

      <Route
        path="/manage/"
        componentPromise={() =>
          import(/*webpackChunkName:"AdminLayout"*/ 'app/views/admin/adminLayout')}
        component={errorHandler(LazyLoad)}
      >
        <IndexRoute
          componentPromise={() =>
            import(/*webpackChunkName:"AdminOverview"*/ 'app/views/admin/adminOverview')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="buffer/"
          componentPromise={() =>
            import(/*webpackChunkName:"AdminBuffer"*/ 'app/views/admin/adminBuffer')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="relays/"
          componentPromise={() =>
            import(/*webpackChunkName:"AdminRelays"*/ 'app/views/admin/adminRelays')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="organizations/"
          componentPromise={() =>
            import(/*webpackChunkName:"AdminOrganizations"*/ 'app/views/admin/adminOrganizations')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="projects/"
          componentPromise={() =>
            import(/*webpackChunkName:"AdminProjects"*/ 'app/views/admin/adminProjects')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="queue/"
          componentPromise={() =>
            import(/*webpackChunkName:"AdminQueue"*/ 'app/views/admin/adminQueue')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="quotas/"
          componentPromise={() =>
            import(/*webpackChunkName:"AdminQuotas"*/ 'app/views/admin/adminQuotas')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="settings/"
          componentPromise={() =>
            import(/*webpackChunkName:"AdminSettings"*/ 'app/views/admin/adminSettings')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="users/"
          componentPromise={() =>
            import(/*webpackChunkName:"AdminUsers"*/ 'app/views/admin/adminUsers')}
          component={errorHandler(LazyLoad)}
        />
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
            path="/organizations/:orgId/discover/"
            componentPromise={() =>
              import(/*webpackChunkName:"OrganizationDiscover"*/ './views/organizationDiscover/index')}
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="/organizations/:orgId/activity/"
            component={errorHandler(OrganizationActivity)}
          />

          <Route
            path="/organizations/:orgId/health/"
            componentPromise={() =>
              import(/*webpackChunkName: OrganizationHealth*/ './views/organizationHealth')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(/*webpackChunkName: HealthOverview*/ './views/organizationHealth/overview')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="errors"
              componentPromise={() =>
                import(/*webpackChunkName: HealthErrors*/ './views/organizationHealth/errors')}
              component={errorHandler(LazyLoad)}
            />

            <Route
              path="transactions"
              componentPromise={() =>
                import(/*webpackChunkName: HealthTransactions*/ './views/organizationHealth/transactions')}
              component={errorHandler(LazyLoad)}
            />

            <Route
              path="browsers"
              componentPromise={() =>
                import(/*webpackChunkName: HealthBrowsers*/ './views/organizationHealth/browsers')}
              component={errorHandler(LazyLoad)}
            />

            <Route
              path="devices"
              componentPromise={() =>
                import(/*webpackChunkName: HealthDevices*/ './views/organizationHealth/devices')}
              component={errorHandler(LazyLoad)}
            />
          </Route>

          <Route
            path="/organizations/:orgId/teams/new/"
            componentPromise={() =>
              import(/*webpackChunkName:"TeamCreate"*/ './views/teamCreate')}
            component={errorHandler(LazyLoad)}
          />

          <Route path="/organizations/:orgId/" component={OrganizationHomeContainer}>
            <Redirect from="projects/" to="/:orgId/" />
            {hooksOrgRoutes}
            <Redirect path="teams/" to="/settings/:orgId/teams/" />
            <Redirect path="teams/your-teams/" to="/settings/:orgId/teams/" />
            <Redirect path="teams/all-teams/" to="/settings/:orgId/teams/" />
            <Redirect path="teams/:teamId/" to="/settings/:orgId/teams/:teamId/" />
            <Redirect
              path="teams/:teamId/members/"
              to="/settings/:orgId/teams/:teamId/members/"
            />
            <Redirect
              path="teams/:teamId/projects/"
              to="/settings/:orgId/teams/:teamId/projects/"
            />
            <Redirect
              path="teams/:teamId/settings/"
              to="/settings/:orgId/teams/:teamId/settings/"
            />
            <Redirect path="settings/" to="/settings/:orgId/" />
            <Redirect path="api-keys/" to="/settings/:orgId/api-keys/" />
            <Redirect path="api-keys/:apiKey/" to="/settings/:orgId/api-keys/:apiKey/" />
            <Redirect path="members/" to="/settings/:orgId/members/" />
            <Redirect path="members/new/" to="/settings/:orgId/members/new/" />
            <Redirect
              path="members/:memberId/"
              to="/settings/:orgId/members/:memberId/"
            />
            <Redirect path="rate-limits/" to="/settings/:orgId/rate-limits/" />
            <Redirect path="repos/" to="/settings/:orgId/repos/" />
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
          <Route path="user-feedback/" component={errorHandler(ProjectUserFeedback)} />

          <Route path="settings/" component={errorHandler(ProjectSettings)}>
            <Redirect from="teams/" to="/settings/:orgId/:projectId/teams/" />
            <Redirect from="alerts/" to="/settings/:orgId/:projectId/alerts/" />
            <Redirect
              from="alerts/rules/"
              to="/settings/:orgId/:projectId/alerts/rules/"
            />
            <Redirect
              from="alerts/rules/new/"
              to="/settings/:orgId/:projectId/alerts/rules/new/"
            />
            <Redirect
              from="alerts/rules/:ruleId/"
              to="/settings/:orgId/:projectId/alerts/rules/:ruleId/"
            />
            <Redirect
              from="environments/"
              to="/settings/:orgId/:projectId/environments/"
            />
            <Redirect
              from="environments/hidden/"
              to="/settings/:orgId/:projectId/environments/hidden/"
            />
            <Redirect from="tags/" to="/settings/:orgId/:projectId/tags/" />
            <Redirect
              from="issue-tracking/"
              to="/settings/:orgId/:projectId/issue-tracking/"
            />
            <Redirect
              from="release-tracking/"
              to="/settings/:orgId/:projectId/release-tracking/"
            />
            <Redirect from="ownership/" to="/settings/:orgId/:projectId/ownership/" />
            <Redirect
              from="data-forwarding/"
              to="/settings/:orgId/:projectId/data-forwarding/"
            />
            <Redirect
              from="saved-searches/"
              to="/settings/:orgId/:projectId/saved-searches/"
            />
            <Redirect
              from="debug-symbols/"
              to="/settings/:orgId/:projectId/debug-symbols/"
            />
            <Redirect
              from="processing-issues/"
              to="/settings/:orgId/:projectId/processing-issues/"
            />
            <Redirect from="filters/" to="/settings/:orgId/:projectId/filters/" />
            <Redirect from="hooks/" to="/settings/:orgId/:projectId/hooks/" />
            <Redirect from="keys/" to="/settings/:orgId/:projectId/keys/" />
            <Redirect from="keys/:keyId/" to="/settings/:orgId/:projectId/keys/:keyId/" />
            <Redirect
              from="user-feedback/"
              to="/settings/:orgId/:projectId/user-feedback/"
            />
            <Redirect
              from="security-headers/"
              to="/settings/:orgId/:projectId/security-headers/"
            />
            <Redirect
              from="security-headers/csp/"
              to="/settings/:orgId/:projectId/security-headers/csp/"
            />
            <Redirect
              from="security-headers/expect-ct/"
              to="/settings/:orgId/:projectId/security-headers/expect-ct/"
            />
            <Redirect
              from="security-headers/hpkp/"
              to="/settings/:orgId/:projectId/security-headers/hpkp/"
            />
            <Redirect from="plugins/" to="/settings/:orgId/:projectId/plugins/" />
            <Redirect
              from="plugins/:pluginId/"
              to="/settings/:orgId/:projectId/plugins/:pluginId/"
            />
            <Redirect
              from="integrations/:providerKey/"
              to="/settings/:orgId/:projectId/integrations/:providerKey/"
            />
            <Redirect from="install/" to="/settings/:orgId/:projectId/install/" />
            <Redirect
              from="install/:platform'"
              to="/settings/:orgId/:projectId/install/:platform/"
            />
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
            <Route path="feedback/" component={errorHandler(GroupUserFeedback)} />
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
