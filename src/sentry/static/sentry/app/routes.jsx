import {Redirect, Route, IndexRoute, IndexRedirect} from 'react-router';
import React from 'react';

import {t} from 'app/locale';
import {EXPERIMENTAL_SPA} from 'app/constants';
import App from 'app/views/app';
import AuthLayout from 'app/views/auth/layout';
import HookStore from 'app/stores/hookStore';
import IssueListContainer from 'app/views/issueList/container';
import IssueListOverview from 'app/views/issueList/overview';
import LazyLoad from 'app/components/lazyLoad';
import OrganizationContext from 'app/views/organizationContext';
import OrganizationDetails, {
  LightWeightOrganizationDetails,
} from 'app/views/organizationDetails';
import OrganizationRoot from 'app/views/organizationRoot';
import ProjectEventRedirect from 'app/views/projectEventRedirect';
import RouteNotFound from 'app/views/routeNotFound';
import SettingsProjectProvider from 'app/views/settings/components/settingsProjectProvider';
import SettingsWrapper from 'app/views/settings/components/settingsWrapper';
import errorHandler from 'app/utils/errorHandler';
import redirectDeprecatedProjectRoute from 'app/views/projects/redirectDeprecatedProjectRoute';
import {TAB} from 'app/views/organizationGroupDetails/header';

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
 * up having to re-render more components than necessary.
 */
const lazyLoad = cb => m => cb(null, m.default);

const hook = name => HookStore.get(name).map(cb => cb());

function routes() {
  const accountSettingsRoutes = (
    <React.Fragment>
      <IndexRedirect to="details/" />

      <Route
        path="details/"
        name="Details"
        componentPromise={() =>
          import(
            /* webpackChunkName: "AccountDetails" */ 'app/views/settings/account/accountDetails'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route path="notifications/" name="Notifications">
        <IndexRoute
          componentPromise={() =>
            import(
              /* webpackChunkName: "AccountNotifications" */ 'app/views/settings/account/accountNotifications'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path=":fineTuneType/"
          name="Fine Tune Alerts"
          componentPromise={() =>
            import(
              /* webpackChunkName: "AccountNotificationsFineTuning" */ 'app/views/settings/account/accountNotificationFineTuning'
            )
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route
        path="emails/"
        name="Emails"
        componentPromise={() =>
          import(
            /* webpackChunkName: "AccountEmails" */ 'app/views/settings/account/accountEmails'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="authorizations/"
        componentPromise={() =>
          import(
            /* webpackChunkName: "AccountAuthorizations" */ 'app/views/settings/account/accountAuthorizations'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route name="Security" path="security/">
        <Route
          componentPromise={() =>
            import(
              /* webpackChunkName: "AccountSecurityWrapper" */ 'app/views/settings/account/accountSecurity/accountSecurityWrapper'
            )
          }
          component={errorHandler(LazyLoad)}
        >
          <IndexRoute
            componentPromise={() =>
              import(
                /* webpackChunkName: "AccountSecurity" */ 'app/views/settings/account/accountSecurity'
              )
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="session-history/"
            name="Session History"
            componentPromise={() =>
              import(
                /* webpackChunkName: "AccountSecuritySessionHistory" */ 'app/views/settings/account/accountSecurity/accountSecuritySessionHistory'
              )
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="mfa/:authId/"
            name="Details"
            componentPromise={() =>
              import(
                /* webpackChunkName: "AccountSecurityDetails" */ 'app/views/settings/account/accountSecurity/accountSecurityDetails'
              )
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>

        <Route
          path="mfa/:authId/enroll/"
          name="Enroll"
          componentPromise={() =>
            import(
              /* webpackChunkName: "AccountSecurityEnroll" */ 'app/views/settings/account/accountSecurity/accountSecurityEnroll'
            )
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Route
        path="subscriptions/"
        name="Subscriptions"
        componentPromise={() =>
          import(
            /* webpackChunkName: "AccountSubscriptions" */ 'app/views/settings/account/accountSubscriptions'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="identities/"
        name="Identities"
        componentPromise={() =>
          import(
            /* webpackChunkName: "AccountSocialIdentities" */ 'app/views/settings/account/accountIdentities'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route path="api/" name="API">
        <IndexRedirect to="auth-tokens/" />

        <Route path="auth-tokens/" name="Auth Tokens">
          <IndexRoute
            componentPromise={() =>
              import(
                /* webpackChunkName: "ApiTokensIndex" */ 'app/views/settings/account/apiTokens'
              )
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="new-token/"
            name="Create New Token"
            componentPromise={() =>
              import(
                /* webpackChunkName: "ApiTokenCreate" */ 'app/views/settings/account/apiNewToken'
              )
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>

        <Route path="applications/" name="Applications">
          <IndexRoute
            componentPromise={() =>
              import(
                /* webpackChunkName: "ApiApplications" */ 'app/views/settings/account/apiApplications'
              )
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path=":appId/"
            name="Details"
            componentPromise={() =>
              import(
                /* webpackChunkName: "ApiApplicationDetails" */ 'app/views/settings/account/apiApplications/details'
              )
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>
      </Route>

      <Route
        path="close-account/"
        name="Close Account"
        componentPromise={() =>
          import(
            /* webpackChunkName: "AccountClose" */ 'app/views/settings/account/accountClose'
          )
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
          import(
            /* webpackChunkName: "ProjectGeneralSettings" */ 'app/views/settings/projectGeneralSettings'
          )
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="teams/"
        name="Teams"
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectTeams" */ 'app/views/settings/project/projectTeams'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        name="Alerts"
        path="alerts/"
        component={errorHandler(LazyLoad)}
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectAlerts" */ 'app/views/settings/projectAlerts'
          )
        }
      >
        <IndexRoute
          component={errorHandler(LazyLoad)}
          componentPromise={() =>
            import(
              /* webpackChunkName: "ProjectAlertsSettings" */ 'app/views/settings/projectAlerts/settings'
            )
          }
        />
        <Redirect from="new/" to="/organizations/:orgId/alerts/:projectId/new/" />
        <Redirect from="rules/" to="/organizations/:orgId/alerts/rules/" />
        <Redirect from="rules/new/" to="/organizations/:orgId/alerts/:projectId/new/" />
        <Redirect
          from="metric-rules/new/"
          to="/organizations/:orgId/alerts/:projectId/new/"
        />
        <Redirect
          from="rules/:ruleId/"
          to="/organizations/:orgId/alerts/rules/:projectId/:ruleId/"
        />
        <Redirect
          from="metric-rules/:ruleId/"
          to="/organizations/:orgId/alerts/metric-rules/:projectId/:ruleId/"
        />
      </Route>

      <Route
        name="Environments"
        path="environments/"
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectEnvironments" */ 'app/views/settings/project/projectEnvironments'
          )
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
          import(/* webpackChunkName: "ProjectTags" */ 'app/views/settings/projectTags')
        }
        component={errorHandler(LazyLoad)}
      />
      <Redirect from="issue-tracking/" to="/settings/:orgId/:projectId/plugins/" />
      <Route
        path="release-tracking/"
        name="Release Tracking"
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectReleaseTracking" */ 'app/views/settings/project/projectReleaseTracking'
          )
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="ownership/"
        name="Issue Owners"
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectOwnership" */ 'app/views/settings/project/projectOwnership'
          )
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="data-forwarding/"
        name="Data Forwarding"
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectDataForwarding" */ 'app/views/settings/projectDataForwarding'
          )
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        name={t('Security & Privacy')}
        path="security-and-privacy/"
        component={errorHandler(LazyLoad)}
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectSecurityAndPrivacy" */ 'app/views/settings/projectSecurityAndPrivacy'
          )
        }
      />
      <Route
        path="debug-symbols/"
        name="Debug Information Files"
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectDebugFiles" */ 'app/views/settings/projectDebugFiles'
          )
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="proguard/"
        name={t('ProGuard Mappings')}
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectProguard" */ 'app/views/settings/projectProguard'
          )
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="source-maps/"
        name={t('Source Maps')}
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectSourceMaps" */ 'app/views/settings/projectSourceMaps'
          )
        }
        component={errorHandler(LazyLoad)}
      >
        <IndexRoute
          componentPromise={() =>
            import(
              /* webpackChunkName: "ProjectSourceMapsList" */ 'app/views/settings/projectSourceMaps/list'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path=":name/"
          name={t('Archive')}
          componentPromise={() =>
            import(
              /* webpackChunkName: "ProjectSourceMapsDetail" */ 'app/views/settings/projectSourceMaps/detail'
            )
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route
        path="processing-issues/"
        name="Processing Issues"
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectProcessingIssues" */ 'app/views/settings/project/projectProcessingIssues'
          )
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="filters/"
        name="Inbound Filters"
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectFilters" */ 'app/views/settings/project/projectFilters'
          )
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
          import(
            /* webpackChunkName: "ProjectServiceHooks" */ 'app/views/settings/project/projectServiceHooks'
          )
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="hooks/new/"
        name="Create Service Hook"
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectCreateServiceHook" */ 'app/views/settings/project/projectCreateServiceHook'
          )
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="hooks/:hookId/"
        name="Service Hook Details"
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectServiceHookDetails" */ 'app/views/settings/project/projectServiceHookDetails'
          )
        }
        component={errorHandler(LazyLoad)}
      />
      <Route path="keys/" name="Client Keys">
        <IndexRoute
          componentPromise={() =>
            import(
              /* webpackChunkName: "ProjectKeys" */ 'app/views/settings/project/projectKeys/list'
            )
          }
          component={errorHandler(LazyLoad)}
        />

        <Route
          path=":keyId/"
          name="Details"
          componentPromise={() =>
            import(
              /* webpackChunkName: "ProjectKeyDetails" */ 'app/views/settings/project/projectKeys/details'
            )
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route
        path="user-feedback/"
        name="User Feedback"
        componentPromise={() =>
          import(
            /* webpackChunkName: "ProjectUserFeedbackSettings" */ 'app/views/settings/project/projectUserFeedback'
          )
        }
        component={errorHandler(LazyLoad)}
      />
      <Redirect from="csp/" to="security-headers/" />
      <Route path="security-headers/" name="Security Headers">
        <IndexRoute
          componentPromise={() =>
            import(
              /* webpackChunkName: "ProjectSecurityHeaders" */ 'app/views/settings/projectSecurityHeaders'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="csp/"
          name="Content Security Policy"
          componentPromise={() =>
            import(
              /* webpackChunkName: "ProjectCspReports" */ 'app/views/settings/projectSecurityHeaders/csp'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="expect-ct/"
          name="Certificate Transparency"
          componentPromise={() =>
            import(
              /* webpackChunkName: "ProjectExpectCtReports" */ 'app/views/settings/projectSecurityHeaders/expectCt'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="hpkp/"
          name="HPKP"
          componentPromise={() =>
            import(
              /* webpackChunkName: "ProjectHpkpReports" */ 'app/views/settings/projectSecurityHeaders/hpkp'
            )
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route path="plugins/" name="Legacy Integrations">
        <IndexRoute
          componentPromise={() =>
            import(
              /* webpackChunkName: "ProjectPlugins" */ 'app/views/settings/projectPlugins'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path=":pluginId/"
          name="Integration Details"
          componentPromise={() =>
            import(
              /* webpackChunkName: "ProjectPluginDetails" */ 'app/views/settings/projectPlugins/details'
            )
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route path="install/" name="Configuration">
        <IndexRoute
          componentPromise={() =>
            import(
              /* webpackChunkName: "ProjectInstallOverview" */ 'app/views/projectInstall/overview'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path=":platform/"
          name="Docs"
          componentPromise={() =>
            import(
              /* webpackChunkName: "ProjectInstallPlatform" */ 'app/views/projectInstall/platform'
            )
          }
          component={errorHandler(LazyLoad)}
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
          import(
            /* webpackChunkName: "OrganizationGeneralSettings" */ 'app/views/settings/organizationGeneralSettings'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="projects/"
        name="Projects"
        componentPromise={() =>
          import(
            /* webpackChunkName: "OrganizationProjects" */ 'app/views/settings/organizationProjects'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route path="api-keys/" name="API Key">
        <IndexRoute
          componentPromise={() =>
            import(
              /* webpackChunkName: "OrganizationApiKeys" */ 'app/views/settings/organizationApiKeys'
            )
          }
          component={errorHandler(LazyLoad)}
        />

        <Route
          path=":apiKey/"
          name="Details"
          componentPromise={() =>
            import(
              /* webpackChunkName: "OrganizationApiKeyDetails" */ 'app/views/settings/organizationApiKeys/organizationApiKeyDetails'
            )
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Route
        path="audit-log/"
        name="Audit Log"
        componentPromise={() =>
          import(
            /* webpackChunkName: "OrganizationAuditLog" */ 'app/views/settings/organizationAuditLog'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="auth/"
        name="Auth Providers"
        componentPromise={() =>
          import(
            /* webpackChunkName: "OrganizationAuth" */ 'app/views/settings/organizationAuth'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route path="members/" name="Members">
        <Route
          componentPromise={() =>
            import(
              /* webpackChunkName: "OrganizationMembersWrapper" */ 'app/views/settings/organizationMembers/organizationMembersWrapper'
            )
          }
          component={errorHandler(LazyLoad)}
        >
          <IndexRoute
            componentPromise={() =>
              import(
                /* webpackChunkName: "OrganizationMembersList" */ 'app/views/settings/organizationMembers/organizationMembersList'
              )
            }
            component={errorHandler(LazyLoad)}
          />

          <Route
            path="requests/"
            name="Requests"
            componentPromise={() =>
              import(
                /* webpackChunkName: "OrganizationRequestsView" */ 'app/views/settings/organizationMembers/organizationRequestsView'
              )
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>

        <Route
          path="new/"
          name="Invite"
          componentPromise={() =>
            import(
              /* webpackChunkName: "InviteMember" */ 'app/views/settings/organizationMembers/inviteMember'
            )
          }
          component={errorHandler(LazyLoad)}
        />

        <Route
          path=":memberId/"
          name="Details"
          componentPromise={() =>
            import(
              /* webpackChunkName: "OrganizationMemberDetail" */ 'app/views/settings/organizationMembers/organizationMemberDetail'
            )
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Route
        path="rate-limits/"
        name="Rate Limits"
        componentPromise={() =>
          import(
            /* webpackChunkName: "OrganizationRateLimits" */ 'app/views/settings/organizationRateLimits'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        name={t('Relay')}
        path="relay/"
        componentPromise={() =>
          import(
            /* webpackChunkName: "organizationRelay" */ 'app/views/settings/organizationRelay'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="repos/"
        name="Repositories"
        componentPromise={() =>
          import(
            /* webpackChunkName: "OrganizationRepositories" */ 'app/views/settings/organizationRepositories'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="performance/"
        name={t('Performance')}
        componentPromise={() =>
          import(
            /* webpackChunkName: "OrganizationPerformance" */ 'app/views/settings/organizationPerformance'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="settings/"
        componentPromise={() =>
          import(
            /* webpackChunkName: "OrganizationGeneralSettings" */ 'app/views/settings/organizationGeneralSettings'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route
        name={t('Security & Privacy')}
        path="security-and-privacy/"
        componentPromise={() =>
          import(
            /* webpackChunkName: "OrganizationSecurityAndPrivacy" */ 'app/views/settings/organizationSecurityAndPrivacy'
          )
        }
        component={errorHandler(LazyLoad)}
      />

      <Route name="Teams" path="teams/">
        <IndexRoute
          componentPromise={() =>
            import(
              /* webpackChunkName: "OrganizationTeams" */ 'app/views/settings/organizationTeams'
            )
          }
          component={errorHandler(LazyLoad)}
        />

        <Route
          name="Team"
          path=":teamId/"
          componentPromise={() =>
            import(
              /* webpackChunkName: "TeamDetails" */ 'app/views/settings/organizationTeams/teamDetails'
            )
          }
          component={errorHandler(LazyLoad)}
        >
          <IndexRedirect to="members/" />
          <Route
            path="members/"
            name="Members"
            componentPromise={() =>
              import(
                /* webpackChunkName: "TeamMembers" */ 'app/views/settings/organizationTeams/teamMembers'
              )
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="projects/"
            name="Projects"
            componentPromise={() =>
              import(
                /* webpackChunkName: "TeamProjects" */ 'app/views/settings/organizationTeams/teamProjects'
              )
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="settings/"
            name="settings"
            componentPromise={() =>
              import(
                /* webpackChunkName: "TeamSettings" */ 'app/views/settings/organizationTeams/teamSettings'
              )
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>
      </Route>

      <Redirect from="plugins/" to="integrations/" />
      <Route name="Integrations" path="plugins/">
        <Route
          name="Integration Details"
          path=":integrationSlug/"
          componentPromise={() =>
            import(
              /* webpackChunkName: "PluginDetailedView" */ 'app/views/organizationIntegrations/pluginDetailedView'
            )
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Redirect from="sentry-apps/" to="integrations/" />
      <Route name="Integrations" path="sentry-apps/">
        <Route
          name="Details"
          path=":integrationSlug"
          componentPromise={() =>
            import(
              /* webpackChunkName: "SentryAppDetailedView" */ 'app/views/organizationIntegrations/sentryAppDetailedView'
            )
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Redirect from="document-integrations/" to="integrations/" />
      <Route name="Integrations" path="document-integrations/">
        <Route
          name="Details"
          path=":integrationSlug"
          componentPromise={() =>
            import(
              /* webpackChunkName: "ConfigureIntegration" */ 'app/views/organizationIntegrations/docIntegrationDetailedView'
            )
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route name="Integrations" path="integrations/">
        <IndexRoute
          componentPromise={() =>
            import(
              /* webpackChunkName: "IntegrationListDirectory" */ 'app/views/organizationIntegrations/integrationListDirectory'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="Integration Details"
          path=":integrationSlug"
          componentPromise={() =>
            import(
              /* webpackChunkName: "IntegrationDetailedView" */ 'app/views/organizationIntegrations/integrationDetailedView'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="Configure Integration"
          path=":providerKey/:integrationId/"
          componentPromise={() =>
            import(
              /* webpackChunkName: "ConfigureIntegration" */ 'app/views/settings/organizationIntegrations/configureIntegration'
            )
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Route name="Developer Settings" path="developer-settings/">
        <IndexRoute
          componentPromise={() =>
            import(
              /* webpackChunkName: "OrganizationDeveloperSettings" */ 'app/views/settings/organizationDeveloperSettings'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="New Public Integration"
          path="new-public/"
          componentPromise={() =>
            import(
              /* webpackChunkName: "sentryApplicationDetails" */ 'app/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="New Internal Integration"
          path="new-internal/"
          componentPromise={() =>
            import(
              /* webpackChunkName: "sentryApplicationDetails" */ 'app/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="Edit Integration"
          path=":appSlug/"
          componentPromise={() =>
            import(
              /* webpackChunkName: "sentryApplicationDetails" */ 'app/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="Integration Dashboard"
          path=":appSlug/dashboard/"
          componentPromise={() =>
            import(
              /* webpackChunkName: "SentryApplicationDashboard" */ 'app/views/settings/organizationDeveloperSettings/sentryApplicationDashboard'
            )
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
    </React.Fragment>
  );

  return (
    <Route>
      {EXPERIMENTAL_SPA && (
        <Route path="/auth/login/" component={errorHandler(AuthLayout)}>
          <IndexRoute
            componentPromise={() =>
              import(/* webpackChunkName: "AuthLogin" */ 'app/views/auth/login')
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>
      )}

      <Route path="/" component={errorHandler(App)}>
        <IndexRoute
          componentPromise={() =>
            import(/* webpackChunkName: "AppRoot" */ 'app/views/app/root')
          }
          component={errorHandler(LazyLoad)}
        />

        <Route
          path="/accept/:memberId/:token/"
          componentPromise={() =>
            import(
              /* webpackChunkName: "AcceptOrganizationInvite" */ 'app/views/acceptOrganizationInvite'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="/accept-transfer/"
          componentPromise={() =>
            import(
              /* webpackChunkName: "AcceptProjectTransfer" */ 'app/views/acceptProjectTransfer'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="/extensions/external-install/:providerId/:installationId"
          componentPromise={() =>
            import(
              /* webpackChunkName: "ExtensionsIntegrationInstallation" */ 'app/views/integrationInstallation'
            )
          }
          component={errorHandler(LazyLoad)}
        />

        <Route
          path="/extensions/:integrationSlug/link/"
          getComponent={(_loc, cb) =>
            import(
              /* webpackChunkName: "IntegrationOrganizationLink" */ 'app/views/integrationOrganizationLink'
            ).then(lazyLoad(cb))
          }
        />

        <Route
          path="/sentry-apps/:sentryAppSlug/external-install/"
          componentPromise={() =>
            import(
              /* webpackChunkName: "SentryAppExternalInstallation" */ 'app/views/sentryAppExternalInstallation'
            )
          }
          component={errorHandler(LazyLoad)}
        />

        <Redirect from="/account/" to="/settings/account/details/" />

        <Redirect from="/share/group/:shareId/" to="/share/issue/:shareId/" />
        <Route
          path="/share/issue/:shareId/"
          componentPromise={() =>
            import(
              /* webpackChunkName: "SharedGroupDetails" */ 'app/views/sharedGroupDetails/sharedGroupDetails'
            )
          }
          component={errorHandler(LazyLoad)}
        />

        <Route
          path="/organizations/new/"
          componentPromise={() =>
            import(
              /* webpackChunkName: "OrganizationCreate" */ 'app/views/organizationCreate'
            )
          }
          component={errorHandler(LazyLoad)}
        />

        <Route
          path="/organizations/:orgId/data-export/:dataExportId"
          componentPromise={() =>
            import(
              /* webpackChunkName: "DataDownloadView" */ 'app/views/dataExport/dataDownload'
            )
          }
          component={errorHandler(LazyLoad)}
        />

        <Route
          path="/join-request/:orgId/"
          componentPromise={() =>
            import(
              /* webpackChunkName: "OrganizationJoinRequest" */ 'app/views/organizationJoinRequest'
            )
          }
          component={errorHandler(LazyLoad)}
        />

        <Route path="/onboarding/:orgId/" component={errorHandler(OrganizationContext)}>
          <IndexRedirect to="welcome/" />
          <Route
            path=":step/"
            componentPromise={() =>
              import(
                /* webpackChunkName: "Onboarding" */ 'app/views/onboarding/onboarding'
              )
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>

        {/* Settings routes */}
        <Route component={errorHandler(OrganizationDetails)}>
          <Route path="/settings/" name="Settings" component={SettingsWrapper}>
            <IndexRoute
              getComponent={(_loc, cb) =>
                import(
                  /* webpackChunkName: "SettingsIndex" */ 'app/views/settings/settingsIndex'
                ).then(lazyLoad(cb))
              }
            />

            <Route
              path="account/"
              name="Account"
              getComponent={(_loc, cb) =>
                import(
                  /* webpackChunkName: "AccountSettingsLayout" */ 'app/views/settings/account/accountSettingsLayout'
                ).then(lazyLoad(cb))
              }
            >
              {accountSettingsRoutes}
            </Route>

            <Route name="Organization" path=":orgId/">
              <Route
                getComponent={(_loc, cb) =>
                  import(
                    /* webpackChunkName: "OrganizationSettingsLayout" */ 'app/views/settings/organization/organizationSettingsLayout'
                  ).then(lazyLoad(cb))
                }
              >
                {hook('routes:organization')}
                {orgSettingsRoutes}
              </Route>

              <Route
                name="Project"
                path="projects/:projectId/"
                getComponent={(_loc, cb) =>
                  import(
                    /* webpackChunkName: "ProjectSettingsLayout" */ 'app/views/settings/project/projectSettingsLayout'
                  ).then(lazyLoad(cb))
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

        {/* A route tree for lightweight organizational detail views. We place
      this above the heavyweight organization detail views because there
      exist some redirects from deprecated routes which should not take
      precedence over these lightweight routes*/}
        <Route component={errorHandler(LightWeightOrganizationDetails)}>
          <Route
            path="/organizations/:orgId/projects/"
            componentPromise={() =>
              import(
                /* webpackChunkName: "ProjectsDashboard" */ 'app/views/projectsDashboard'
              )
            }
            component={errorHandler(LazyLoad)}
          />

          <Route
            path="/organizations/:orgId/dashboards/"
            componentPromise={() =>
              import(/* webpackChunkName: "DashboardsContainer" */ 'app/views/dashboards')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(
                  /* webpackChunkName: "OverviewDashboard" */ 'app/views/dashboards/overviewDashboard'
                )
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>

          <Route
            path="/organizations/:orgId/user-feedback/"
            componentPromise={() =>
              import(/* webpackChunkName: "UserFeedback" */ 'app/views/userFeedback')
            }
            component={errorHandler(LazyLoad)}
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
              import(
                /* webpackChunkName: "GroupDetails" */ 'app/views/organizationGroupDetails'
              )
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(
                  /* webpackChunkName: "GroupEventDetails" */ 'app/views/organizationGroupDetails/groupEventDetails'
                )
              }
              component={errorHandler(LazyLoad)}
              props={{
                currentTab: TAB.DETAILS,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/activity/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "GroupActivity" */ 'app/views/organizationGroupDetails/groupActivity'
                )
              }
              component={errorHandler(LazyLoad)}
              props={{
                currentTab: TAB.COMMENTS,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/events/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "GroupEvents" */ 'app/views/organizationGroupDetails/groupEvents'
                )
              }
              component={errorHandler(LazyLoad)}
              props={{
                currentTab: TAB.EVENTS,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/tags/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "GroupTags" */ 'app/views/organizationGroupDetails/groupTags'
                )
              }
              component={errorHandler(LazyLoad)}
              props={{
                currentTab: TAB.TAGS,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/tags/:tagKey/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "GroupTagsValues" */ 'app/views/organizationGroupDetails/groupTagValues'
                )
              }
              component={errorHandler(LazyLoad)}
              props={{
                currentTab: TAB.TAGS,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/feedback/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "GroupUserFeedback" */ 'app/views/organizationGroupDetails/groupUserFeedback'
                )
              }
              component={errorHandler(LazyLoad)}
              props={{
                currentTab: TAB.USER_FEEDBACK,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/attachments/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "GroupEventAttachments" */ 'app/views/organizationGroupDetails/groupEventAttachments'
                )
              }
              component={errorHandler(LazyLoad)}
              props={{
                currentTab: TAB.ATTACHMENTS,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/similar/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "GroupSimilarIssues" */ 'app/views/organizationGroupDetails/groupSimilarIssues'
                )
              }
              component={errorHandler(LazyLoad)}
              props={{
                currentTab: TAB.SIMILAR_ISSUES,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/merged/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "GroupMerged" */ 'app/views/organizationGroupDetails/groupMerged'
                )
              }
              component={errorHandler(LazyLoad)}
              props={{
                currentTab: TAB.MERGED,
                isEventRoute: false,
              }}
            />
            <Route path="/organizations/:orgId/issues/:groupId/events/:eventId/">
              <IndexRoute
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "GroupEventDetails" */ 'app/views/organizationGroupDetails/groupEventDetails'
                  )
                }
                component={errorHandler(LazyLoad)}
                props={{
                  currentTab: TAB.DETAILS,
                  isEventRoute: true,
                }}
              />
              <Route
                path="activity/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "GroupActivity" */ 'app/views/organizationGroupDetails/groupActivity'
                  )
                }
                component={errorHandler(LazyLoad)}
                props={{
                  currentTab: TAB.COMMENTS,
                  isEventRoute: true,
                }}
              />
              <Route
                path="events/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "GroupEvents" */ 'app/views/organizationGroupDetails/groupEvents'
                  )
                }
                component={errorHandler(LazyLoad)}
                props={{
                  currentTab: TAB.EVENTS,
                  isEventRoute: true,
                }}
              />
              <Route
                path="similar/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "GroupSimilarIssues" */ 'app/views/organizationGroupDetails/groupSimilarIssues'
                  )
                }
                component={errorHandler(LazyLoad)}
                props={{
                  currentTab: TAB.SIMILAR_ISSUES,
                  isEventRoute: true,
                }}
              />
              <Route
                path="tags/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "GroupTags" */ 'app/views/organizationGroupDetails/groupTags'
                  )
                }
                component={errorHandler(LazyLoad)}
                props={{
                  currentTab: TAB.TAGS,
                  isEventRoute: true,
                }}
              />
              <Route
                path="tags/:tagKey/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "GroupTagsValues" */ 'app/views/organizationGroupDetails/groupTagValues'
                  )
                }
                component={errorHandler(LazyLoad)}
                props={{
                  currentTab: TAB.TAGS,
                  isEventRoute: true,
                }}
              />
              <Route
                path="feedback/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "GroupUserFeedback" */ 'app/views/organizationGroupDetails/groupUserFeedback'
                  )
                }
                component={errorHandler(LazyLoad)}
                props={{
                  currentTab: TAB.USER_FEEDBACK,
                  isEventRoute: true,
                }}
              />
              <Route
                path="attachments/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "GroupEventAttachments" */ 'app/views/organizationGroupDetails/groupEventAttachments'
                  )
                }
                component={errorHandler(LazyLoad)}
                props={{
                  currentTab: TAB.ATTACHMENTS,
                  isEventRoute: true,
                }}
              />
              <Route
                path="merged/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "GroupMerged" */ 'app/views/organizationGroupDetails/groupMerged'
                  )
                }
                component={errorHandler(LazyLoad)}
                props={{
                  currentTab: TAB.MERGED,
                  isEventRoute: true,
                }}
              />
            </Route>
          </Route>

          <Route
            path="/organizations/:orgId/alerts/"
            componentPromise={() =>
              import(/* webpackChunkName: "AlertsContainer" */ 'app/views/alerts')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(/* webpackChunkName: "AlertsList" */ 'app/views/alerts/list')
              }
              component={errorHandler(LazyLoad)}
            />

            <Route path="rules/">
              <IndexRoute
                component={errorHandler(LazyLoad)}
                componentPromise={() =>
                  import(/* webpackChunkName: "AlertsDetails" */ 'app/views/alerts/rules')
                }
              />
              <Route
                path=":projectId/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "AlertsProjectProvider" */ 'app/views/alerts/builder/projectProvider'
                  )
                }
                component={errorHandler(LazyLoad)}
              >
                <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
                <Route
                  path=":ruleId/"
                  name="Edit Alert Rule"
                  componentPromise={() =>
                    import(
                      /* webpackChunkName: "ProjectAlertsEdit" */ 'app/views/settings/projectAlerts/edit'
                    )
                  }
                  component={errorHandler(LazyLoad)}
                />
              </Route>
            </Route>

            <Route path="metric-rules/">
              <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
              <Route
                path=":projectId/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "AlertsProjectProvider" */ 'app/views/alerts/builder/projectProvider'
                  )
                }
                component={errorHandler(LazyLoad)}
              >
                <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
                <Route
                  path=":ruleId/"
                  name="Edit Alert Rule"
                  componentPromise={() =>
                    import(
                      /* webpackChunkName: "ProjectAlertsEdit" */ 'app/views/settings/projectAlerts/edit'
                    )
                  }
                  component={errorHandler(LazyLoad)}
                />
              </Route>
            </Route>

            <Route
              path="rules/"
              componentPromise={() =>
                import(/* webpackChunkName: "AlertsDetails" */ 'app/views/alerts/rules')
              }
              component={errorHandler(LazyLoad)}
            />

            <Route
              path=":alertId/"
              componentPromise={() =>
                import(/* webpackChunkName: "AlertsDetails" */ 'app/views/alerts/details')
              }
              component={errorHandler(LazyLoad)}
            />

            <Route
              path=":projectId/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "AlertsProjectProvider" */ 'app/views/alerts/builder/projectProvider'
                )
              }
              component={errorHandler(LazyLoad)}
            >
              <Route
                path="new/"
                name="New Alert Rule"
                component={errorHandler(LazyLoad)}
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "ProjectAlertsCreate" */ 'app/views/settings/projectAlerts/create'
                  )
                }
              />
            </Route>
          </Route>

          <Route
            path="/organizations/:orgId/events/"
            componentPromise={() =>
              import(/* webpackChunkName: "EventsContainer" */ 'app/views/events')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(/* webpackChunkName: "Events" */ 'app/views/events/events')
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>

          <Route
            path="/organizations/:orgId/monitors/"
            componentPromise={() =>
              import(/* webpackChunkName: "MonitorsContainer" */ 'app/views/monitors')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(/* webpackChunkName: "Monitors" */ 'app/views/monitors/monitors')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/monitors/create/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "MonitorCreate" */ 'app/views/monitors/create'
                )
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/monitors/:monitorId/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "MonitorDetails" */ 'app/views/monitors/details'
                )
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/monitors/:monitorId/edit/"
              componentPromise={() =>
                import(/* webpackChunkName: "MonitorEdit" */ 'app/views/monitors/edit')
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>

          <Route
            path="/organizations/:orgId/releases/"
            componentPromise={() =>
              import(/* webpackChunkName: "ReleasesContainer" */ 'app/views/releases')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(/* webpackChunkName: "ReleasesList" */ 'app/views/releases/list')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path=":release/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "ReleasesDetail" */ 'app/views/releases/detail'
                )
              }
              component={errorHandler(LazyLoad)}
            >
              <IndexRoute
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "ReleasesDetailOverview" */ 'app/views/releases/detail/overview'
                  )
                }
                component={errorHandler(LazyLoad)}
              />
              <Route
                path="commits/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "ReleasesDetailCommits" */ 'app/views/releases/detail/commits'
                  )
                }
                component={errorHandler(LazyLoad)}
              />
              <Route
                path="artifacts/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "ReleasesDetailArtifacts" */ 'app/views/releases/detail/artifacts'
                  )
                }
                component={errorHandler(LazyLoad)}
              />
              <Route
                path="files-changed/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "ReleasesDetailFilesChanged" */ 'app/views/releases/detail/filesChanged'
                  )
                }
                component={errorHandler(LazyLoad)}
              />
              <Redirect
                path="new-events/"
                to="/organizations/:orgId/releases/:release/"
              />
              <Redirect
                path="all-events/"
                to="/organizations/:orgId/releases/:release/"
              />
            </Route>
          </Route>

          <Route
            path="/organizations/:orgId/activity/"
            componentPromise={() =>
              import(
                /* webpackChunkName: "OrganizationActivity" */ 'app/views/organizationActivity'
              )
            }
            component={errorHandler(LazyLoad)}
          />

          <Route
            path="/organizations/:orgId/projects/:projectId/events/:eventId/"
            component={errorHandler(ProjectEventRedirect)}
          />

          {/*
        TODO(mark) Long term this /queries route should go away and /discover should be the
        canoncial route for discover2. Also the duplication in route wrapping
        here should go away.
        */}
          <Route
            path="/organizations/:orgId/discover/queries/"
            componentPromise={() =>
              import(/* webpackChunkName: "DiscoverV2Container" */ 'app/views/eventsV2')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(
                  /* webpackChunkName: "DiscoverV2Landing" */ 'app/views/eventsV2/landing'
                )
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/discover/results/"
            componentPromise={() =>
              import(/* webpackChunkName: "DiscoverV2Container" */ 'app/views/eventsV2')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(
                  /* webpackChunkName: "DiscoverV2Results" */ 'app/views/eventsV2/results'
                )
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/discover/:eventSlug/"
            componentPromise={() =>
              import(/* webpackChunkName: "DiscoverV2Container" */ 'app/views/eventsV2')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(
                  /* webpackChunkName: "DiscoverV2Details" */ 'app/views/eventsV2/eventDetails'
                )
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/"
            componentPromise={() =>
              import(
                /* webpackChunkName: "PerformanceContainer" */ 'app/views/performance'
              )
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(
                  /* webpackChunkName: "PerformanceLanding" */ 'app/views/performance/landing'
                )
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/summary/"
            componentPromise={() =>
              import(
                /* webpackChunkName: "PerformanceContainer" */ 'app/views/performance'
              )
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(
                  /* webpackChunkName: "PerformanceTransactionSummary" */ 'app/views/performance/transactionSummary'
                )
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/:eventSlug/"
            componentPromise={() =>
              import(
                /* webpackChunkName: "PerformanceContainer" */ 'app/views/performance'
              )
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(
                  /* webpackChunkName: "PerformanceTransactionDetails" */ 'app/views/performance/transactionDetails'
                )
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/compare/:baselineEventSlug/:regressionEventSlug/"
            componentPromise={() =>
              import(
                /* webpackChunkName: "PerformanceContainer" */ 'app/views/performance'
              )
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(
                  /* webpackChunkName: "PerformanceCompareTransactions" */ 'app/views/performance/compare'
                )
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>

          {/* Admin/manage routes */}
          <Route
            path="/manage/"
            componentPromise={() =>
              import(/* webpackChunkName: "AdminLayout" */ 'app/views/admin/adminLayout')
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(
                  /* webpackChunkName: "AdminOverview" */ 'app/views/admin/adminOverview'
                )
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="buffer/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "AdminBuffer" */ 'app/views/admin/adminBuffer'
                )
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="relays/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "AdminRelays" */ 'app/views/admin/adminRelays'
                )
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="organizations/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "AdminOrganizations" */ 'app/views/admin/adminOrganizations'
                )
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="projects/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "AdminProjects" */ 'app/views/admin/adminProjects'
                )
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
                import(
                  /* webpackChunkName: "AdminQuotas" */ 'app/views/admin/adminQuotas'
                )
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="settings/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "AdminSettings" */ 'app/views/admin/adminSettings'
                )
              }
              component={errorHandler(LazyLoad)}
            />
            <Route path="users/">
              <IndexRoute
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "AdminUsers" */ 'app/views/admin/adminUsers'
                  )
                }
                component={errorHandler(LazyLoad)}
              />
              <Route
                path=":id"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "AdminUserEdit" */ 'app/views/admin/adminUserEdit'
                  )
                }
                component={errorHandler(LazyLoad)}
              />
            </Route>
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
                import(
                  /* webpackChunkName: "AdminEnvironment" */ 'app/views/admin/adminEnvironment'
                )
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="status/packages/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "AdminPackages" */ 'app/views/admin/adminPackages'
                )
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="status/warnings/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "AdminWarnings" */ 'app/views/admin/adminWarnings'
                )
              }
              component={errorHandler(LazyLoad)}
            />
            {hook('routes:admin')}
          </Route>
        </Route>

        {/* The heavyweight organization detail views */}
        <Route path="/:orgId/" component={errorHandler(OrganizationDetails)}>
          <Route component={errorHandler(OrganizationRoot)}>
            {hook('routes:organization-root')}
            <Route
              path="/organizations/:orgId/stats/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "OrganizationStats" */ 'app/views/organizationStats'
                )
              }
              component={errorHandler(LazyLoad)}
            />

            <Route
              path="/organizations/:orgId/discover/"
              componentPromise={() =>
                import(/* webpackChunkName: "DiscoverContainer" */ 'app/views/discover')
              }
              component={errorHandler(LazyLoad)}
            >
              <Redirect path="saved/" to="/organizations/:orgId/discover/" />
              <Route path="saved/:savedQueryId/" />
            </Route>

            <Route
              path="/organizations/:orgId/projects/:projectId/getting-started/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "ProjectGettingStarted" */ 'app/views/projectInstall/gettingStarted'
                )
              }
              component={errorHandler(LazyLoad)}
            >
              <IndexRoute
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "ProjectInstallOverview" */ 'app/views/projectInstall/overview'
                  )
                }
                component={errorHandler(LazyLoad)}
              />
              <Route
                path=":platform/"
                componentPromise={() =>
                  import(
                    /* webpackChunkName: "ProjectInstallPlatform" */ 'app/views/projectInstall/platform'
                  )
                }
                component={errorHandler(LazyLoad)}
              />
            </Route>

            <Route
              path="/organizations/:orgId/teams/new/"
              componentPromise={() =>
                import(/* webpackChunkName: "TeamCreate" */ 'app/views/teamCreate')
              }
              component={errorHandler(LazyLoad)}
            />

            <Route path="/organizations/:orgId/">
              {hook('routes:organization')}
              <Redirect
                path="/organizations/:orgId/teams/"
                to="/settings/:orgId/teams/"
              />
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
              <Redirect
                path="/organizations/:orgId/repos/"
                to="/settings/:orgId/repos/"
              />
            </Route>
            <Route
              path="/organizations/:orgId/projects/new/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "NewProject" */ 'app/views/projectInstall/newProject'
                )
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path=":projectId/getting-started/"
            componentPromise={() =>
              import(
                /* webpackChunkName: "ProjectGettingStarted" */ 'app/views/projectInstall/gettingStarted'
              )
            }
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import(
                  /* webpackChunkName: "ProjectInstallOverview" */ 'app/views/projectInstall/overview'
                )
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path=":platform/"
              componentPromise={() =>
                import(
                  /* webpackChunkName: "ProjectInstallPlatform" */ 'app/views/projectInstall/platform'
                )
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
        </Route>

        {/* A route tree for lightweight organizational detail views.
          This is strictly for deprecated URLs that we need to maintain */}
        <Route component={errorHandler(LightWeightOrganizationDetails)}>
          <Route name="Organization" path="/:orgId/">
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
              <Route
                path="dashboard/"
                component={errorHandler(
                  redirectDeprecatedProjectRoute(
                    ({orgId, projectId}) =>
                      `/organizations/${orgId}/dashboards/?project=${projectId}`
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
                      `/organizations/${orgId}/releases/${router.params.version}/?project=${projectId}`
                  )
                )}
              />
              <Route
                path="releases/:version/new-events/"
                component={errorHandler(
                  redirectDeprecatedProjectRoute(
                    ({orgId, projectId, router}) =>
                      `/organizations/${orgId}/releases/${router.params.version}/new-events/?project=${projectId}`
                  )
                )}
              />
              <Route
                path="releases/:version/all-events/"
                component={errorHandler(
                  redirectDeprecatedProjectRoute(
                    ({orgId, projectId, router}) =>
                      `/organizations/${orgId}/releases/${router.params.version}/all-events/?project=${projectId}`
                  )
                )}
              />
              <Route
                path="releases/:version/artifacts/"
                component={errorHandler(
                  redirectDeprecatedProjectRoute(
                    ({orgId, projectId, router}) =>
                      `/organizations/${orgId}/releases/${router.params.version}/artifacts/?project=${projectId}`
                  )
                )}
              />
              <Route
                path="releases/:version/commits/"
                component={errorHandler(
                  redirectDeprecatedProjectRoute(
                    ({orgId, projectId, router}) =>
                      `/organizations/${orgId}/releases/${router.params.version}/commits/?project=${projectId}`
                  )
                )}
              />
            </Route>
          </Route>
        </Route>

        <Route path="/:orgId/">
          <Route path=":projectId/settings/">
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
    </Route>
  );
}

export default routes;
