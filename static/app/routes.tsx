import * as React from 'react';
import {
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
import {Tab} from 'app/views/organizationGroupDetails/types';
import OrganizationRoot from 'app/views/organizationRoot';
import ProjectEventRedirect from 'app/views/projectEventRedirect';
import redirectDeprecatedProjectRoute from 'app/views/projects/redirectDeprecatedProjectRoute';
import RouteNotFound from 'app/views/routeNotFound';
import SettingsProjectProvider from 'app/views/settings/components/settingsProjectProvider';
import SettingsWrapper from 'app/views/settings/components/settingsWrapper';

type CustomProps = {
  name?: string;
  componentPromise?: () => Promise<any>;
};

/**
 * We add some additional props to our routes
 */

const Route = BaseRoute as React.ComponentClass<RouteProps & CustomProps>;
const IndexRoute = BaseIndexRoute as React.ComponentClass<IndexRouteProps & CustomProps>;

/**
 * Use react-router to lazy load a route. Use this for codesplitting containers
 * (e.g. SettingsLayout)
 *
 * The typical method for lazy loading a route leaf node is using the
 * <LazyLoad> component + `componentPromise`
 *
 * For wrapper / layout views react-router handles the route tree better by
 * using getComponent with this lazyLoad helper. If we just use <LazyLoad> it
 * will end up having to re-render more components than necessary.
 */
const lazyLoad =
  (load: () => Promise<any>): RouteProps['getComponent'] =>
  (_loc, cb) =>
    load().then(module => cb(null, module.default));

const hook = (name: HookName) => HookStore.get(name).map(cb => cb());

const SafeLazyLoad = errorHandler(LazyLoad);

function routes() {
  const accountSettingsRoutes = (
    <React.Fragment>
      <IndexRedirect to="details/" />

      <Route
        path="details/"
        name="Details"
        componentPromise={() => import('app/views/settings/account/accountDetails')}
        component={SafeLazyLoad}
      />

      <Route path="notifications/" name="Notifications">
        <IndexRoute
          componentPromise={() =>
            import('app/views/settings/account/accountNotifications')
          }
          component={SafeLazyLoad}
        />
        <Route
          path=":fineTuneType/"
          name="Fine Tune Alerts"
          componentPromise={() =>
            import('app/views/settings/account/accountNotificationFineTuning')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        path="emails/"
        name="Emails"
        componentPromise={() => import('app/views/settings/account/accountEmails')}
        component={SafeLazyLoad}
      />

      <Route
        path="authorizations/"
        componentPromise={() =>
          import('app/views/settings/account/accountAuthorizations')
        }
        component={SafeLazyLoad}
      />

      <Route name="Security" path="security/">
        <Route
          componentPromise={() =>
            import('app/views/settings/account/accountSecurity/accountSecurityWrapper')
          }
          component={SafeLazyLoad}
        >
          <IndexRoute
            componentPromise={() => import('app/views/settings/account/accountSecurity')}
            component={SafeLazyLoad}
          />
          <Route
            path="session-history/"
            name="Session History"
            componentPromise={() =>
              import('app/views/settings/account/accountSecurity/sessionHistory')
            }
            component={SafeLazyLoad}
          />
          <Route
            path="mfa/:authId/"
            name="Details"
            componentPromise={() =>
              import('app/views/settings/account/accountSecurity/accountSecurityDetails')
            }
            component={SafeLazyLoad}
          />
        </Route>

        <Route
          path="mfa/:authId/enroll/"
          name="Enroll"
          componentPromise={() =>
            import('app/views/settings/account/accountSecurity/accountSecurityEnroll')
          }
          component={SafeLazyLoad}
        />
      </Route>

      <Route
        path="subscriptions/"
        name="Subscriptions"
        componentPromise={() => import('app/views/settings/account/accountSubscriptions')}
        component={SafeLazyLoad}
      />

      <Route
        path="identities/"
        name="Identities"
        componentPromise={() => import('app/views/settings/account/accountIdentities')}
        component={SafeLazyLoad}
      />

      <Route path="api/" name="API">
        <IndexRedirect to="auth-tokens/" />

        <Route path="auth-tokens/" name="Auth Tokens">
          <IndexRoute
            componentPromise={() => import('app/views/settings/account/apiTokens')}
            component={SafeLazyLoad}
          />
          <Route
            path="new-token/"
            name="Create New Token"
            componentPromise={() => import('app/views/settings/account/apiNewToken')}
            component={SafeLazyLoad}
          />
        </Route>

        <Route path="applications/" name="Applications">
          <IndexRoute
            componentPromise={() => import('app/views/settings/account/apiApplications')}
            component={SafeLazyLoad}
          />
          <Route
            path=":appId/"
            name="Details"
            componentPromise={() =>
              import('app/views/settings/account/apiApplications/details')
            }
            component={SafeLazyLoad}
          />
        </Route>

        {hook('routes:api')}
      </Route>

      <Route
        path="close-account/"
        name="Close Account"
        componentPromise={() => import('app/views/settings/account/accountClose')}
        component={SafeLazyLoad}
      />
    </React.Fragment>
  );

  const projectSettingsRoutes = (
    <React.Fragment>
      <IndexRoute
        name="General"
        componentPromise={() => import('app/views/settings/projectGeneralSettings')}
        component={SafeLazyLoad}
      />
      <Route
        path="teams/"
        name="Teams"
        componentPromise={() => import('app/views/settings/project/projectTeams')}
        component={SafeLazyLoad}
      />

      <Route
        name="Alerts"
        path="alerts/"
        component={SafeLazyLoad}
        componentPromise={() => import('app/views/settings/projectAlerts')}
      >
        <IndexRoute
          component={SafeLazyLoad}
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
        component={SafeLazyLoad}
      >
        <IndexRoute />
        <Route path="hidden/" />
      </Route>
      <Route
        name="Tags"
        path="tags/"
        componentPromise={() => import('app/views/settings/projectTags')}
        component={SafeLazyLoad}
      />
      <Redirect from="issue-tracking/" to="/settings/:orgId/:projectId/plugins/" />
      <Route
        path="release-tracking/"
        name="Release Tracking"
        componentPromise={() =>
          import('app/views/settings/project/projectReleaseTracking')
        }
        component={SafeLazyLoad}
      />
      <Route
        path="ownership/"
        name="Issue Owners"
        componentPromise={() => import('app/views/settings/project/projectOwnership')}
        component={SafeLazyLoad}
      />
      <Route
        path="data-forwarding/"
        name="Data Forwarding"
        componentPromise={() => import('app/views/settings/projectDataForwarding')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Security & Privacy')}
        path="security-and-privacy/"
        component={SafeLazyLoad}
        componentPromise={() => import('app/views/settings/projectSecurityAndPrivacy')}
      />
      <Route
        path="debug-symbols/"
        name="Debug Information Files"
        componentPromise={() => import('app/views/settings/projectDebugFiles')}
        component={SafeLazyLoad}
      />
      <Route
        path="proguard/"
        name={t('ProGuard Mappings')}
        componentPromise={() => import('app/views/settings/projectProguard')}
        component={SafeLazyLoad}
      />
      <Route
        path="performance/"
        name={t('Performance')}
        componentPromise={() => import('app/views/settings/projectPerformance')}
        component={SafeLazyLoad}
      />
      <Route
        path="source-maps/"
        name={t('Source Maps')}
        componentPromise={() => import('app/views/settings/projectSourceMaps')}
        component={SafeLazyLoad}
      >
        <IndexRoute
          componentPromise={() => import('app/views/settings/projectSourceMaps/list')}
          component={SafeLazyLoad}
        />
        <Route
          path=":name/"
          name={t('Archive')}
          componentPromise={() => import('app/views/settings/projectSourceMaps/detail')}
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        path="processing-issues/"
        name="Processing Issues"
        componentPromise={() =>
          import('app/views/settings/project/projectProcessingIssues')
        }
        component={SafeLazyLoad}
      />
      <Route
        path="filters/"
        name="Inbound Filters"
        componentPromise={() => import('app/views/settings/project/projectFilters')}
        component={SafeLazyLoad}
      >
        <IndexRedirect to="data-filters/" />
        <Route path=":filterType/" />
      </Route>
      <Route
        name={t('Filters & Sampling')}
        path="filters-and-sampling/"
        componentPromise={() => import('app/views/settings/project/filtersAndSampling')}
        component={SafeLazyLoad}
      />
      <Route
        path="issue-grouping/"
        name={t('Issue Grouping')}
        componentPromise={() => import('app/views/settings/projectIssueGrouping')}
        component={SafeLazyLoad}
      />
      <Route
        path="hooks/"
        name="Service Hooks"
        componentPromise={() => import('app/views/settings/project/projectServiceHooks')}
        component={SafeLazyLoad}
      />
      <Route
        path="hooks/new/"
        name="Create Service Hook"
        componentPromise={() =>
          import('app/views/settings/project/projectCreateServiceHook')
        }
        component={SafeLazyLoad}
      />
      <Route
        path="hooks/:hookId/"
        name="Service Hook Details"
        componentPromise={() =>
          import('app/views/settings/project/projectServiceHookDetails')
        }
        component={SafeLazyLoad}
      />
      <Route path="keys/" name="Client Keys">
        <IndexRoute
          componentPromise={() => import('app/views/settings/project/projectKeys/list')}
          component={SafeLazyLoad}
        />

        <Route
          path=":keyId/"
          name="Details"
          componentPromise={() =>
            import('app/views/settings/project/projectKeys/details')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        path="user-feedback/"
        name="User Feedback"
        componentPromise={() => import('app/views/settings/project/projectUserFeedback')}
        component={SafeLazyLoad}
      />
      <Redirect from="csp/" to="security-headers/" />
      <Route path="security-headers/" name="Security Headers">
        <IndexRoute
          componentPromise={() => import('app/views/settings/projectSecurityHeaders')}
          component={SafeLazyLoad}
        />
        <Route
          path="csp/"
          name="Content Security Policy"
          componentPromise={() => import('app/views/settings/projectSecurityHeaders/csp')}
          component={SafeLazyLoad}
        />
        <Route
          path="expect-ct/"
          name="Certificate Transparency"
          componentPromise={() =>
            import('app/views/settings/projectSecurityHeaders/expectCt')
          }
          component={SafeLazyLoad}
        />
        <Route
          path="hpkp/"
          name="HPKP"
          componentPromise={() =>
            import('app/views/settings/projectSecurityHeaders/hpkp')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route path="plugins/" name="Legacy Integrations">
        <IndexRoute
          componentPromise={() => import('app/views/settings/projectPlugins')}
          component={SafeLazyLoad}
        />
        <Route
          path=":pluginId/"
          name="Integration Details"
          componentPromise={() => import('app/views/settings/projectPlugins/details')}
          component={SafeLazyLoad}
        />
      </Route>
      <Route path="install/" name="Configuration">
        <IndexRoute
          componentPromise={() => import('app/views/projectInstall/overview')}
          component={SafeLazyLoad}
        />
        <Route
          path=":platform/"
          name="Docs"
          componentPromise={() =>
            import('app/views/projectInstall/platformOrIntegration')
          }
          component={SafeLazyLoad}
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
        component={SafeLazyLoad}
      />

      <Route
        path="projects/"
        name="Projects"
        componentPromise={() => import('app/views/settings/organizationProjects')}
        component={SafeLazyLoad}
      />

      <Route path="api-keys/" name="API Key">
        <IndexRoute
          componentPromise={() => import('app/views/settings/organizationApiKeys')}
          component={SafeLazyLoad}
        />

        <Route
          path=":apiKey/"
          name="Details"
          componentPromise={() =>
            import('app/views/settings/organizationApiKeys/organizationApiKeyDetails')
          }
          component={SafeLazyLoad}
        />
      </Route>

      <Route
        path="audit-log/"
        name="Audit Log"
        componentPromise={() => import('app/views/settings/organizationAuditLog')}
        component={SafeLazyLoad}
      />

      <Route
        path="auth/"
        name="Auth Providers"
        componentPromise={() => import('app/views/settings/organizationAuth')}
        component={SafeLazyLoad}
      />

      <Redirect from="members/requests" to="members/" />
      <Route path="members/" name="Members">
        <Route
          componentPromise={() =>
            import('app/views/settings/organizationMembers/organizationMembersWrapper')
          }
          component={SafeLazyLoad}
        >
          <IndexRoute
            componentPromise={() =>
              import('app/views/settings/organizationMembers/organizationMembersList')
            }
            component={SafeLazyLoad}
          />
        </Route>

        <Route
          path=":memberId/"
          name="Details"
          componentPromise={() =>
            import('app/views/settings/organizationMembers/organizationMemberDetail')
          }
          component={SafeLazyLoad}
        />
      </Route>

      <Route
        path="rate-limits/"
        name="Rate Limits"
        componentPromise={() => import('app/views/settings/organizationRateLimits')}
        component={SafeLazyLoad}
      />

      <Route
        name={t('Relay')}
        path="relay/"
        componentPromise={() => import('app/views/settings/organizationRelay')}
        component={SafeLazyLoad}
      />

      <Route
        path="repos/"
        name="Repositories"
        componentPromise={() => import('app/views/settings/organizationRepositories')}
        component={SafeLazyLoad}
      />

      <Route
        path="performance/"
        name={t('Performance')}
        componentPromise={() => import('app/views/settings/organizationPerformance')}
        component={SafeLazyLoad}
      />

      <Route
        path="settings/"
        componentPromise={() => import('app/views/settings/organizationGeneralSettings')}
        component={SafeLazyLoad}
      />

      <Route
        name={t('Security & Privacy')}
        path="security-and-privacy/"
        componentPromise={() =>
          import('app/views/settings/organizationSecurityAndPrivacy')
        }
        component={SafeLazyLoad}
      />

      <Route name="Teams" path="teams/">
        <IndexRoute
          componentPromise={() => import('app/views/settings/organizationTeams')}
          component={SafeLazyLoad}
        />

        <Route
          name="Team"
          path=":teamId/"
          componentPromise={() =>
            import('app/views/settings/organizationTeams/teamDetails')
          }
          component={SafeLazyLoad}
        >
          <IndexRedirect to="members/" />
          <Route
            path="members/"
            name="Members"
            componentPromise={() =>
              import('app/views/settings/organizationTeams/teamMembers')
            }
            component={SafeLazyLoad}
          />
          <Route
            path="notifications/"
            name="Notifications"
            componentPromise={() =>
              import('app/views/settings/organizationTeams/teamNotifications')
            }
            component={SafeLazyLoad}
          />
          <Route
            path="projects/"
            name="Projects"
            componentPromise={() =>
              import('app/views/settings/organizationTeams/teamProjects')
            }
            component={SafeLazyLoad}
          />
          <Route
            path="settings/"
            name="Settings"
            componentPromise={() =>
              import('app/views/settings/organizationTeams/teamSettings')
            }
            component={SafeLazyLoad}
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
          component={SafeLazyLoad}
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
          component={SafeLazyLoad}
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
          component={SafeLazyLoad}
        />
      </Route>
      <Route name="Integrations" path="integrations/">
        <IndexRoute
          componentPromise={() =>
            import('app/views/organizationIntegrations/integrationListDirectory')
          }
          component={SafeLazyLoad}
        />
        <Route
          name="Integration Details"
          path=":integrationSlug"
          componentPromise={() =>
            import('app/views/organizationIntegrations/integrationDetailedView')
          }
          component={SafeLazyLoad}
        />
        <Route
          name="Configure Integration"
          path=":providerKey/:integrationId/"
          componentPromise={() =>
            import('app/views/settings/organizationIntegrations/configureIntegration')
          }
          component={SafeLazyLoad}
        />
      </Route>

      <Route name="Developer Settings" path="developer-settings/">
        <IndexRoute
          componentPromise={() =>
            import('app/views/settings/organizationDeveloperSettings')
          }
          component={SafeLazyLoad}
        />
        <Route
          name="New Public Integration"
          path="new-public/"
          componentPromise={() =>
            import(
              'app/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
            )
          }
          component={SafeLazyLoad}
        />
        <Route
          name="New Internal Integration"
          path="new-internal/"
          componentPromise={() =>
            import(
              'app/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
            )
          }
          component={SafeLazyLoad}
        />
        <Route
          name="Edit Integration"
          path=":appSlug/"
          componentPromise={() =>
            import(
              'app/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
            )
          }
          component={SafeLazyLoad}
        />
        <Route
          name="Integration Dashboard"
          path=":appSlug/dashboard/"
          componentPromise={() =>
            import(
              'app/views/settings/organizationDeveloperSettings/sentryApplicationDashboard'
            )
          }
          component={SafeLazyLoad}
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
            component={SafeLazyLoad}
          />
        </Route>
      )}

      <Route path="/" component={errorHandler(App)}>
        <IndexRoute
          componentPromise={() => import('app/views/app/root')}
          component={SafeLazyLoad}
        />

        <Route
          path="/accept/:memberId/:token/"
          componentPromise={() => import('app/views/acceptOrganizationInvite')}
          component={SafeLazyLoad}
        />
        <Route
          path="/accept-transfer/"
          componentPromise={() => import('app/views/acceptProjectTransfer')}
          component={SafeLazyLoad}
        />
        <Route
          path="/extensions/external-install/:integrationSlug/:installationId"
          componentPromise={() => import('app/views/integrationOrganizationLink')}
          component={SafeLazyLoad}
        />

        <Route
          path="/extensions/:integrationSlug/link/"
          getComponent={lazyLoad(() => import('app/views/integrationOrganizationLink'))}
        />

        <Route
          path="/sentry-apps/:sentryAppSlug/external-install/"
          componentPromise={() => import('app/views/sentryAppExternalInstallation')}
          component={SafeLazyLoad}
        />
        <Redirect from="/account/" to="/settings/account/details/" />

        <Redirect from="/share/group/:shareId/" to="/share/issue/:shareId/" />
        <Route
          path="/share/issue/:shareId/"
          componentPromise={() => import('app/views/sharedGroupDetails')}
          component={SafeLazyLoad}
        />

        <Route
          path="/organizations/new/"
          componentPromise={() => import('app/views/organizationCreate')}
          component={SafeLazyLoad}
        />

        <Route
          path="/organizations/:orgId/data-export/:dataExportId"
          componentPromise={() => import('app/views/dataExport/dataDownload')}
          component={SafeLazyLoad}
        />

        <Route
          path="/organizations/:orgId/disabled-member/"
          componentPromise={() => import('app/views/disabledMember')}
          component={SafeLazyLoad}
        />

        <Route
          path="/join-request/:orgId/"
          componentPromise={() => import('app/views/organizationJoinRequest')}
          component={SafeLazyLoad}
        />

        <Route path="/onboarding/:orgId/" component={errorHandler(OrganizationContext)}>
          <IndexRedirect to="welcome/" />
          <Route
            path=":step/"
            componentPromise={() => import('app/views/onboarding/onboarding')}
            component={SafeLazyLoad}
          />
        </Route>

        {/* Settings routes */}
        <Route component={errorHandler(OrganizationDetails)}>
          <Route path="/settings/" name="Settings" component={SettingsWrapper}>
            <IndexRoute
              getComponent={lazyLoad(() => import('app/views/settings/settingsIndex'))}
            />

            <Route
              path="account/"
              name="Account"
              getComponent={lazyLoad(
                () => import('app/views/settings/account/accountSettingsLayout')
              )}
            >
              {accountSettingsRoutes}
            </Route>

            <Route name="Organization" path=":orgId/">
              <Route
                getComponent={lazyLoad(
                  () =>
                    import('app/views/settings/organization/organizationSettingsLayout')
                )}
              >
                {hook('routes:organization')}
                {orgSettingsRoutes}
              </Route>

              <Route
                name="Project"
                path="projects/:projectId/"
                getComponent={lazyLoad(
                  () => import('app/views/settings/project/projectSettingsLayout')
                )}
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
            component={SafeLazyLoad}
          />
          <Route
            path="/organizations/:orgId/dashboards/"
            componentPromise={() => import('app/views/dashboardsV2')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() => import('app/views/dashboardsV2/manage')}
              component={SafeLazyLoad}
            />
          </Route>

          <Route
            path="/organizations/:orgId/user-feedback/"
            componentPromise={() => import('app/views/userFeedback')}
            component={SafeLazyLoad}
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
              component={SafeLazyLoad}
            />
          </Route>

          {/* Once org issues is complete, these routes can be nested under
          /organizations/:orgId/issues */}
          <Route
            path="/organizations/:orgId/issues/:groupId/"
            componentPromise={() => import('app/views/organizationGroupDetails')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() =>
                import('app/views/organizationGroupDetails/groupEventDetails')
              }
              component={SafeLazyLoad}
              props={{
                currentTab: Tab.DETAILS,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/activity/"
              componentPromise={() =>
                import('app/views/organizationGroupDetails/groupActivity')
              }
              component={SafeLazyLoad}
              props={{
                currentTab: Tab.ACTIVITY,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/events/"
              componentPromise={() =>
                import('app/views/organizationGroupDetails/groupEvents')
              }
              component={SafeLazyLoad}
              props={{
                currentTab: Tab.EVENTS,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/tags/"
              componentPromise={() =>
                import('app/views/organizationGroupDetails/groupTags')
              }
              component={SafeLazyLoad}
              props={{
                currentTab: Tab.TAGS,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/tags/:tagKey/"
              componentPromise={() =>
                import('app/views/organizationGroupDetails/groupTagValues')
              }
              component={SafeLazyLoad}
              props={{
                currentTab: Tab.TAGS,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/feedback/"
              componentPromise={() =>
                import('app/views/organizationGroupDetails/groupUserFeedback')
              }
              component={SafeLazyLoad}
              props={{
                currentTab: Tab.USER_FEEDBACK,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/attachments/"
              componentPromise={() =>
                import('app/views/organizationGroupDetails/groupEventAttachments')
              }
              component={SafeLazyLoad}
              props={{
                currentTab: Tab.ATTACHMENTS,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/similar/"
              componentPromise={() =>
                import('app/views/organizationGroupDetails/groupSimilarIssues')
              }
              component={SafeLazyLoad}
              props={{
                currentTab: Tab.SIMILAR_ISSUES,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/merged/"
              componentPromise={() =>
                import('app/views/organizationGroupDetails/groupMerged')
              }
              component={SafeLazyLoad}
              props={{
                currentTab: Tab.MERGED,
                isEventRoute: false,
              }}
            />
            <Route
              path="/organizations/:orgId/issues/:groupId/grouping/"
              componentPromise={() =>
                import('app/views/organizationGroupDetails/grouping')
              }
              component={SafeLazyLoad}
              props={{
                currentTab: Tab.GROUPING,
                isEventRoute: false,
              }}
            />
            <Route path="/organizations/:orgId/issues/:groupId/events/:eventId/">
              <IndexRoute
                componentPromise={() =>
                  import('app/views/organizationGroupDetails/groupEventDetails')
                }
                component={SafeLazyLoad}
                props={{
                  currentTab: Tab.DETAILS,
                  isEventRoute: true,
                }}
              />
              <Route
                path="activity/"
                componentPromise={() =>
                  import('app/views/organizationGroupDetails/groupActivity')
                }
                component={SafeLazyLoad}
                props={{
                  currentTab: Tab.ACTIVITY,
                  isEventRoute: true,
                }}
              />
              <Route
                path="events/"
                componentPromise={() =>
                  import('app/views/organizationGroupDetails/groupEvents')
                }
                component={SafeLazyLoad}
                props={{
                  currentTab: Tab.EVENTS,
                  isEventRoute: true,
                }}
              />
              <Route
                path="similar/"
                componentPromise={() =>
                  import('app/views/organizationGroupDetails/groupSimilarIssues')
                }
                component={SafeLazyLoad}
                props={{
                  currentTab: Tab.SIMILAR_ISSUES,
                  isEventRoute: true,
                }}
              />
              <Route
                path="tags/"
                componentPromise={() =>
                  import('app/views/organizationGroupDetails/groupTags')
                }
                component={SafeLazyLoad}
                props={{
                  currentTab: Tab.TAGS,
                  isEventRoute: true,
                }}
              />
              <Route
                path="tags/:tagKey/"
                componentPromise={() =>
                  import('app/views/organizationGroupDetails/groupTagValues')
                }
                component={SafeLazyLoad}
                props={{
                  currentTab: Tab.TAGS,
                  isEventRoute: true,
                }}
              />
              <Route
                path="feedback/"
                componentPromise={() =>
                  import('app/views/organizationGroupDetails/groupUserFeedback')
                }
                component={SafeLazyLoad}
                props={{
                  currentTab: Tab.USER_FEEDBACK,
                  isEventRoute: true,
                }}
              />
              <Route
                path="attachments/"
                componentPromise={() =>
                  import('app/views/organizationGroupDetails/groupEventAttachments')
                }
                component={SafeLazyLoad}
                props={{
                  currentTab: Tab.ATTACHMENTS,
                  isEventRoute: true,
                }}
              />
              <Route
                path="merged/"
                componentPromise={() =>
                  import('app/views/organizationGroupDetails/groupMerged')
                }
                component={SafeLazyLoad}
                props={{
                  currentTab: Tab.MERGED,
                  isEventRoute: true,
                }}
              />
              <Route
                path="grouping/"
                componentPromise={() =>
                  import('app/views/organizationGroupDetails/grouping')
                }
                component={SafeLazyLoad}
                props={{
                  currentTab: Tab.GROUPING,
                  isEventRoute: true,
                }}
              />
            </Route>
          </Route>

          <Route
            path="/organizations/:orgId/alerts/"
            componentPromise={() => import('app/views/alerts')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() => import('app/views/alerts/list')}
              component={SafeLazyLoad}
            />

            <Route
              path="rules/details/:ruleId/"
              name="Alert Rule Details"
              component={SafeLazyLoad}
              componentPromise={() => import('app/views/alerts/rules/details')}
            />

            <Route path="rules/">
              <IndexRoute
                component={SafeLazyLoad}
                componentPromise={() => import('app/views/alerts/rules')}
              />
              <Route
                path=":projectId/"
                componentPromise={() =>
                  import('app/views/alerts/builder/projectProvider')
                }
                component={SafeLazyLoad}
              >
                <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
                <Route
                  path=":ruleId/"
                  name="Edit Alert Rule"
                  componentPromise={() => import('app/views/alerts/edit')}
                  component={SafeLazyLoad}
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
                component={SafeLazyLoad}
              >
                <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
                <Route
                  path=":ruleId/"
                  name="Edit Alert Rule"
                  componentPromise={() => import('app/views/alerts/edit')}
                  component={SafeLazyLoad}
                />
              </Route>
            </Route>

            <Route
              path="rules/"
              componentPromise={() => import('app/views/alerts/rules')}
              component={SafeLazyLoad}
            />

            <Route
              path=":alertId/"
              componentPromise={() => import('app/views/alerts/details')}
              component={SafeLazyLoad}
            />

            <Route
              path=":projectId/"
              componentPromise={() => import('app/views/alerts/builder/projectProvider')}
              component={SafeLazyLoad}
            >
              <Route
                path="new/"
                name="New Alert Rule"
                component={SafeLazyLoad}
                componentPromise={() => import('app/views/alerts/create')}
              />
              <Route
                path="wizard/"
                name="Alert Creation Wizard"
                component={SafeLazyLoad}
                componentPromise={() => import('app/views/alerts/wizard')}
              />
            </Route>
          </Route>

          <Route
            path="/organizations/:orgId/monitors/"
            componentPromise={() => import('app/views/monitors')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() => import('app/views/monitors/monitors')}
              component={SafeLazyLoad}
            />
            <Route
              path="/organizations/:orgId/monitors/create/"
              componentPromise={() => import('app/views/monitors/create')}
              component={SafeLazyLoad}
            />
            <Route
              path="/organizations/:orgId/monitors/:monitorId/"
              componentPromise={() => import('app/views/monitors/details')}
              component={SafeLazyLoad}
            />
            <Route
              path="/organizations/:orgId/monitors/:monitorId/edit/"
              componentPromise={() => import('app/views/monitors/edit')}
              component={SafeLazyLoad}
            />
          </Route>

          <Route
            path="/organizations/:orgId/releases/"
            componentPromise={() => import('app/views/releases')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() => import('app/views/releases/list')}
              component={SafeLazyLoad}
            />
            <Route
              path=":release/"
              componentPromise={() => import('app/views/releases/detail')}
              component={SafeLazyLoad}
            >
              <IndexRoute
                componentPromise={() => import('app/views/releases/detail/overview')}
                component={SafeLazyLoad}
              />
              <Route
                path="commits/"
                componentPromise={() => import('app/views/releases/detail/commits')}
                component={SafeLazyLoad}
              />
              <Route
                path="files-changed/"
                componentPromise={() => import('app/views/releases/detail/filesChanged')}
                component={SafeLazyLoad}
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
            component={SafeLazyLoad}
          />

          <Route
            path="/organizations/:orgId/stats/"
            componentPromise={() => import('app/views/organizationStats')}
            component={SafeLazyLoad}
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
            component={SafeLazyLoad}
          >
            <Route
              path="queries/"
              componentPromise={() => import('app/views/eventsV2/landing')}
              component={SafeLazyLoad}
            />
            <Route
              path="results/"
              componentPromise={() => import('app/views/eventsV2/results')}
              component={SafeLazyLoad}
            />
            <Route
              path=":eventSlug/"
              componentPromise={() => import('app/views/eventsV2/eventDetails')}
              component={SafeLazyLoad}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/"
            componentPromise={() => import('app/views/performance')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/content')}
              component={SafeLazyLoad}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/trends/"
            componentPromise={() => import('app/views/performance')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/trends')}
              component={SafeLazyLoad}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/summary/"
            componentPromise={() => import('app/views/performance')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/transactionSummary')}
              component={SafeLazyLoad}
            />
            <Route
              path="/organizations/:orgId/performance/summary/vitals/"
              componentPromise={() =>
                import('app/views/performance/transactionSummary/transactionVitals')
              }
              component={SafeLazyLoad}
            />
            <Route
              path="/organizations/:orgId/performance/summary/tags/"
              componentPromise={() =>
                import('app/views/performance/transactionSummary/transactionTags')
              }
              component={SafeLazyLoad}
            />
            <Route
              path="/organizations/:orgId/performance/summary/events/"
              componentPromise={() =>
                import('app/views/performance/transactionSummary/transactionEvents')
              }
              component={SafeLazyLoad}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/vitaldetail/"
            componentPromise={() => import('app/views/performance')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/vitalDetail')}
              component={SafeLazyLoad}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/trace/:traceSlug/"
            componentPromise={() => import('app/views/performance')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/traceDetails')}
              component={SafeLazyLoad}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/:eventSlug/"
            componentPromise={() => import('app/views/performance')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/transactionDetails')}
              component={SafeLazyLoad}
            />
          </Route>
          <Route
            path="/organizations/:orgId/performance/compare/:baselineEventSlug/:regressionEventSlug/"
            componentPromise={() => import('app/views/performance')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() => import('app/views/performance/compare')}
              component={SafeLazyLoad}
            />
          </Route>
          <Route
            path="/organizations/:orgId/dashboards/new/"
            componentPromise={() => import('app/views/dashboardsV2/create')}
            component={SafeLazyLoad}
          >
            <Route
              path="widget/:widgetId/edit/"
              componentPromise={() => import('app/views/dashboardsV2/widget')}
              component={SafeLazyLoad}
            />
            <Route
              path="widget/new/"
              componentPromise={() => import('app/views/dashboardsV2/widget')}
              component={SafeLazyLoad}
            />
          </Route>
          <Redirect
            from="/organizations/:orgId/dashboards/:dashboardId/"
            to="/organizations/:orgId/dashboard/:dashboardId/"
          />
          <Route
            path="/organizations/:orgId/dashboard/:dashboardId/"
            componentPromise={() => import('app/views/dashboardsV2/view')}
            component={SafeLazyLoad}
          >
            <Route
              path="widget/:widgetId/edit/"
              componentPromise={() => import('app/views/dashboardsV2/widget')}
              component={SafeLazyLoad}
            />
            <Route
              path="widget/new/"
              componentPromise={() => import('app/views/dashboardsV2/widget')}
              component={SafeLazyLoad}
            />
          </Route>

          {/* Admin/manage routes */}
          <Route
            name="Admin"
            path="/manage/"
            componentPromise={() => import('app/views/admin/adminLayout')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() => import('app/views/admin/adminOverview')}
              component={SafeLazyLoad}
            />
            <Route
              name="Buffer"
              path="buffer/"
              componentPromise={() => import('app/views/admin/adminBuffer')}
              component={SafeLazyLoad}
            />
            <Route
              name="Relays"
              path="relays/"
              componentPromise={() => import('app/views/admin/adminRelays')}
              component={SafeLazyLoad}
            />
            <Route
              name="Organizations"
              path="organizations/"
              componentPromise={() => import('app/views/admin/adminOrganizations')}
              component={SafeLazyLoad}
            />
            <Route
              name="Projects"
              path="projects/"
              componentPromise={() => import('app/views/admin/adminProjects')}
              component={SafeLazyLoad}
            />
            <Route
              name="Queue"
              path="queue/"
              componentPromise={() => import('app/views/admin/adminQueue')}
              component={SafeLazyLoad}
            />
            <Route
              name="Quotas"
              path="quotas/"
              componentPromise={() => import('app/views/admin/adminQuotas')}
              component={SafeLazyLoad}
            />
            <Route
              name="Settings"
              path="settings/"
              componentPromise={() => import('app/views/admin/adminSettings')}
              component={SafeLazyLoad}
            />
            <Route name="Users" path="users/">
              <IndexRoute
                componentPromise={() => import('app/views/admin/adminUsers')}
                component={SafeLazyLoad}
              />
              <Route
                path=":id"
                componentPromise={() => import('app/views/admin/adminUserEdit')}
                component={SafeLazyLoad}
              />
            </Route>
            <Route
              name="Mail"
              path="status/mail/"
              componentPromise={() => import('app/views/admin/adminMail')}
              component={SafeLazyLoad}
            />
            <Route
              name="Environment"
              path="status/environment/"
              componentPromise={() => import('app/views/admin/adminEnvironment')}
              component={SafeLazyLoad}
            />
            <Route
              name="Packages"
              path="status/packages/"
              componentPromise={() => import('app/views/admin/adminPackages')}
              component={SafeLazyLoad}
            />
            <Route
              name="Warnings"
              path="status/warnings/"
              componentPromise={() => import('app/views/admin/adminWarnings')}
              component={SafeLazyLoad}
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
              component={SafeLazyLoad}
            >
              <IndexRoute
                componentPromise={() => import('app/views/projectInstall/overview')}
                component={SafeLazyLoad}
              />
              <Route
                path=":platform/"
                componentPromise={() =>
                  import('app/views/projectInstall/platformOrIntegration')
                }
                component={SafeLazyLoad}
              />
            </Route>

            <Route
              path="/organizations/:orgId/teams/new/"
              componentPromise={() => import('app/views/teamCreate')}
              component={SafeLazyLoad}
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
              component={SafeLazyLoad}
            />
          </Route>
          <Route
            path=":projectId/getting-started/"
            componentPromise={() => import('app/views/projectInstall/gettingStarted')}
            component={SafeLazyLoad}
          >
            <IndexRoute
              componentPromise={() => import('app/views/projectInstall/overview')}
              component={SafeLazyLoad}
            />
            <Route
              path=":platform/"
              componentPromise={() =>
                import('app/views/projectInstall/platformOrIntegration')
              }
              component={SafeLazyLoad}
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
            component={SafeLazyLoad}
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

        <Route path="*" component={errorHandler(RouteNotFound)} />
      </Route>
    </Route>
  );
}

export default routes;
