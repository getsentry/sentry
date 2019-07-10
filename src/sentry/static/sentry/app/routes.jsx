import {Redirect, Route, IndexRoute, IndexRedirect} from 'react-router';
import React from 'react';

import App from 'app/views/app';
import HookOrDefault from 'app/components/hookOrDefault';
import HookStore from 'app/stores/hookStore';
import LazyLoad from 'app/components/lazyLoad';
import NewProject from 'app/views/projectInstall/newProject';
import OnboardingConfigure from 'app/views/onboarding/configure';
import OnboardingNewProject from 'app/views/onboarding/newProject';
import OnboardingWizard from 'app/views/onboarding/wizard';
import OrganizationContext from 'app/views/organizationContext';
import OrganizationCreate from 'app/views/organizationCreate';
import OrganizationDashboard from 'app/views/organizationProjectsDashboard';
import OrganizationDetails from 'app/views/organizationDetails';
import OrganizationRoot from 'app/views/organizationRoot';
import IssueListContainer from 'app/views/issueList/container';
import IssueListOverview from 'app/views/issueList/overview';
import ProjectEventRedirect from 'app/views/projectEventRedirect';
import ProjectGettingStarted from 'app/views/projectInstall/gettingStarted';
import ProjectInstallOverview from 'app/views/projectInstall/overview';
import ProjectInstallPlatform from 'app/views/projectInstall/platform';
import ProjectPluginDetails from 'app/views/projectPluginDetails';
import ProjectPlugins from 'app/views/projectPlugins';
import ProjectSettings from 'app/views/projectSettings';
import redirectDeprecatedProjectRoute from 'app/views/projects/redirectDeprecatedProjectRoute';
import RouteNotFound from 'app/views/routeNotFound';
import SettingsProjectProvider from 'app/views/settings/components/settingsProjectProvider';
import SettingsWrapper from 'app/views/settings/components/settingsWrapper';
import errorHandler from 'app/utils/errorHandler';

function appendTrailingSlash(nextState, replace) {
  const lastChar = nextState.location.pathname.slice(-1);
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

const hook = name => HookStore.get(name).map(cb => cb());

const OrganizationMembersView = HookOrDefault({
  hookName: 'component:org-members-view',
  defaultComponentPromise: () =>
    import(/* webpackChunkName: "OrganizationMembers" */ './views/settings/organizationMembers'),
});

const OnboardingNewProjectView = HookOrDefault({
  hookName: 'component:onboarding-new-project',
  defaultComponent: OnboardingNewProject,
});

function routes() {
  const accountSettingsRoutes = (
    <React.Fragment>
      <IndexRedirect to="details/" />

      <Route
        path="details/"
        name="Details"
        componentPromise={() =>
          import(/* webpackChunkName: "AccountDetails" */ './views/settings/account/accountDetails')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route path="notifications/" name="Notifications">
        <IndexRoute
          componentPromise={() =>
            import(/* webpackChunkName: "AccountNotifications" */ './views/settings/account/accountNotifications')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path=":fineTuneType/"
          name="Fine Tune Alerts"
          componentPromise={() =>
            import(/* webpackChunkName: "AccountNotificationsFineTuning" */ './views/settings/account/accountNotificationFineTuning')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route
        path="emails/"
        name="Emails"
        componentPromise={() =>
          import(/* webpackChunkName: "AccountEmails" */ './views/settings/account/accountEmails')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="authorizations/"
        componentPromise={() =>
          import(/* webpackChunkName: "AccountAuthorizations" */ './views/settings/account/accountAuthorizations')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route name="Security" path="security/">
        <Route
          componentPromise={() =>
            import(/* webpackChunkName: "AccountSecurityWrapper" */ './views/settings/account/accountSecurity/accountSecurityWrapper')
          }
          component={errorHandler(LazyLoad)}
        >
          <IndexRoute
            componentPromise={() =>
              import(/* webpackChunkName: "AccountSecurity" */ './views/settings/account/accountSecurity')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="session-history/"
            name="Session History"
            componentPromise={() =>
              import(/* webpackChunkName: "AccountSecuritySessionHistory" */ './views/settings/account/accountSecurity/accountSecuritySessionHistory')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="mfa/:authId/"
            name="Details"
            componentPromise={() =>
              import(/* webpackChunkName: "AccountSecurityDetails" */ './views/settings/account/accountSecurity/accountSecurityDetails')
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>

        <Route
          path="mfa/:authId/enroll/"
          name="Enroll"
          componentPromise={() =>
            import(/* webpackChunkName: "AccountSecurityEnroll" */ './views/settings/account/accountSecurity/accountSecurityEnroll')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Route
        path="subscriptions/"
        name="Subscriptions"
        componentPromise={() =>
          import(/* webpackChunkName: "AccountSubscriptions" */ './views/settings/account/accountSubscriptions')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="identities/"
        name="Identities"
        componentPromise={() =>
          import(/* webpackChunkName: "AccountSocialIdentities" */ './views/settings/account/accountIdentities')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route path="api/" name="API">
        <IndexRedirect to="auth-tokens/" />

        <Route path="auth-tokens/" name="Auth Tokens">
          <IndexRoute
            componentPromise={() =>
              import(/* webpackChunkName: "ApiTokensIndex" */ './views/settings/account/apiTokens')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="new-token/"
            name="Create New Token"
            componentPromise={() =>
              import(/* webpackChunkName: "ApiTokenCreate" */ './views/settings/account/apiNewToken')
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>

        <Route path="applications/" name="Applications">
          <IndexRoute
            componentPromise={() =>
              import(/* webpackChunkName: "ApiApplications" */ './views/settings/account/apiApplications')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path=":appId/"
            name="Details"
            componentPromise={() =>
              import(/* webpackChunkName: "ApiApplicationDetails" */ './views/settings/account/apiApplicationDetails')
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>
      </Route>

      <Route
        path="close-account/"
        name="Close Account"
        componentPromise={() =>
          import(/* webpackChunkName: "AccountClose" */ './views/settings/account/accountClose')
        }
        component={errorHandler(LazyLoad)}
      />
    </React.Fragment>
  );

  const projectSettingsRoutes = (
    <React.Fragment>
      <IndexRoute
        name="General"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectGeneralSettings" */ 'app/views/settings/projectGeneralSettings')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="teams/"
        name="Teams"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectTeams" */ './views/settings/project/projectTeams')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route name="Alerts" path="alerts/">
        <IndexRedirect to="rules/" />
        <Route
          path="settings/"
          name="Settings"
          component={errorHandler(LazyLoad)}
          componentPromise={() =>
            import(/* webpackChunkName: "ProjectAlertSettings" */ './views/settings/projectAlerts/projectAlertSettings')
          }
        />
        <Route path="rules/" name="Rules" component={null}>
          <IndexRoute
            component={errorHandler(LazyLoad)}
            componentPromise={() =>
              import(/* webpackChunkName: "ProjectAlertRules" */ './views/settings/projectAlerts/projectAlertRules')
            }
          />
          <Route
            path="new/"
            name="New"
            component={errorHandler(LazyLoad)}
            componentPromise={() =>
              import(/* webpackChunkName: "ProjectAlertRuleDetails" */ './views/settings/projectAlerts/projectAlertRuleDetails')
            }
          />
          <Route
            path=":ruleId/"
            name="Edit"
            componentPromise={() =>
              import(/* webpackChunkName: "ProjectAlertRuleDetails" */ './views/settings/projectAlerts/projectAlertRuleDetails')
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>
      </Route>
      <Route
        name="Environments"
        path="environments/"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectEnvironments" */ './views/settings/project/projectEnvironments')
        }
        component={errorHandler(LazyLoad)}
      >
        <IndexRoute />
        <Route path="hidden/" />
      </Route>
      <Route
        name="Tags"
        path="tags/"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectTags" */ './views/settings/projectTags')
        }
        component={errorHandler(LazyLoad)}
      />
      <Redirect from="issue-tracking/" to="/settings/:orgId/:projectId/plugins/" />
      <Route
        path="release-tracking/"
        name="Release Tracking"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectReleaseTracking" */ './views/settings/project/projectReleaseTracking')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="ownership/"
        name="Issue Owners"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectOwnership" */ './views/settings/project/projectOwnership')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="data-forwarding/"
        name="Data Forwarding"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectDataForwarding" */ './views/settings/projectDataForwarding')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="debug-symbols/"
        name="Debug Information Files"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectDebugFiles" */ './views/settings/projectDebugFiles')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="processing-issues/"
        name="Processing Issues"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectProcessingIssues" */ './views/settings/project/projectProcessingIssues')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="filters/"
        name="Inbound Filters"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectFilters" */ './views/settings/project/projectFilters')
        }
        component={errorHandler(LazyLoad)}
      >
        <IndexRedirect to="data-filters/" />
        <Route path=":filterType/" />
      </Route>
      <Route
        path="hooks/"
        name="Service Hooks"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectServiceHooks" */ './views/settings/project/projectServiceHooks')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="hooks/new/"
        name="Create Service Hook"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectCreateServiceHook" */ './views/settings/project/projectCreateServiceHook')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="hooks/:hookId/"
        name="Service Hook Details"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectServiceHookDetails" */ './views/settings/project/projectServiceHookDetails')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route path="keys/" name="Client Keys">
        <IndexRoute
          componentPromise={() =>
            import(/* webpackChunkName: "ProjectKeys" */ './views/settings/project/projectKeys')
          }
          component={errorHandler(LazyLoad)}
        />

        <Route
          path=":keyId/"
          name="Details"
          componentPromise={() =>
            import(/* webpackChunkName: "ProjectKeyDetails" */ './views/settings/project/projectKeys/projectKeyDetails')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route
        path="user-feedback/"
        name="User Feedback"
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectUserFeedbackSettings" */ './views/settings/project/projectUserFeedback')
        }
        component={errorHandler(LazyLoad)}
      />
      <Redirect from="csp/" to="security-headers/" />
      <Route path="security-headers/" name="Security Headers">
        <IndexRoute
          componentPromise={() =>
            import(/* webpackChunkName: "ProjectSecurityHeaders" */ './views/settings/projectSecurityHeaders')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="csp/"
          name="Content Security Policy"
          componentPromise={() =>
            import(/* webpackChunkName: "ProjectCspReports" */ './views/settings/projectSecurityHeaders/csp')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="expect-ct/"
          name="Certificate Transparency"
          componentPromise={() =>
            import(/* webpackChunkName: "ProjectExpectCtReports" */ './views/settings/projectSecurityHeaders/expectCt')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="hpkp/"
          name="HPKP"
          componentPromise={() =>
            import(/* webpackChunkName: "ProjectHpkpReports" */ './views/settings/projectSecurityHeaders/hpkp')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route path="plugins/" name="Legacy Integrations">
        <IndexRoute component={errorHandler(ProjectPlugins)} />
        <Route
          path=":pluginId/"
          name="Integration Details"
          component={errorHandler(ProjectPluginDetails)}
        />
      </Route>
      <Route path="install/" name="Configuration">
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
          import(/* webpackChunkName: "OrganizationGeneralSettings" */ './views/settings/organizationGeneralSettings')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="projects/"
        name="Projects"
        componentPromise={() =>
          import(/* webpackChunkName: "OrganizationProjects" */ './views/settings/organizationProjects')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route path="api-keys/" name="API Key">
        <IndexRoute
          componentPromise={() =>
            import(/* webpackChunkName: "OrganizationApiKeys" */ './views/settings/organizationApiKeys')
          }
          component={errorHandler(LazyLoad)}
        />

        <Route
          path=":apiKey/"
          name="Details"
          componentPromise={() =>
            import(/* webpackChunkName: "OrganizationApiKeyDetails" */ './views/settings/organizationApiKeys/organizationApiKeyDetails')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Route
        path="audit-log/"
        name="Audit Log"
        componentPromise={() =>
          import(/* webpackChunkName: "OrganizationAuditLog" */ './views/settings/organizationAuditLog')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="auth/"
        name="Auth Providers"
        componentPromise={() =>
          import(/* webpackChunkName: "OrganizationAuth" */ './views/settings/organizationAuth')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route path="members/" name="Members">
        <IndexRoute component={OrganizationMembersView} />

        <Route
          path="new/"
          name="Invite"
          componentPromise={() =>
            import(/* webpackChunkName: "InviteMember" */ './views/settings/organizationMembers/inviteMember')
          }
          component={errorHandler(LazyLoad)}
        />

        <Route
          path=":memberId/"
          name="Details"
          componentPromise={() =>
            import(/* webpackChunkName: "OrganizationMemberDetail" */ './views/settings/organizationMembers/organizationMemberDetail')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Route
        path="rate-limits/"
        name="Rate Limits"
        componentPromise={() =>
          import(/* webpackChunkName: "OrganizationRateLimits" */ './views/settings/organizationRateLimits')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="repos/"
        name="Repositories"
        componentPromise={() =>
          import(/* webpackChunkName: "OrganizationRepositories" */ './views/settings/organizationRepositories')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="settings/"
        componentPromise={() =>
          import(/* webpackChunkName: "OrganizationGeneralSettings" */ './views/settings/organizationGeneralSettings')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route name="Teams" path="teams/">
        <IndexRoute
          componentPromise={() =>
            import(/* webpackChunkName: "OrganizationTeams" */ './views/settings/organizationTeams')
          }
          component={errorHandler(LazyLoad)}
        />

        <Route
          name="Team"
          path=":teamId/"
          componentPromise={() =>
            import(/* webpackChunkName: "TeamDetails" */ './views/settings/organizationTeams/teamDetails')
          }
          component={errorHandler(LazyLoad)}
        >
          <IndexRedirect to="members/" />
          <Route
            path="members/"
            name="Members"
            componentPromise={() =>
              import(/* webpackChunkName: "TeamMembers" */ './views/settings/organizationTeams/teamMembers')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="projects/"
            name="Projects"
            componentPromise={() =>
              import(/* webpackChunkName: "TeamProjects" */ './views/settings/organizationTeams/teamProjects')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="settings/"
            name="settings"
            componentPromise={() =>
              import(/* webpackChunkName: "TeamSettings" */ './views/settings/organizationTeams/teamSettings')
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>
      </Route>

      <Route name="Integrations" path="integrations/">
        <IndexRoute
          componentPromise={() =>
            import(/* webpackChunkName: "OrganizationIntegrations" */ './views/organizationIntegrations')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="Configure Integration"
          path=":providerKey/:integrationId/"
          componentPromise={() =>
            import(/* webpackChunkName: "ConfigureIntegration" */ './views/settings/organizationIntegrations/configureIntegration')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route name="Developer Settings" path="developer-settings/">
        <IndexRoute
          componentPromise={() =>
            import(/* webpackChunkName: "OrganizationDeveloperSettings" */ './views/settings/organizationDeveloperSettings')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="New Integration"
          path="new/"
          componentPromise={() =>
            import(/* webpackChunkName: "sentryApplicationDetails" */ './views/settings/organizationDeveloperSettings/sentryApplicationDetails')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="Edit Integration"
          path=":appSlug/"
          componentPromise={() =>
            import(/* webpackChunkName: "sentryApplicationDetails" */ './views/settings/organizationDeveloperSettings/sentryApplicationDetails')
          }
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
          import(/* webpackChunkName: "AcceptProjectTransfer" */ 'app/views/acceptProjectTransfer')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="/extensions/external-install/:providerId/:installationId"
        componentPromise={() =>
          import(/* webpackChunkName: "AcceptProjectTransfer" */ 'app/views/integrationInstallation')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="/extensions/vsts/link/"
        getComponent={(_loc, cb) =>
          import(/* webpackChunkName: "VSTSOrganizationLink" */ './views/vstsOrganizationLink').then(
            lazyLoad(cb)
          )
        }
      />

      <Redirect from="/account/" to="/settings/account/details/" />

      <Route
        path="/manage/"
        componentPromise={() =>
          import(/* webpackChunkName: "AdminLayout" */ 'app/views/admin/adminLayout')
        }
        component={errorHandler(LazyLoad)}
      >
        <IndexRoute
          componentPromise={() =>
            import(/* webpackChunkName: "AdminOverview" */ 'app/views/admin/adminOverview')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="buffer/"
          componentPromise={() =>
            import(/* webpackChunkName: "AdminBuffer" */ 'app/views/admin/adminBuffer')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="relays/"
          componentPromise={() =>
            import(/* webpackChunkName: "AdminRelays" */ 'app/views/admin/adminRelays')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="organizations/"
          componentPromise={() =>
            import(/* webpackChunkName: "AdminOrganizations" */ 'app/views/admin/adminOrganizations')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="projects/"
          componentPromise={() =>
            import(/* webpackChunkName: "AdminProjects" */ 'app/views/admin/adminProjects')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="queue/"
          componentPromise={() =>
            import(/* webpackChunkName: "AdminQueue" */ 'app/views/admin/adminQueue')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="quotas/"
          componentPromise={() =>
            import(/* webpackChunkName: "AdminQuotas" */ 'app/views/admin/adminQuotas')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="settings/"
          componentPromise={() =>
            import(/* webpackChunkName: "AdminSettings" */ 'app/views/admin/adminSettings')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="users/"
          componentPromise={() =>
            import(/* webpackChunkName: "AdminUsers" */ 'app/views/admin/adminUsers')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="status/mail/"
          componentPromise={() =>
            import(/* webpackChunkName: "AdminMail" */ 'app/views/admin/adminMail')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="status/environment/"
          componentPromise={() =>
            import(/* webpackChunkName: "AdminEnvironment" */ 'app/views/admin/adminEnvironment')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="status/packages/"
          componentPromise={() =>
            import(/* webpackChunkName: "AdminPackages" */ 'app/views/admin/adminPackages')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="status/warnings/"
          componentPromise={() =>
            import(/* webpackChunkName: "AdminWarnings" */ 'app/views/admin/adminWarnings')
          }
          component={errorHandler(LazyLoad)}
        />
        {hook('routes:admin')}
      </Route>
      <Redirect from="/share/group/:shareId/" to="/share/issue/:shareId/" />
      <Route
        path="/share/issue/:shareId/"
        componentPromise={() =>
          import(/* webpackChunkName: "SharedGroupDetails" */ './views/sharedGroupDetails')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route path="/organizations/new/" component={errorHandler(OrganizationCreate)} />
      <Route path="/onboarding/:orgId/" component={errorHandler(OrganizationContext)}>
        {/* The current (old) version of the onboarding experience does not
            route to anything here. So even though this is new, the route can
            live where it will eventually live. */}
        <Route
          path=":step/"
          componentPromise={() =>
            import(/* webpackChunkName: "OnboardingWizardNew" */ './views/onboarding/wizardNew')
          }
          component={errorHandler(LazyLoad)}
        />
        {/* TODO(epurkhiser): Old style onboarding experience routes. To be removed in the future */}
        <Route component={errorHandler(OnboardingWizard)}>
          <IndexRoute component={errorHandler(OnboardingNewProjectView)} />
          <Route
            path=":projectId/configure/:platform/"
            component={errorHandler(OnboardingConfigure)}
          />
          {hook('routes:onboarding')}
        </Route>
      </Route>
      <Route component={errorHandler(OrganizationDetails)}>
        <Route path="/settings/" name="Settings" component={SettingsWrapper}>
          <IndexRoute
            getComponent={(_loc, cb) =>
              import(/* webpackChunkName: "SettingsIndex" */ './views/settings/settingsIndex').then(
                lazyLoad(cb)
              )
            }
          />

          <Route
            path="account/"
            name="Account"
            getComponent={(_loc, cb) =>
              import(/* webpackChunkName: "AccountSettingsLayout" */ './views/settings/account/accountSettingsLayout').then(
                lazyLoad(cb)
              )
            }
          >
            {accountSettingsRoutes}
          </Route>

          <Route name="Organization" path=":orgId/">
            <Route
              getComponent={(_loc, cb) =>
                import(/* webpackChunkName: "OrganizationSettingsLayout" */ './views/settings/organization/organizationSettingsLayout').then(
                  lazyLoad(cb)
                )
              }
            >
              {hook('routes:organization')}
              {orgSettingsRoutes}
            </Route>

            <Route
              name="Project"
              path="projects/:projectId/"
              getComponent={(_loc, cb) =>
                import(/* webpackChunkName: "ProjectSettingsLayout" */ './views/settings/project/projectSettingsLayout').then(
                  lazyLoad(cb)
                )
              }
            >
              <Route component={errorHandler(SettingsProjectProvider)}>
                {projectSettingsRoutes}
              </Route>
            </Route>

            <Redirect from=":projectId/" to="projects/:projectId/" />
            <Redirect from=":projectId/alerts/" to="projects/:projectId/alerts/" />
            <Redirect
              from=":projectId/alerts/rules/"
              to="projects/:projectId/alerts/rules/"
            />
            <Redirect
              from=":projectId/alerts/rules/:ruleId/"
              to="projects/:projectId/alerts/rules/:ruleId/"
            />
          </Route>
        </Route>
      </Route>
      <Route path="/:orgId/" component={errorHandler(OrganizationDetails)}>
        <Route component={errorHandler(OrganizationRoot)}>
          <IndexRoute component={errorHandler(OrganizationDashboard)} />
          {hook('routes:organization-root')}
          <Route
            path="/organizations/:orgId/projects/"
            component={errorHandler(OrganizationDashboard)}
          />
          <Route
            path="/organizations/:orgId/stats/"
            componentPromise={() =>
              import(/* webpackChunkName: "OrganizationStats" */ './views/organizationStats')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="/organizations/:orgId/activity/"
            componentPromise={() =>
              import(/* webpackChunkName: "OrganizationActivity" */ './views/organizationActivity')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="/organizations/:orgId/dashboards/"
            componentPromise={() =>
              import(/* webpackChunkName: "OrganizationDashboardContainer" */ './views/organizationDashboard')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(/* webpackChunkName: "OverviewDashboard" */ './views/organizationDashboard/overviewDashboard')
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/discover/"
            componentPromise={() =>
              import(/* webpackChunkName: "OrganizationDiscover" */ './views/organizationDiscover')
            }
            component={errorHandler(LazyLoad)}
          >
            <Redirect path="saved/" to="/organizations/:orgId/discover/" />
            <Route path="saved/:savedQueryId/" />
          </Route>
          <Route
            path="/organizations/:orgId/events/"
            componentPromise={() =>
              import(/* webpackChunkName: "OrganizationEventsContainer" */ './views/organizationEvents')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationEvents" */ './views/organizationEvents/events')
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/monitors/"
            componentPromise={() =>
              import(/* webpackChunkName: "OrganizationMonitorsContainer" */ './views/organizationMonitors')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationMonitors" */ './views/organizationMonitors/monitors')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/monitors/create/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationMonitorCreate" */ './views/organizationMonitors/create')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/monitors/:monitorId/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationMonitorDetails" */ './views/organizationMonitors/details')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/monitors/:monitorId/edit/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationMonitorEdit" */ './views/organizationMonitors/edit')
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/incidents/"
            componentPromise={() =>
              import(/* webpackChunkName: "OrganizationIncidentsContainer" */ './views/organizationIncidents')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationIncidents" */ './views/organizationIncidents/list')
              }
              component={errorHandler(LazyLoad)}
            />

            <Route
              path=":incidentId/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationIncidentDetails" */ './views/organizationIncidents/details')
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/projects/:projectId/getting-started/"
            component={errorHandler(ProjectGettingStarted)}
          >
            <IndexRoute component={errorHandler(ProjectInstallOverview)} />
            <Route path=":platform/" component={errorHandler(ProjectInstallPlatform)} />
          </Route>
          <Route
            path="/organizations/:orgId/projects/:projectId/events/:eventId/"
            component={errorHandler(ProjectEventRedirect)}
          />
          <Route
            path="/organizations/:orgId/issues/"
            component={errorHandler(IssueListContainer)}
          >
            <Redirect from="/organizations/:orgId/" to="/organizations/:orgId/issues/" />
            <IndexRoute component={errorHandler(IssueListOverview)} />
            <Route
              path="searches/:searchId/"
              component={errorHandler(IssueListOverview)}
            />
          </Route>
          {/* Once org issues is complete, these routes can be nested under
          /organizations/:orgId/issues */}
          <Route
            path="/organizations/:orgId/issues/:groupId/"
            componentPromise={() =>
              import(/* webpackChunkName: "OrganizationGroupDetails" */ './views/organizationGroupDetails')
            }
            component={errorHandler(LazyLoad)}
          >
            {/* XXX: if we change the path for group details, we *must* update `OrganizationContext`.
            There is behavior that depends on this path and unfortunately no great way to test for this contract */}
            <IndexRoute
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationGroupEventDetails" */ './views/organizationGroupDetails/groupEventDetails')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/activity/"
              componentPromise={() =>
                import(/* webpackChunkName: "GroupActivity" */ './views/organizationGroupDetails/groupActivity')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/events/:eventId/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationGroupEventDetails" */ './views/organizationGroupDetails/groupEventDetails')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/events/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationGroupEvents" */ './views/organizationGroupDetails/groupEvents')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/tags/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationGroupTags" */ './views/organizationGroupDetails/groupTags')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/tags/:tagKey/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationGroupTagsValues" */ './views/organizationGroupDetails/groupTagValues')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/feedback/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationGroupUserFeedback" */ './views/organizationGroupDetails/groupUserFeedback')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/similar/"
              componentPromise={() =>
                import(/* webpackChunkName: "GroupSimilarView" */ './views/organizationGroupDetails/groupSimilar')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/merged/"
              componentPromise={() =>
                import(/* webpackChunkName: "GroupSimilarView" */ './views/organizationGroupDetails/groupMerged')
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/user-feedback/"
            componentPromise={() =>
              import(/* webpackChunkName: "OrganizationUserFeedback" */ './views/userFeedback/organizationUserFeedback')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="/organizations/:orgId/releases/"
            componentPromise={() =>
              import(/* webpackChunkName: "OrganizationReleases" */ './views/organizationReleases/list')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="/organizations/:orgId/releases/:version/"
            componentPromise={() =>
              import(/*webpackChunkName: "OrganizationReleaseDetail"*/ './views/organizationReleases/detail')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(/*webpackChunkName: "OrganizationReleaseOverview"*/ './views/organizationReleases/detail/releaseOverview')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="new-events/"
              componentPromise={() =>
                import(/*webpackChunkName: "OrganizationReleaseNewEvents"*/ './views/organizationReleases/detail/releaseNewEvents')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="all-events/"
              componentPromise={() =>
                import(/*webpackChunkName: "OrganizationReleaseAllEvents"*/ './views/organizationReleases/detail/releaseAllEvents')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="artifacts/"
              componentPromise={() =>
                import(/*webpackChunkName: "ReleaseArtifacts"*/ './views/organizationReleases/detail/releaseArtifacts')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="commits/"
              componentPromise={() =>
                import(/*webpackChunkName: "ReleaseCommits"*/ './views/organizationReleases/detail/releaseCommits')
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/teams/new/"
            componentPromise={() =>
              import(/* webpackChunkName: "TeamCreate" */ './views/teamCreate')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route path="/organizations/:orgId/">
            <Redirect from="/organizations/:orgId/projects/" to="/:orgId/" />
            {hook('routes:organization')}
            <Redirect path="/organizations/:orgId/teams/" to="/settings/:orgId/teams/" />
            <Redirect
              path="/organizations/:orgId/teams/your-teams/"
              to="/settings/:orgId/teams/"
            />
            <Redirect
              path="/organizations/:orgId/teams/all-teams/"
              to="/settings/:orgId/teams/"
            />
            <Redirect
              path="/organizations/:orgId/teams/:teamId/"
              to="/settings/:orgId/teams/:teamId/"
            />
            <Redirect
              path="/organizations/:orgId/teams/:teamId/members/"
              to="/settings/:orgId/teams/:teamId/members/"
            />
            <Redirect
              path="/organizations/:orgId/teams/:teamId/projects/"
              to="/settings/:orgId/teams/:teamId/projects/"
            />
            <Redirect
              path="/organizations/:orgId/teams/:teamId/settings/"
              to="/settings/:orgId/teams/:teamId/settings/"
            />
            <Redirect path="/organizations/:orgId/settings/" to="/settings/:orgId/" />
            <Redirect
              path="/organizations/:orgId/api-keys/"
              to="/settings/:orgId/api-keys/"
            />
            <Redirect
              path="/organizations/:orgId/api-keys/:apiKey/"
              to="/settings/:orgId/api-keys/:apiKey/"
            />
            <Redirect
              path="/organizations/:orgId/members/"
              to="/settings/:orgId/members/"
            />
            <Redirect
              path="/organizations/:orgId/members/new/"
              to="/settings/:orgId/members/new/"
            />
            <Redirect
              path="/organizations/:orgId/members/:memberId/"
              to="/settings/:orgId/members/:memberId/"
            />
            <Redirect
              path="/organizations/:orgId/rate-limits/"
              to="/settings/:orgId/rate-limits/"
            />
            <Redirect path="/organizations/:orgId/repos/" to="/settings/:orgId/repos/" />
          </Route>
          <Route
            path="/organizations/:orgId/projects/new/"
            component={errorHandler(NewProject)}
          />
          <Route
            path="/organizations/:orgId/projects/choose/"
            componentPromise={() =>
              import(/* webpackChunkName: "ProjectChooser" */ './views/projectChooser')
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>
        <Route
          path=":projectId/getting-started/"
          component={errorHandler(ProjectGettingStarted)}
        >
          <IndexRoute component={errorHandler(ProjectInstallOverview)} />
          <Route path=":platform/" component={errorHandler(ProjectInstallPlatform)} />
        </Route>
        <Route path=":projectId/">
          {/* Support for deprecated URLs (pre-Sentry 10). We just redirect users to new canonical URLs. */}
          <IndexRoute
            component={errorHandler(
              redirectDeprecatedProjectRoute(
                ({orgId, projectId}) =>
                  `/organizations/${orgId}/issues/?project=${projectId}`
              )
            )}
          />
          <Route
            path="issues/"
            component={errorHandler(
              redirectDeprecatedProjectRoute(
                ({orgId, projectId}) =>
                  `/organizations/${orgId}/issues/?project=${projectId}`
              )
            )}
          />
          <Redirect from="dashboard/" to="/organizations/:orgId/dashboards/" />
          <Route
            path="releases/"
            component={errorHandler(
              redirectDeprecatedProjectRoute(
                ({orgId, projectId}) =>
                  `/organizations/${orgId}/releases/?project=${projectId}`
              )
            )}
          />
          <Route
            path="releases/:version/"
            component={errorHandler(
              redirectDeprecatedProjectRoute(
                ({orgId, projectId, router}) =>
                  `/organizations/${orgId}/releases/${
                    router.params.version
                  }/?project=${projectId}`
              )
            )}
          />
          <Route
            path="releases/:version/new-events/"
            component={errorHandler(
              redirectDeprecatedProjectRoute(
                ({orgId, projectId, router}) =>
                  `/organizations/${orgId}/releases/${
                    router.params.version
                  }/new-events/?project=${projectId}`
              )
            )}
          />
          <Route
            path="releases/:version/all-events/"
            component={errorHandler(
              redirectDeprecatedProjectRoute(
                ({orgId, projectId, router}) =>
                  `/organizations/${orgId}/releases/${
                    router.params.version
                  }/all-events/?project=${projectId}`
              )
            )}
          />
          <Route
            path="releases/:version/artifacts/"
            component={errorHandler(
              redirectDeprecatedProjectRoute(
                ({orgId, projectId, router}) =>
                  `/organizations/${orgId}/releases/${
                    router.params.version
                  }/artifacts/?project=${projectId}`
              )
            )}
          />
          <Route
            path="releases/:version/commits/"
            component={errorHandler(
              redirectDeprecatedProjectRoute(
                ({orgId, projectId, router}) =>
                  `/organizations/${orgId}/releases/${
                    router.params.version
                  }/commits/?project=${projectId}`
              )
            )}
          />
          <Route
            path="user-feedback/"
            component={errorHandler(
              redirectDeprecatedProjectRoute(
                ({orgId, projectId}) =>
                  `/organizations/${orgId}/user-feedback/?project=${projectId}`
              )
            )}
          />
        </Route>
        <Route path=":projectId/settings/" component={errorHandler(ProjectSettings)}>
          <Redirect from="teams/" to="/settings/:orgId/projects/:projectId/teams/" />
          <Redirect from="alerts/" to="/settings/:orgId/projects/:projectId/alerts/" />
          <Redirect
            from="alerts/rules/"
            to="/settings/:orgId/projects/:projectId/alerts/rules/"
          />
          <Redirect
            from="alerts/rules/new/"
            to="/settings/:orgId/projects/:projectId/alerts/rules/new/"
          />
          <Redirect
            from="alerts/rules/:ruleId/"
            to="/settings/:orgId/projects/:projectId/alerts/rules/:ruleId/"
          />
          <Redirect
            from="environments/"
            to="/settings/:orgId/projects/:projectId/environments/"
          />
          <Redirect
            from="environments/hidden/"
            to="/settings/:orgId/projects/:projectId/environments/hidden/"
          />
          <Redirect
            from="tags/"
            to="/settings/projects/:orgId/projects/:projectId/tags/"
          />
          <Redirect
            from="issue-tracking/"
            to="/settings/:orgId/projects/:projectId/issue-tracking/"
          />
          <Redirect
            from="release-tracking/"
            to="/settings/:orgId/projects/:projectId/release-tracking/"
          />
          <Redirect
            from="ownership/"
            to="/settings/:orgId/projects/:projectId/ownership/"
          />
          <Redirect
            from="data-forwarding/"
            to="/settings/:orgId/projects/:projectId/data-forwarding/"
          />
          <Redirect
            from="debug-symbols/"
            to="/settings/:orgId/projects/:projectId/debug-symbols/"
          />
          <Redirect
            from="processing-issues/"
            to="/settings/:orgId/projects/:projectId/processing-issues/"
          />
          <Redirect from="filters/" to="/settings/:orgId/projects/:projectId/filters/" />
          <Redirect from="hooks/" to="/settings/:orgId/projects/:projectId/hooks/" />
          <Redirect from="keys/" to="/settings/:orgId/projects/:projectId/keys/" />
          <Redirect
            from="keys/:keyId/"
            to="/settings/:orgId/projects/:projectId/keys/:keyId/"
          />
          <Redirect
            from="user-feedback/"
            to="/settings/:orgId/projects/:projectId/user-feedback/"
          />
          <Redirect
            from="security-headers/"
            to="/settings/:orgId/projects/:projectId/security-headers/"
          />
          <Redirect
            from="security-headers/csp/"
            to="/settings/:orgId/projects/:projectId/security-headers/csp/"
          />
          <Redirect
            from="security-headers/expect-ct/"
            to="/settings/:orgId/projects/:projectId/security-headers/expect-ct/"
          />
          <Redirect
            from="security-headers/hpkp/"
            to="/settings/:orgId/projects/:projectId/security-headers/hpkp/"
          />
          <Redirect from="plugins/" to="/settings/:orgId/projects/:projectId/plugins/" />
          <Redirect
            from="plugins/:pluginId/"
            to="/settings/:orgId/projects/:projectId/plugins/:pluginId/"
          />
          <Redirect
            from="integrations/:providerKey/"
            to="/settings/:orgId/projects/:projectId/integrations/:providerKey/"
          />
          <Redirect from="install/" to="/settings/:orgId/projects/:projectId/install/" />
          <Redirect
            from="install/:platform'"
            to="/settings/:orgId/projects/:projectId/install/:platform/"
          />
          {projectSettingsRoutes}
        </Route>
        <Redirect from=":projectId/group/:groupId/" to="issues/:groupId/" />
        <Redirect
          from=":projectId/issues/:groupId/"
          to="/organizations/:orgId/issues/:groupId/"
        />
        <Redirect
          from=":projectId/issues/:groupId/events/"
          to="/organizations/:orgId/issues/:groupId/events/"
        />
        <Redirect
          from=":projectId/issues/:groupId/events/:eventId/"
          to="/organizations/:orgId/issues/:groupId/events/:eventId/"
        />
        <Redirect
          from=":projectId/issues/:groupId/tags/"
          to="/organizations/:orgId/issues/:groupId/tags/"
        />
        <Redirect
          from=":projectId/issues/:groupId/tags/:tagKey/"
          to="/organizations/:orgId/issues/:groupId/tags/:tagKey/"
        />
        <Redirect
          from=":projectId/issues/:groupId/feedback/"
          to="/organizations/:orgId/issues/:groupId/feedback/"
        />
        <Redirect
          from=":projectId/issues/:groupId/similar/"
          to="/organizations/:orgId/issues/:groupId/similar/"
        />
        <Redirect
          from=":projectId/issues/:groupId/merged/"
          to="/organizations/:orgId/issues/:groupId/merged/"
        />
        <Route
          path=":projectId/events/:eventId/"
          component={errorHandler(ProjectEventRedirect)}
        />
      </Route>
      {hook('routes')}
      <Route
        path="*"
        component={errorHandler(RouteNotFound)}
        onEnter={appendTrailingSlash}
      />
    </Route>
  );
}

export default routes;
