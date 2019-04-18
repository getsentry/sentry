import {Redirect, Route, IndexRoute, IndexRedirect} from 'react-router';
import React from 'react';

import App from 'app/views/app';
import HookOrDefault from 'app/components/hookOrDefault';
import HookStore from 'app/stores/hookStore';
import LazyLoad from 'app/components/lazyLoad';
import MyIssuesAssignedToMe from 'app/views/myIssues/assignedToMe';
import MyIssuesBookmarked from 'app/views/myIssues/bookmarked';
import MyIssuesViewed from 'app/views/myIssues/viewed';
import NewProject from 'app/views/projectInstall/newProject';
import OnboardingConfigure from 'app/views/onboarding/configure';
import OnboardingNewProject from 'app/views/onboarding/newProject';
import OnboardingWizard from 'app/views/onboarding/wizard';
import OrganizationActivity from 'app/views/organizationActivity';
import OrganizationContext from 'app/views/organizationContext';
import OrganizationCreate from 'app/views/organizationCreate';
import OrganizationDashboard from 'app/views/organizationProjectsDashboard';
import OrganizationDetails from 'app/views/organizationDetails';
import OrganizationHomeContainer from 'app/components/organizations/homeContainer';
import OrganizationMembers from 'app/views/settings/organizationMembers';
import OrganizationRoot from 'app/views/organizationRoot';
import OrganizationStats from 'app/views/organizationStats';
import OrganizationStreamContainer from 'app/views/organizationStream/container';
import OrganizationStreamOverview from 'app/views/organizationStream/overview';
import ProjectChooser from 'app/views/projectChooser';
import ProjectDataForwarding from 'app/views/projectDataForwarding';
import ProjectDebugFiles from 'app/views/projectDebugFiles';
import ProjectDetails from 'app/views/projectDetails';
import ProjectDocsContext from 'app/views/projectInstall/docsContext';
import ProjectEnvironments from 'app/views/projectEnvironments';
import ProjectEventRedirect from 'app/views/projectEventRedirect';
import ProjectGettingStarted from 'app/views/projectInstall/gettingStarted';
import ProjectGroupDetails from 'app/views/groupDetails/project/index';
import ProjectGroupEventDetails from 'app/views/groupDetails/project/groupEventDetails';
import ProjectGroupEvents from 'app/views/groupDetails/project/groupEvents';
import ProjectGroupMergedView from 'app/views/groupDetails/shared/groupMerged';
import ProjectGroupSimilarView from 'app/views/groupDetails/shared/groupSimilar';
import ProjectGroupTagValues from 'app/views/groupDetails/project/groupTagValues';
import ProjectGroupTags from 'app/views/groupDetails/project/groupTags';
import ProjectGroupUserFeedback from 'app/views/groupDetails/project/groupUserFeedback';
import ProjectInstallOverview from 'app/views/projectInstall/overview';
import ProjectInstallPlatform from 'app/views/projectInstall/platform';
import ProjectPluginDetails from 'app/views/projectPluginDetails';
import ProjectPlugins from 'app/views/projectPlugins';
import ProjectSettings from 'app/views/projectSettings';
import ProjectTags from 'app/views/projectTags';
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
  defaultComponent: OrganizationMembers,
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
              import(/* webpackChunkName: "AccountSecurity" */ './views/settings/account/accountSecurity/index')
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
        component={errorHandler(ProjectEnvironments)}
      >
        <IndexRoute />
        <Route path="hidden/" />
      </Route>
      <Route name="Tags" path="tags/" component={errorHandler(ProjectTags)} />
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
          import(/* webpackChunkName: "projectOwnership" */ './views/settings/project/projectOwnership')
        }
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
        componentPromise={() =>
          import(/* webpackChunkName: "ProjectSavedSearches" */ './views/projectSavedSearches')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="debug-symbols/"
        name="Debug Information Files"
        component={errorHandler(ProjectDebugFiles)}
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
          name="New Application"
          path="new/"
          componentPromise={() =>
            import(/* webpackChunkName: "sentryApplicationDetails" */ './views/settings/organizationDeveloperSettings/sentryApplicationDetails')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="Edit Application"
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
        getComponent={(loc, cb) =>
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
        <Route component={errorHandler(OnboardingWizard)}>
          <IndexRoute component={errorHandler(OnboardingNewProject)} />
          <Route
            path=":projectId/configure/:platform/"
            component={errorHandler(OnboardingConfigure)}
          />
          {hook('routes:onboarding-survey')}
        </Route>
      </Route>
      <Route component={errorHandler(OrganizationDetails)}>
        <Route path="/settings/" name="Settings" component={SettingsWrapper}>
          <IndexRoute
            getComponent={(loc, cb) =>
              import(/* webpackChunkName: "SettingsIndex" */ './views/settings/settingsIndex').then(
                lazyLoad(cb)
              )
            }
          />

          <Route
            path="account/"
            name="Account"
            getComponent={(loc, cb) =>
              import(/* webpackChunkName: "AccountSettingsLayout" */ './views/settings/account/accountSettingsLayout').then(
                lazyLoad(cb)
              )
            }
          >
            {accountSettingsRoutes}
          </Route>

          <Route name="Organization" path=":orgId/">
            <Route
              getComponent={(loc, cb) =>
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
              getComponent={(loc, cb) =>
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
            component={errorHandler(OrganizationStats)}
          />
          <Route
            path="/organizations/:orgId/activity/"
            component={errorHandler(OrganizationActivity)}
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
              import(/* webpackChunkName: "OrganizationDiscover" */ './views/organizationDiscover/index')
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
            component={errorHandler(OrganizationStreamContainer)}
          >
            <Redirect from="/organizations/:orgId/" to="/organizations/:orgId/issues/" />
            <IndexRoute component={errorHandler(OrganizationStreamOverview)} />
            <Route
              path="searches/:searchId/"
              component={errorHandler(OrganizationStreamOverview)}
            />
          </Route>
          {/* Once org issues is complete, these routes can be nested under
          /organizations/:orgId/issues */}
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
            path="/organizations/:orgId/issues/:groupId/"
            componentPromise={() =>
              import(/* webpackChunkName: "OrganizationGroupDetails" */ './views/groupDetails/organization/index')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationGroupEventDetails" */ './views/groupDetails/organization/groupEventDetails')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/activity/"
              componentPromise={() =>
                import(/* webpackChunkName: "GroupActivity" */ './views/groupDetails/shared/groupActivity')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/events/:eventId/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationGroupEventDetails" */ './views/groupDetails/organization/groupEventDetails')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/events/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationGroupEvents" */ './views/groupDetails/organization/groupEvents')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/tags/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationGroupTags" */ './views/groupDetails/organization/groupTags')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/tags/:tagKey/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationGroupTagsValues" */ './views/groupDetails/organization/groupTagValues')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/feedback/"
              componentPromise={() =>
                import(/* webpackChunkName: "OrganizationGroupUserFeedback" */ './views/groupDetails/organization/groupUserFeedback')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/similar/"
              componentPromise={() =>
                import(/* webpackChunkName: "GroupSimilarView" */ './views/groupDetails/shared/groupSimilar')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/merged/"
              componentPromise={() =>
                import(/* webpackChunkName: "GroupSimilarView" */ './views/groupDetails/shared/groupMerged')
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
              import(/* webpackChunkName: "OrganizationReleases" */ './views/releases/list/organizationReleases')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="/organizations/:orgId/releases/:version/"
            componentPromise={() =>
              import(/*webpackChunkName: "OrganizationReleaseDetail"*/ './views/releases/detail/organization')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(/*webpackChunkName: "OrganizationReleaseOverview"*/ './views/releases/detail/organization/releaseOverview')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="new-events/"
              componentPromise={() =>
                import(/*webpackChunkName: "OrganizationReleaseNewEvents"*/ './views/releases/detail/organization/releaseNewEvents')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="all-events/"
              componentPromise={() =>
                import(/*webpackChunkName: "OrganizationReleaseAllEvents"*/ './views/releases/detail/organization/releaseAllEvents')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="artifacts/"
              componentPromise={() =>
                import(/*webpackChunkName: "ReleaseArtifacts"*/ './views/releases/detail/shared/releaseArtifacts')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="commits/"
              componentPromise={() =>
                import(/*webpackChunkName: "ReleaseCommits"*/ './views/releases/detail/shared/releaseCommits')
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
          <Route path="/organizations/:orgId/" component={OrganizationHomeContainer}>
            <Redirect from="projects/" to="/:orgId/" />
            {hook('routes:organization')}
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
          </Route>
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
          <IndexRoute
            componentPromise={() =>
              import(/* webpackChunkName: "Stream" */ './views/stream')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="issues/"
            componentPromise={() =>
              import(/* webpackChunkName: "Stream" */ './views/stream')
            }
            component={errorHandler(LazyLoad)}
          />

          <Route
            path="searches/:searchId/"
            componentPromise={() =>
              import(/* webpackChunkName: "Stream" */ './views/stream')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="dashboard/"
            componentPromise={() =>
              import(/*webpackChunkName: "ProjectDashboard"*/ './views/projectDashboard')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="releases/"
            componentPromise={() =>
              import(/* webpackChunkName: "ProjectReleases" */ './views/releases/list/projectReleases')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="releases/:version/"
            componentPromise={() =>
              import(/*webpackChunkName:"ProjectReleaseDetails"*/ './views/releases/detail/project')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(/*webpackChunkName:"ProjectReleaseOverview"*/ './views/releases/detail/project/releaseOverview')
              }
              component={errorHandler(LazyLoad)}
            />

            <Route
              path="new-events/"
              componentPromise={() =>
                import(/*webpackChunkName:"ProjectReleaseNewEvents"*/ './views/releases/detail/project/releaseNewEvents')
              }
              component={errorHandler(LazyLoad)}
            />

            <Route
              path="all-events/"
              componentPromise={() =>
                import(/* webpackChunkName: "ReleaseAllEvents" */ './views/releases/detail/project/releaseAllEvents')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="artifacts/"
              componentPromise={() =>
                import(/* webpackChunkName: "ReleaseArtifacts" */ './views/releases/detail/shared/releaseArtifacts')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="commits/"
              componentPromise={() =>
                import(/* webpackChunkName: "ReleaseCommits" */ './views/releases/detail/shared/releaseCommits')
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="user-feedback/"
            componentPromise={() =>
              import(/* webpackChunkName: "ProjectUserFeedback" */ './views/userFeedback/projectUserFeedback')
            }
            component={errorHandler(LazyLoad)}
          />

          <Route path="settings/" component={errorHandler(ProjectSettings)}>
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
              from="saved-searches/"
              to="/settings/:orgId/projects/:projectId/saved-searches/"
            />
            <Redirect
              from="debug-symbols/"
              to="/settings/:orgId/projects/:projectId/debug-symbols/"
            />
            <Redirect
              from="processing-issues/"
              to="/settings/:orgId/projects/:projectId/processing-issues/"
            />
            <Redirect
              from="filters/"
              to="/settings/:orgId/projects/:projectId/filters/"
            />
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
            <Redirect
              from="plugins/"
              to="/settings/:orgId/projects/:projectId/plugins/"
            />
            <Redirect
              from="plugins/:pluginId/"
              to="/settings/:orgId/projects/:projectId/plugins/:pluginId/"
            />
            <Redirect
              from="integrations/:providerKey/"
              to="/settings/:orgId/projects/:projectId/integrations/:providerKey/"
            />
            <Redirect
              from="install/"
              to="/settings/:orgId/projects/:projectId/install/"
            />
            <Redirect
              from="install/:platform'"
              to="/settings/:orgId/projects/:projectId/install/:platform/"
            />
            {projectSettingsRoutes}
          </Route>

          <Redirect from="group/:groupId/" to="issues/:groupId/" />
          <Route
            path="issues/:groupId/"
            component={errorHandler(ProjectGroupDetails)}
            ignoreScrollBehavior
          >
            <IndexRoute component={errorHandler(ProjectGroupEventDetails)} />

            <Route
              path="activity/"
              componentPromise={() =>
                import(/* webpackChunkName: "GroupActivity" */ './views/groupDetails/shared/groupActivity')
              }
              component={errorHandler(LazyLoad)}
            />

            <Route
              path="events/:eventId/"
              component={errorHandler(ProjectGroupEventDetails)}
            />
            <Route path="events/" component={errorHandler(ProjectGroupEvents)} />
            <Route path="tags/" component={errorHandler(ProjectGroupTags)} />
            <Route path="tags/:tagKey/" component={errorHandler(ProjectGroupTagValues)} />
            <Route path="feedback/" component={errorHandler(ProjectGroupUserFeedback)} />
            <Route path="similar/" component={errorHandler(ProjectGroupSimilarView)} />
            <Route path="merged/" component={errorHandler(ProjectGroupMergedView)} />
          </Route>

          <Route path="events/:eventId/" component={errorHandler(ProjectEventRedirect)} />
        </Route>
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
