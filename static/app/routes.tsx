import * as React from 'react';
import {
  EnterHook,
  IndexRedirect,
  IndexRoute as BaseIndexRoute,
  IndexRouteProps,
  Redirect,
  Route as BaseRoute,
  RouteProps,
} from 'react-router';

import LazyLoad from 'app/components/lazyLoad';
import {EXPERIMENTAL_SPA} from 'app/constants';
import {t} from 'app/locale';
import HookStore from 'app/stores/hookStore';
import {HookName} from 'app/types/hooks';
import errorHandler from 'app/utils/errorHandler';
import App from 'app/views/app';
import AuthLayout from 'app/views/auth/layout';
import IssueListContainer from 'app/views/issueList/container';
import IssueListOverview from 'app/views/issueList/overview';
import OrganizationContext from 'app/views/organizationContext';
import OrganizationDetails, {
  LightWeightOrganizationDetails,
} from 'app/views/organizationDetails';
import {TAB} from 'app/views/organizationGroupDetails/header';
import OrganizationRoot from 'app/views/organizationRoot';
import ProjectEventRedirect from 'app/views/projectEventRedirect';
import redirectDeprecatedProjectRoute from 'app/views/projects/redirectDeprecatedProjectRoute';
import RouteNotFound from 'app/views/routeNotFound';
import SettingsProjectProvider from 'app/views/settings/components/settingsProjectProvider';
import SettingsWrapper from 'app/views/settings/components/settingsWrapper';

const appendTrailingSlash: EnterHook = (nextState, replace) => {
  const lastChar = nextState.location.pathname.slice(-1);
  if (lastChar !== '/') {
    replace(nextState.location.pathname + '/');
  }
};

type CustomProps = {
  name?: string;
  componentPromise?: () => Promise<any>;
};

/**
 * We add some additional props to our routes
 */

const Route = BaseRoute as React.ComponentClass<RouteProps & CustomProps>;
const IndexRoute = BaseIndexRoute as React.ComponentClass<IndexRouteProps & CustomProps>;

type ComponentCallback = Parameters<NonNullable<RouteProps['getComponent']>>[1];

/**
 * Use react-router to lazy load a route. Use this for codesplitting containers (e.g. SettingsLayout)
 *
 * The method for lazy loading a route leaf node is using the <LazyLoad> component + `componentPromise`.
 * The reason for this is because react-router handles the route tree better and if we use <LazyLoad> it will end
 * up having to re-render more components than necessary.
 */
const lazyLoad = (cb: ComponentCallback) => (m: {default: any}) => cb(null, m.default);

const hook = (name: HookName) => HookStore.get(name).map(cb => cb());

function routes() {
  const accountSettingsRoutes = (
    <React.Fragment>
      <IndexRedirect to="details/" />

      <Route
        path="details/"
        name="Details"
        componentPromise={() => import('app/views/settings/account/accountDetails')}
        component={errorHandler(LazyLoad)}
      />

      <Route path="notifications/" name="Notifications">
        <IndexRoute
          componentPromise={() =>
            import('app/views/settings/account/accountNotifications')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path=":fineTuneType/"
          name="Fine Tune Alerts"
          componentPromise={() =>
            import('app/views/settings/account/accountNotificationFineTuning')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route
        path="emails/"
        name="Emails"
        componentPromise={() => import('app/views/settings/account/accountEmails')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="authorizations/"
        componentPromise={() =>
          import('app/views/settings/account/accountAuthorizations')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route name="Security" path="security/">
        <Route
          componentPromise={() =>
            import('app/views/settings/account/accountSecurity/accountSecurityWrapper')
          }
          component={errorHandler(LazyLoad)}
        >
          <IndexRoute
            componentPromise={() => import('app/views/settings/account/accountSecurity')}
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="session-history/"
            name="Session History"
            componentPromise={() =>
              import('app/views/settings/account/accountSecurity/sessionHistory')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="mfa/:authId/"
            name="Details"
            componentPromise={() =>
              import('app/views/settings/account/accountSecurity/accountSecurityDetails')
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>

        <Route
          path="mfa/:authId/enroll/"
          name="Enroll"
          componentPromise={() =>
            import('app/views/settings/account/accountSecurity/accountSecurityEnroll')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Route
        path="subscriptions/"
        name="Subscriptions"
        componentPromise={() => import('app/views/settings/account/accountSubscriptions')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="identities/"
        name="Identities"
        componentPromise={() => import('app/views/settings/account/accountIdentities')}
        component={errorHandler(LazyLoad)}
      />

      <Route path="api/" name="API">
        <IndexRedirect to="auth-tokens/" />

        <Route path="auth-tokens/" name="Auth Tokens">
          <IndexRoute
            componentPromise={() => import('app/views/settings/account/apiTokens')}
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="new-token/"
            name="Create New Token"
            componentPromise={() => import('app/views/settings/account/apiNewToken')}
            component={errorHandler(LazyLoad)}
          />
        </Route>

        <Route path="applications/" name="Applications">
          <IndexRoute
            componentPromise={() => import('app/views/settings/account/apiApplications')}
            component={errorHandler(LazyLoad)}
          />
          <Route
            path=":appId/"
            name="Details"
            componentPromise={() =>
              import('app/views/settings/account/apiApplications/details')
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>

        {hook('routes:api')}
      </Route>

      <Route
        path="close-account/"
        name="Close Account"
        componentPromise={() => import('app/views/settings/account/accountClose')}
        component={errorHandler(LazyLoad)}
      />
    </React.Fragment>
  );

  const projectSettingsRoutes = (
    <React.Fragment>
      <IndexRoute
        name="General"
        componentPromise={() => import('app/views/settings/projectGeneralSettings')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="teams/"
        name="Teams"
        componentPromise={() => import('app/views/settings/project/projectTeams')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        name="Alerts"
        path="alerts/"
        component={errorHandler(LazyLoad)}
        componentPromise={() => import('app/views/settings/projectAlerts')}
      >
        <IndexRoute
          component={errorHandler(LazyLoad)}
          componentPromise={() => import('app/views/settings/projectAlerts/settings')}
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
        componentPromise={() => import('app/views/settings/project/projectEnvironments')}
        component={errorHandler(LazyLoad)}
      >
        <IndexRoute />
        <Route path="hidden/" />
      </Route>
      <Route
        name="Tags"
        path="tags/"
        componentPromise={() => import('app/views/settings/projectTags')}
        component={errorHandler(LazyLoad)}
      />
      <Redirect from="issue-tracking/" to="/settings/:orgId/:projectId/plugins/" />
      <Route
        path="release-tracking/"
        name="Release Tracking"
        componentPromise={() =>
          import('app/views/settings/project/projectReleaseTracking')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="ownership/"
        name="Issue Owners"
        componentPromise={() => import('app/views/settings/project/projectOwnership')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="data-forwarding/"
        name="Data Forwarding"
        componentPromise={() => import('app/views/settings/projectDataForwarding')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        name={t('Security & Privacy')}
        path="security-and-privacy/"
        component={errorHandler(LazyLoad)}
        componentPromise={() => import('app/views/settings/projectSecurityAndPrivacy')}
      />
      <Route
        path="debug-symbols/"
        name="Debug Information Files"
        componentPromise={() => import('app/views/settings/projectDebugFiles')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="proguard/"
        name={t('ProGuard Mappings')}
        componentPromise={() => import('app/views/settings/projectProguard')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="performance/"
        name={t('Performance')}
        componentPromise={() => import('app/views/settings/projectPerformance')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="source-maps/"
        name={t('Source Maps')}
        componentPromise={() => import('app/views/settings/projectSourceMaps')}
        component={errorHandler(LazyLoad)}
      >
        <IndexRoute
          componentPromise={() => import('app/views/settings/projectSourceMaps/list')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path=":name/"
          name={t('Archive')}
          componentPromise={() => import('app/views/settings/projectSourceMaps/detail')}
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route
        path="processing-issues/"
        name="Processing Issues"
        componentPromise={() =>
          import('app/views/settings/project/projectProcessingIssues')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="filters/"
        name="Inbound Filters"
        componentPromise={() => import('app/views/settings/project/projectFilters')}
        component={errorHandler(LazyLoad)}
      >
        <IndexRedirect to="data-filters/" />
        <Route path=":filterType/" />
      </Route>
      <Route
        name={t('Filters & Sampling')}
        path="filters-and-sampling/"
        componentPromise={() => import('app/views/settings/project/filtersAndSampling')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="issue-grouping/"
        name={t('Issue Grouping')}
        componentPromise={() => import('app/views/settings/projectIssueGrouping')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="hooks/"
        name="Service Hooks"
        componentPromise={() => import('app/views/settings/project/projectServiceHooks')}
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="hooks/new/"
        name="Create Service Hook"
        componentPromise={() =>
          import('app/views/settings/project/projectCreateServiceHook')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route
        path="hooks/:hookId/"
        name="Service Hook Details"
        componentPromise={() =>
          import('app/views/settings/project/projectServiceHookDetails')
        }
        component={errorHandler(LazyLoad)}
      />
      <Route path="keys/" name="Client Keys">
        <IndexRoute
          componentPromise={() => import('app/views/settings/project/projectKeys/list')}
          component={errorHandler(LazyLoad)}
        />

        <Route
          path=":keyId/"
          name="Details"
          componentPromise={() =>
            import('app/views/settings/project/projectKeys/details')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route
        path="user-feedback/"
        name="User Feedback"
        componentPromise={() => import('app/views/settings/project/projectUserFeedback')}
        component={errorHandler(LazyLoad)}
      />
      <Redirect from="csp/" to="security-headers/" />
      <Route path="security-headers/" name="Security Headers">
        <IndexRoute
          componentPromise={() => import('app/views/settings/projectSecurityHeaders')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="csp/"
          name="Content Security Policy"
          componentPromise={() => import('app/views/settings/projectSecurityHeaders/csp')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="expect-ct/"
          name="Certificate Transparency"
          componentPromise={() =>
            import('app/views/settings/projectSecurityHeaders/expectCt')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="hpkp/"
          name="HPKP"
          componentPromise={() =>
            import('app/views/settings/projectSecurityHeaders/hpkp')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route path="plugins/" name="Legacy Integrations">
        <IndexRoute
          componentPromise={() => import('app/views/settings/projectPlugins')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path=":pluginId/"
          name="Integration Details"
          componentPromise={() => import('app/views/settings/projectPlugins/details')}
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route path="install/" name="Configuration">
        <IndexRoute
          componentPromise={() => import('app/views/projectInstall/overview')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path=":platform/"
          name="Docs"
          componentPromise={() =>
            import('app/views/projectInstall/platformOrIntegration')
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
        componentPromise={() => import('app/views/settings/organizationGeneralSettings')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="projects/"
        name="Projects"
        componentPromise={() => import('app/views/settings/organizationProjects')}
        component={errorHandler(LazyLoad)}
      />

      <Route path="api-keys/" name="API Key">
        <IndexRoute
          componentPromise={() => import('app/views/settings/organizationApiKeys')}
          component={errorHandler(LazyLoad)}
        />

        <Route
          path=":apiKey/"
          name="Details"
          componentPromise={() =>
            import('app/views/settings/organizationApiKeys/organizationApiKeyDetails')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Route
        path="audit-log/"
        name="Audit Log"
        componentPromise={() => import('app/views/settings/organizationAuditLog')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="auth/"
        name="Auth Providers"
        componentPromise={() => import('app/views/settings/organizationAuth')}
        component={errorHandler(LazyLoad)}
      />

      <Redirect from="members/requests" to="members/" />
      <Route path="members/" name="Members">
        <Route
          componentPromise={() =>
            import('app/views/settings/organizationMembers/organizationMembersWrapper')
          }
          component={errorHandler(LazyLoad)}
        >
          <IndexRoute
            componentPromise={() =>
              import('app/views/settings/organizationMembers/organizationMembersList')
            }
            component={errorHandler(LazyLoad)}
          />
        </Route>

        <Route
          path=":memberId/"
          name="Details"
          componentPromise={() =>
            import('app/views/settings/organizationMembers/organizationMemberDetail')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Route
        path="rate-limits/"
        name="Rate Limits"
        componentPromise={() => import('app/views/settings/organizationRateLimits')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        name={t('Relay')}
        path="relay/"
        componentPromise={() => import('app/views/settings/organizationRelay')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="repos/"
        name="Repositories"
        componentPromise={() => import('app/views/settings/organizationRepositories')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="performance/"
        name={t('Performance')}
        componentPromise={() => import('app/views/settings/organizationPerformance')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        path="settings/"
        componentPromise={() => import('app/views/settings/organizationGeneralSettings')}
        component={errorHandler(LazyLoad)}
      />

      <Route
        name={t('Security & Privacy')}
        path="security-and-privacy/"
        componentPromise={() =>
          import('app/views/settings/organizationSecurityAndPrivacy')
        }
        component={errorHandler(LazyLoad)}
      />

      <Route name="Teams" path="teams/">
        <IndexRoute
          componentPromise={() => import('app/views/settings/organizationTeams')}
          component={errorHandler(LazyLoad)}
        />

        <Route
          name="Team"
          path=":teamId/"
          componentPromise={() =>
            import('app/views/settings/organizationTeams/teamDetails')
          }
          component={errorHandler(LazyLoad)}
        >
          <IndexRedirect to="members/" />
          <Route
            path="members/"
            name="Members"
            componentPromise={() =>
              import('app/views/settings/organizationTeams/teamMembers')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="notifications/"
            name="Notifications"
            componentPromise={() =>
              import('app/views/settings/organizationTeams/teamNotifications')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="projects/"
            name="Projects"
            componentPromise={() =>
              import('app/views/settings/organizationTeams/teamProjects')
            }
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="settings/"
            name="Settings"
            componentPromise={() =>
              import('app/views/settings/organizationTeams/teamSettings')
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
            import('app/views/organizationIntegrations/pluginDetailedView')
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
            import('app/views/organizationIntegrations/sentryAppDetailedView')
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
            import('app/views/organizationIntegrations/docIntegrationDetailedView')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>
      <Route name="Integrations" path="integrations/">
        <IndexRoute
          componentPromise={() =>
            import('app/views/organizationIntegrations/integrationListDirectory')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="Integration Details"
          path=":integrationSlug"
          componentPromise={() =>
            import('app/views/organizationIntegrations/integrationDetailedView')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="Configure Integration"
          path=":providerKey/:integrationId/"
          componentPromise={() =>
            import('app/views/settings/organizationIntegrations/configureIntegration')
          }
          component={errorHandler(LazyLoad)}
        />
      </Route>

      <Route name="Developer Settings" path="developer-settings/">
        <IndexRoute
          componentPromise={() =>
            import('app/views/settings/organizationDeveloperSettings')
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="New Public Integration"
          path="new-public/"
          componentPromise={() =>
            import(
              'app/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="New Internal Integration"
          path="new-internal/"
          componentPromise={() =>
            import(
              'app/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="Edit Integration"
          path=":appSlug/"
          componentPromise={() =>
            import(
              'app/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
            )
          }
          component={errorHandler(LazyLoad)}
        />
        <Route
          name="Integration Dashboard"
          path=":appSlug/dashboard/"
          componentPromise={() =>
            import(
              'app/views/settings/organizationDeveloperSettings/sentryApplicationDashboard'
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
            componentPromise={() => import('app/views/auth/login')}
            component={errorHandler(LazyLoad)}
          />
        </Route>
      )}

      <Route path="/" component={errorHandler(App)}>
        <IndexRoute
          componentPromise={() => import('app/views/app/root')}
          component={errorHandler(LazyLoad)}
        />

        <Route
          path="/accept/:memberId/:token/"
          componentPromise={() => import('app/views/acceptOrganizationInvite')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="/accept-transfer/"
          componentPromise={() => import('app/views/acceptProjectTransfer')}
          component={errorHandler(LazyLoad)}
        />
        <Route
          path="/extensions/external-install/:integrationSlug/:installationId"
          componentPromise={() => import('app/views/integrationOrganizationLink')}
          component={errorHandler(LazyLoad)}
        />

        <Route
          path="/extensions/:integrationSlug/link/"
          getComponent={(_loc, cb) =>
            import('app/views/integrationOrganizationLink').then(lazyLoad(cb))
          }
        />

        <Route
          path="/sentry-apps/:sentryAppSlug/external-install/"
          componentPromise={() => import('app/views/sentryAppExternalInstallation')}
          component={errorHandler(LazyLoad)}
        />
        <Redirect from="/account/" to="/settings/account/details/" />

        <Redirect from="/share/group/:shareId/" to="/share/issue/:shareId/" />
        <Route
          path="/share/issue/:shareId/"
          componentPromise={() => import('app/views/sharedGroupDetails')}
          component={errorHandler(LazyLoad)}
        />

        <Route
          path="/organizations/new/"
          componentPromise={() => import('app/views/organizationCreate')}
          component={errorHandler(LazyLoad)}
        />

        <Route
          path="/organizations/:orgId/data-export/:dataExportId"
          componentPromise={() => import('app/views/dataExport/dataDownload')}
          component={errorHandler(LazyLoad)}
        />

        <Route
          path="/organizations/:orgId/disabled-member/"
          componentPromise={() => import('app/views/disabledMember')}
          component={errorHandler(LazyLoad)}
        />

        <Route
          path="/join-request/:orgId/"
          componentPromise={() => import('app/views/organizationJoinRequest')}
          component={errorHandler(LazyLoad)}
        />

        <Route path="/onboarding/:orgId/" component={errorHandler(OrganizationContext)}>
          <IndexRedirect to="welcome/" />
          <Route
            path=":step/"
            componentPromise={() => import('app/views/onboarding/onboarding')}
            component={errorHandler(LazyLoad)}
          />
        </Route>

        {/* Settings routes */}
        <Route component={errorHandler(OrganizationDetails)}>
          <Route path="/settings/" name="Settings" component={SettingsWrapper}>
            <IndexRoute
              getComponent={(_loc, cb) =>
                import('app/views/settings/settingsIndex').then(lazyLoad(cb))
              }
            />

            <Route
              path="account/"
              name="Account"
              getComponent={(_loc, cb) =>
                import('app/views/settings/account/accountSettingsLayout').then(
                  lazyLoad(cb)
                )
              }
            >
              {accountSettingsRoutes}
            </Route>

            <Route name="Organization" path=":orgId/">
              <Route
                getComponent={(_loc, cb) =>
                  import(
                    'app/views/settings/organization/organizationSettingsLayout'
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
                  import('app/views/settings/project/projectSettingsLayout').then(
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

        {/* A route tree for lightweight organizational detail views. We place
      this above the heavyweight organization detail views because there
      exist some redirects from deprecated routes which should not take
      precedence over these lightweight routes */}
        <Route component={errorHandler(LightWeightOrganizationDetails)}>
          <Route
            path="/organizations/:orgId/projects/"
            componentPromise={() => import('app/views/projectsDashboard')}
            component={errorHandler(LazyLoad)}
          />
          <Route
            path="/organizations/:orgId/dashboards/"
            componentPromise={() => import('app/views/dashboardsV2')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() => import('app/views/dashboardsV2/manage')}
              component={errorHandler(LazyLoad)}
            />
          </Route>

          <Route
            path="/organizations/:orgId/user-feedback/"
            componentPromise={() => import('app/views/userFeedback')}
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
            <Route
              path="sessionPercent"
              componentPromise={() => import('app/views/issueList/testSessionPercent')}
              component={errorHandler(LazyLoad)}
            />
          </Route>

          {/* Once org issues is complete, these routes can be nested under
          /organizations/:orgId/issues */}
          <Route
            path="/organizations/:orgId/issues/:groupId/"
            componentPromise={() => import('app/views/organizationGroupDetails')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() =>
                import('app/views/organizationGroupDetails/groupEventDetails')
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
                import('app/views/organizationGroupDetails/groupActivity')
              }
              component={errorHandler(LazyLoad)}
              props={{
                currentTab: TAB.ACTIVITY,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/events/"
              componentPromise={() =>
                import('app/views/organizationGroupDetails/groupEvents')
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
                import('app/views/organizationGroupDetails/groupTags')
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
                import('app/views/organizationGroupDetails/groupTagValues')
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
                import('app/views/organizationGroupDetails/groupUserFeedback')
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
                import('app/views/organizationGroupDetails/groupEventAttachments')
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
                import('app/views/organizationGroupDetails/groupSimilarIssues')
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
                import('app/views/organizationGroupDetails/groupMerged')
              }
              component={errorHandler(LazyLoad)}
              props={{
                currentTab: TAB.MERGED,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/grouping/"
              componentPromise={() =>
                import('app/views/organizationGroupDetails/grouping')
              }
              component={errorHandler(LazyLoad)}
              props={{
                currentTab: TAB.GROUPING,
                isEventRoute: false,
              }}
            />
            <Route path="/organizations/:orgId/issues/:groupId/events/:eventId/">
              <IndexRoute
                componentPromise={() =>
                  import('app/views/organizationGroupDetails/groupEventDetails')
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
                  import('app/views/organizationGroupDetails/groupActivity')
                }
                component={errorHandler(LazyLoad)}
                props={{
                  currentTab: TAB.ACTIVITY,
                  isEventRoute: true,
                }}
              />
              <Route
                path="events/"
                componentPromise={() =>
                  import('app/views/organizationGroupDetails/groupEvents')
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
                  import('app/views/organizationGroupDetails/groupSimilarIssues')
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
                  import('app/views/organizationGroupDetails/groupTags')
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
                  import('app/views/organizationGroupDetails/groupTagValues')
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
                  import('app/views/organizationGroupDetails/groupUserFeedback')
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
                  import('app/views/organizationGroupDetails/groupEventAttachments')
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
                  import('app/views/organizationGroupDetails/groupMerged')
                }
                component={errorHandler(LazyLoad)}
                props={{
                  currentTab: TAB.MERGED,
                  isEventRoute: true,
                }}
              />
              <Route
                path="grouping/"
                componentPromise={() =>
                  import('app/views/organizationGroupDetails/grouping')
                }
                component={errorHandler(LazyLoad)}
                props={{
                  currentTab: TAB.GROUPING,
                  isEventRoute: true,
                }}
              />
            </Route>
          </Route>

          <Route
            path="/organizations/:orgId/alerts/"
            componentPromise={() => import('app/views/alerts')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() => import('app/views/alerts/list')}
              component={errorHandler(LazyLoad)}
            />

            <Route
              path="rules/details/:ruleId/"
              name="Alert Rule Details"
              component={errorHandler(LazyLoad)}
              componentPromise={() => import('app/views/alerts/rules/details')}
            />

            <Route path="rules/">
              <IndexRoute
                component={errorHandler(LazyLoad)}
                componentPromise={() => import('app/views/alerts/rules')}
              />
              <Route
                path=":projectId/"
                componentPromise={() =>
                  import('app/views/alerts/builder/projectProvider')
                }
                component={errorHandler(LazyLoad)}
              >
                <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
                <Route
                  path=":ruleId/"
                  name="Edit Alert Rule"
                  componentPromise={() => import('app/views/alerts/edit')}
                  component={errorHandler(LazyLoad)}
                />
              </Route>
            </Route>

            <Route path="metric-rules/">
              <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
              <Route
                path=":projectId/"
                componentPromise={() =>
                  import('app/views/alerts/builder/projectProvider')
                }
                component={errorHandler(LazyLoad)}
              >
                <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
                <Route
                  path=":ruleId/"
                  name="Edit Alert Rule"
                  componentPromise={() => import('app/views/alerts/edit')}
                  component={errorHandler(LazyLoad)}
                />
              </Route>
            </Route>

            <Route
              path="rules/"
              componentPromise={() => import('app/views/alerts/rules')}
              component={errorHandler(LazyLoad)}
            />

            <Route
              path=":alertId/"
              componentPromise={() => import('app/views/alerts/details')}
              component={errorHandler(LazyLoad)}
            />

            <Route
              path=":projectId/"
              componentPromise={() => import('app/views/alerts/builder/projectProvider')}
              component={errorHandler(LazyLoad)}
            >
              <Route
                path="new/"
                name="New Alert Rule"
                component={errorHandler(LazyLoad)}
                componentPromise={() => import('app/views/alerts/create')}
              />
              <Route
                path="wizard/"
                name="Alert Creation Wizard"
                component={errorHandler(LazyLoad)}
                componentPromise={() => import('app/views/alerts/wizard')}
              />
            </Route>
          </Route>

          <Route
            path="/organizations/:orgId/monitors/"
            componentPromise={() => import('app/views/monitors')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() => import('app/views/monitors/monitors')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/monitors/create/"
              componentPromise={() => import('app/views/monitors/create')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/monitors/:monitorId/"
              componentPromise={() => import('app/views/monitors/details')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/monitors/:monitorId/edit/"
              componentPromise={() => import('app/views/monitors/edit')}
              component={errorHandler(LazyLoad)}
            />
          </Route>

          <Route
            path="/organizations/:orgId/releases/"
            componentPromise={() => import('app/views/releases')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() => import('app/views/releases/list')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              path=":release/"
              componentPromise={() => import('app/views/releases/detail')}
              component={errorHandler(LazyLoad)}
            >
              <IndexRoute
                componentPromise={() => import('app/views/releases/detail/overview')}
                component={errorHandler(LazyLoad)}
              />
              <Route
                path="commits/"
                componentPromise={() => import('app/views/releases/detail/commits')}
                component={errorHandler(LazyLoad)}
              />
              <Route
                path="files-changed/"
                componentPromise={() => import('app/views/releases/detail/filesChanged')}
                component={errorHandler(LazyLoad)}
              />
              <Redirect
                from="new-events/"
                to="/organizations/:orgId/releases/:release/"
              />
              <Redirect
                from="all-events/"
                to="/organizations/:orgId/releases/:release/"
              />
            </Route>
          </Route>

          <Route
            path="/organizations/:orgId/activity/"
            componentPromise={() => import('app/views/organizationActivity')}
            component={errorHandler(LazyLoad)}
          />

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
            path="/organizations/:orgId/projects/:projectId/events/:eventId/"
            component={errorHandler(ProjectEventRedirect)}
          />

          {/*
        TODO(mark) Long term this /queries route should go away and /discover should be the
        canonical route for discover2. We have a redirect right now as /discover was for
        discover 1 and most of the application is linking to /discover/queries and not /discover
        */}
          <Redirect
            from="/organizations/:orgId/discover/"
            to="/organizations/:orgId/discover/queries/"
          />
          <Route
            path="/organizations/:orgId/discover/"
            componentPromise={() => import('app/views/eventsV2')}
            component={errorHandler(LazyLoad)}
          >
            <Route
              path="queries/"
              componentPromise={() => import('app/views/eventsV2/landing')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="results/"
              componentPromise={() => import('app/views/eventsV2/results')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              path=":eventSlug/"
              componentPromise={() => import('app/views/eventsV2/eventDetails')}
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/"
            componentPromise={() => import('app/views/performance')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/content')}
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/trends/"
            componentPromise={() => import('app/views/performance')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/trends')}
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/summary/"
            componentPromise={() => import('app/views/performance')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/transactionSummary')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/performance/summary/vitals/"
              componentPromise={() =>
                import('app/views/performance/transactionSummary/transactionVitals')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/performance/summary/tags/"
              componentPromise={() =>
                import('app/views/performance/transactionSummary/transactionTags')
              }
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="/organizations/:orgId/performance/summary/events/"
              componentPromise={() =>
                import('app/views/performance/transactionSummary/transactionEvents')
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/vitaldetail/"
            componentPromise={() => import('app/views/performance')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/vitalDetail')}
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/trace/:traceSlug/"
            componentPromise={() => import('app/views/performance')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/traceDetails')}
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/:eventSlug/"
            componentPromise={() => import('app/views/performance')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/transactionDetails')}
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/compare/:baselineEventSlug/:regressionEventSlug/"
            componentPromise={() => import('app/views/performance')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/compare')}
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path="/organizations/:orgId/dashboards/new/"
            componentPromise={() => import('app/views/dashboardsV2/create')}
            component={errorHandler(LazyLoad)}
          >
            <Route
              path="widget/:widgetId/edit/"
              componentPromise={() => import('app/views/dashboardsV2/widget')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="widget/new/"
              componentPromise={() => import('app/views/dashboardsV2/widget')}
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Redirect
            from="/organizations/:orgId/dashboards/:dashboardId/"
            to="/organizations/:orgId/dashboard/:dashboardId/"
          />
          <Route
            path="/organizations/:orgId/dashboard/:dashboardId/"
            componentPromise={() => import('app/views/dashboardsV2/view')}
            component={errorHandler(LazyLoad)}
          >
            <Route
              path="widget/:widgetId/edit/"
              componentPromise={() => import('app/views/dashboardsV2/widget')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              path="widget/new/"
              componentPromise={() => import('app/views/dashboardsV2/widget')}
              component={errorHandler(LazyLoad)}
            />
          </Route>

          {/* Admin/manage routes */}
          <Route
            name="Admin"
            path="/manage/"
            componentPromise={() => import('app/views/admin/adminLayout')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() => import('app/views/admin/adminOverview')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              name="Buffer"
              path="buffer/"
              componentPromise={() => import('app/views/admin/adminBuffer')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              name="Relays"
              path="relays/"
              componentPromise={() => import('app/views/admin/adminRelays')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              name="Organizations"
              path="organizations/"
              componentPromise={() => import('app/views/admin/adminOrganizations')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              name="Projects"
              path="projects/"
              componentPromise={() => import('app/views/admin/adminProjects')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              name="Queue"
              path="queue/"
              componentPromise={() => import('app/views/admin/adminQueue')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              name="Quotas"
              path="quotas/"
              componentPromise={() => import('app/views/admin/adminQuotas')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              name="Settings"
              path="settings/"
              componentPromise={() => import('app/views/admin/adminSettings')}
              component={errorHandler(LazyLoad)}
            />
            <Route name="Users" path="users/">
              <IndexRoute
                componentPromise={() => import('app/views/admin/adminUsers')}
                component={errorHandler(LazyLoad)}
              />
              <Route
                path=":id"
                componentPromise={() => import('app/views/admin/adminUserEdit')}
                component={errorHandler(LazyLoad)}
              />
            </Route>
            <Route
              name="Mail"
              path="status/mail/"
              componentPromise={() => import('app/views/admin/adminMail')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              name="Environment"
              path="status/environment/"
              componentPromise={() => import('app/views/admin/adminEnvironment')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              name="Packages"
              path="status/packages/"
              componentPromise={() => import('app/views/admin/adminPackages')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              name="Warnings"
              path="status/warnings/"
              componentPromise={() => import('app/views/admin/adminWarnings')}
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
              path="/organizations/:orgId/projects/:projectId/getting-started/"
              componentPromise={() => import('app/views/projectInstall/gettingStarted')}
              component={errorHandler(LazyLoad)}
            >
              <IndexRoute
                componentPromise={() => import('app/views/projectInstall/overview')}
                component={errorHandler(LazyLoad)}
              />
              <Route
                path=":platform/"
                componentPromise={() =>
                  import('app/views/projectInstall/platformOrIntegration')
                }
                component={errorHandler(LazyLoad)}
              />
            </Route>

            <Route
              path="/organizations/:orgId/teams/new/"
              componentPromise={() => import('app/views/teamCreate')}
              component={errorHandler(LazyLoad)}
            />

            <Route path="/organizations/:orgId/">
              {hook('routes:organization')}
              <Redirect
                from="/organizations/:orgId/teams/"
                to="/settings/:orgId/teams/"
              />
              <Redirect
                from="/organizations/:orgId/teams/your-teams/"
                to="/settings/:orgId/teams/"
              />
              <Redirect
                from="/organizations/:orgId/teams/all-teams/"
                to="/settings/:orgId/teams/"
              />
              <Redirect
                from="/organizations/:orgId/teams/:teamId/"
                to="/settings/:orgId/teams/:teamId/"
              />
              <Redirect
                from="/organizations/:orgId/teams/:teamId/members/"
                to="/settings/:orgId/teams/:teamId/members/"
              />
              <Redirect
                from="/organizations/:orgId/teams/:teamId/projects/"
                to="/settings/:orgId/teams/:teamId/projects/"
              />
              <Redirect
                from="/organizations/:orgId/teams/:teamId/settings/"
                to="/settings/:orgId/teams/:teamId/settings/"
              />
              <Redirect from="/organizations/:orgId/settings/" to="/settings/:orgId/" />
              <Redirect
                from="/organizations/:orgId/api-keys/"
                to="/settings/:orgId/api-keys/"
              />
              <Redirect
                from="/organizations/:orgId/api-keys/:apiKey/"
                to="/settings/:orgId/api-keys/:apiKey/"
              />
              <Redirect
                from="/organizations/:orgId/members/"
                to="/settings/:orgId/members/"
              />
              <Redirect
                from="/organizations/:orgId/members/:memberId/"
                to="/settings/:orgId/members/:memberId/"
              />
              <Redirect
                from="/organizations/:orgId/rate-limits/"
                to="/settings/:orgId/rate-limits/"
              />
              <Redirect
                from="/organizations/:orgId/repos/"
                to="/settings/:orgId/repos/"
              />
            </Route>
            <Route
              path="/organizations/:orgId/projects/new/"
              componentPromise={() => import('app/views/projectInstall/newProject')}
              component={errorHandler(LazyLoad)}
            />
          </Route>
          <Route
            path=":projectId/getting-started/"
            componentPromise={() => import('app/views/projectInstall/gettingStarted')}
            component={errorHandler(LazyLoad)}
          >
            <IndexRoute
              componentPromise={() => import('app/views/projectInstall/overview')}
              component={errorHandler(LazyLoad)}
            />
            <Route
              path=":platform/"
              componentPromise={() =>
                import('app/views/projectInstall/platformOrIntegration')
              }
              component={errorHandler(LazyLoad)}
            />
          </Route>
        </Route>

        {/* A route tree for lightweight organizational detail views.
          This is strictly for deprecated URLs that we need to maintain */}
        <Route component={errorHandler(LightWeightOrganizationDetails)}>
          {/* This is in the bottom lightweight group because "/organizations/:orgId/projects/new/" in heavyweight needs to be matched first */}
          <Route
            path="/organizations/:orgId/projects/:projectId/"
            componentPromise={() => import('app/views/projectDetail')}
            component={errorHandler(LazyLoad)}
          />

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
