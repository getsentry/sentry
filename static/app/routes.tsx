import {Fragment} from 'react';
import {
  IndexRedirect,
  IndexRoute as BaseIndexRoute,
  IndexRouteProps,
  Redirect,
  Route as BaseRoute,
  RouteProps,
} from 'react-router';
import memoize from 'lodash/memoize';

import LazyLoad from 'sentry/components/lazyLoad';
import {EXPERIMENTAL_SPA} from 'sentry/constants';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import {HookName} from 'sentry/types/hooks';
import errorHandler from 'sentry/utils/errorHandler';
import App from 'sentry/views/app';
import AuthLayout from 'sentry/views/auth/layout';
import IssueListContainer from 'sentry/views/issueList/container';
import IssueListOverview from 'sentry/views/issueList/overview';
import OrganizationContextContainer from 'sentry/views/organizationContext';
import OrganizationDetails from 'sentry/views/organizationDetails';
import {Tab} from 'sentry/views/organizationGroupDetails/types';
import OrganizationRoot from 'sentry/views/organizationRoot';
import ProjectEventRedirect from 'sentry/views/projectEventRedirect';
import redirectDeprecatedProjectRoute from 'sentry/views/projects/redirectDeprecatedProjectRoute';
import RouteNotFound from 'sentry/views/routeNotFound';
import SettingsWrapper from 'sentry/views/settings/components/settingsWrapper';

type CustomProps = {
  componentPromise?: () => Promise<any>;
  name?: string;
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

function buildRoutes() {
  // Read this to understand where to add new routes, how / why the routing
  // tree is structured the way it is, and how the lazy-loading /
  // code-splitting works for pages.
  //
  // ## Formatting
  //
  // NOTE that there are intentionally NO blank lines within route tree blocks.
  // This helps make it easier to navigate within the file by using your
  // editors shortcuts to jump between 'paragraphs' of code.
  //
  // [!!] Do NOT add blank lines within route blocks to preserve this behavior!
  //
  //
  // ## Lazy loading
  //
  // * The `SafeLazyLoad` component
  //
  //   Most routes are rendered as LazyLoad components (SafeLazyLoad is the
  //   errorHandler wrapped version). This means the rendered component for the
  //   route will only be loaded when the route is loaded. This helps us
  //   "code-split" the app.
  //
  // * The `lazyLoad` function
  //
  //   This function is to be used with `getComponent`. It is used for
  //   container component routes for performances reasons. See the
  //   documentation on the function for more details.
  //
  //
  // ## Hooks
  //
  // There are a number of `hook()` routes placed within the routing tree to
  // allow for additional routes to be augmented into the application via the
  // hookStore mechanism.
  //
  //
  // ## The structure
  //
  // * `experimentalSpaRoutes`
  //
  //   These routes are specifically for the experimental single-page-app mode,
  //   where Sentry is run separate from Django. These are NOT part of the root
  //   <App /> component.
  //
  //   Right now these are mainly used for authentication pages. In the future
  //   they would be used for other pages like registration.
  //
  // * `rootRoutes`
  //
  //   These routes live directly under the <App /> container, and generally
  //   are not specific to an organization.
  //
  // * `settingsRoutes`
  //
  //   This is the route tree for all of `/settings/`. This route tree is
  //   composed of a few different sub-trees.
  //
  //   - `accountSettingsRoutes`    User specific settings
  //   - `orgSettingsRoutes`        Specific to a organization
  //   - `projectSettingsRoutes`    Specific to a project
  //   - `legacySettingsRedirects`  Routes that used to exist in settings
  //
  // * `organizationRoutes`
  //
  //   This is where a majority of the app routes live. This is wrapped with
  //   the <OrganizationDetails /> component, which provides the sidebar and
  //   organization context.
  //
  //   Within these routes are a variety of subroutes. They are not all
  //   listed here as the subroutes will be added and removed, and most are
  //   self explanatory.
  //
  // * `legacyRedirectRoutes`
  //
  //   This route tree contains <Redirect /> routes for many old legacy paths.
  //
  //   You may also find <Redirect />'s collocated next to the feature routes
  //   they have redirects for. A good rule here is to place 'helper' redirects
  //   next to the routes they redirect to, and place 'legacy route' redirects
  //   for routes that have completely changed in this tree.

  const experimentalSpaRoutes = EXPERIMENTAL_SPA ? (
    <Route path="/auth/login/" component={errorHandler(AuthLayout)}>
      <IndexRoute
        componentPromise={() => import('sentry/views/auth/login')}
        component={SafeLazyLoad}
      />
    </Route>
  ) : null;

  const rootRoutes = (
    <Fragment>
      <IndexRoute
        componentPromise={() => import('sentry/views/app/root')}
        component={SafeLazyLoad}
      />
      <Route
        path="/accept/:memberId/:token/"
        componentPromise={() => import('sentry/views/acceptOrganizationInvite')}
        component={SafeLazyLoad}
      />
      <Route
        path="/accept-transfer/"
        componentPromise={() => import('sentry/views/acceptProjectTransfer')}
        component={SafeLazyLoad}
      />
      <Route
        path="/extensions/external-install/:integrationSlug/:installationId"
        componentPromise={() => import('sentry/views/integrationOrganizationLink')}
        component={SafeLazyLoad}
      />
      <Route
        path="/extensions/:integrationSlug/link/"
        getComponent={lazyLoad(() => import('sentry/views/integrationOrganizationLink'))}
      />
      <Route
        path="/sentry-apps/:sentryAppSlug/external-install/"
        componentPromise={() => import('sentry/views/sentryAppExternalInstallation')}
        component={SafeLazyLoad}
      />
      <Redirect from="/account/" to="/settings/account/details/" />
      <Redirect from="/share/group/:shareId/" to="/share/issue/:shareId/" />
      <Route
        path="/share/issue/:shareId/"
        componentPromise={() => import('sentry/views/sharedGroupDetails')}
        component={SafeLazyLoad}
      />
      <Route
        path="/organizations/new/"
        componentPromise={() => import('sentry/views/organizationCreate')}
        component={SafeLazyLoad}
      />
      <Route
        path="/organizations/:orgId/data-export/:dataExportId"
        componentPromise={() => import('sentry/views/dataExport/dataDownload')}
        component={SafeLazyLoad}
      />
      <Route
        path="/organizations/:orgId/disabled-member/"
        componentPromise={() => import('sentry/views/disabledMember')}
        component={SafeLazyLoad}
      />
      <Route
        path="/join-request/:orgId/"
        componentPromise={() => import('sentry/views/organizationJoinRequest')}
        component={SafeLazyLoad}
      />
      <Route
        path="/onboarding/:orgId/"
        component={errorHandler(OrganizationContextContainer)}
      >
        <IndexRedirect to="welcome/" />
        <Route
          path=":step/"
          componentPromise={() => import('sentry/views/onboarding/onboarding')}
          component={SafeLazyLoad}
        />
      </Route>
    </Fragment>
  );

  const accountSettingsRoutes = (
    <Route
      path="account/"
      name={t('Account')}
      getComponent={lazyLoad(
        () => import('sentry/views/settings/account/accountSettingsLayout')
      )}
    >
      <IndexRedirect to="details/" />
      <Route
        path="details/"
        name={t('Details')}
        componentPromise={() => import('sentry/views/settings/account/accountDetails')}
        component={SafeLazyLoad}
      />
      <Route path="notifications/" name={t('Notifications')}>
        <IndexRoute
          componentPromise={() =>
            import('sentry/views/settings/account/notifications/notificationSettings')
          }
          component={SafeLazyLoad}
        />
        <Route
          path=":fineTuneType/"
          name={t('Fine Tune Alerts')}
          componentPromise={() =>
            import('sentry/views/settings/account/accountNotificationFineTuning')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        path="emails/"
        name={t('Emails')}
        componentPromise={() => import('sentry/views/settings/account/accountEmails')}
        component={SafeLazyLoad}
      />
      <Route
        path="authorizations/"
        componentPromise={() =>
          import('sentry/views/settings/account/accountAuthorizations')
        }
        component={SafeLazyLoad}
      />
      <Route name={t('Security')} path="security/">
        <Route
          componentPromise={() =>
            import('sentry/views/settings/account/accountSecurity/accountSecurityWrapper')
          }
          component={SafeLazyLoad}
        >
          <IndexRoute
            componentPromise={() =>
              import('sentry/views/settings/account/accountSecurity')
            }
            component={SafeLazyLoad}
          />
          <Route
            path="session-history/"
            name={t('Session History')}
            componentPromise={() =>
              import('sentry/views/settings/account/accountSecurity/sessionHistory')
            }
            component={SafeLazyLoad}
          />
          <Route
            path="mfa/:authId/"
            name={t('Details')}
            componentPromise={() =>
              import(
                'sentry/views/settings/account/accountSecurity/accountSecurityDetails'
              )
            }
            component={SafeLazyLoad}
          />
        </Route>
        <Route
          path="mfa/:authId/enroll/"
          name={t('Enroll')}
          componentPromise={() =>
            import('sentry/views/settings/account/accountSecurity/accountSecurityEnroll')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        path="subscriptions/"
        name={t('Subscriptions')}
        componentPromise={() =>
          import('sentry/views/settings/account/accountSubscriptions')
        }
        component={SafeLazyLoad}
      />
      <Route
        path="identities/"
        name={t('Identities')}
        componentPromise={() => import('sentry/views/settings/account/accountIdentities')}
        component={SafeLazyLoad}
      />
      <Route path="api/" name={t('API')}>
        <IndexRedirect to="auth-tokens/" />
        <Route path="auth-tokens/" name={t('Auth Tokens')}>
          <IndexRoute
            componentPromise={() => import('sentry/views/settings/account/apiTokens')}
            component={SafeLazyLoad}
          />
          <Route
            path="new-token/"
            name={t('Create New Token')}
            componentPromise={() => import('sentry/views/settings/account/apiNewToken')}
            component={SafeLazyLoad}
          />
        </Route>
        <Route path="applications/" name={t('Applications')}>
          <IndexRoute
            componentPromise={() =>
              import('sentry/views/settings/account/apiApplications')
            }
            component={SafeLazyLoad}
          />
          <Route
            path=":appId/"
            name={t('Details')}
            componentPromise={() =>
              import('sentry/views/settings/account/apiApplications/details')
            }
            component={SafeLazyLoad}
          />
        </Route>
        {hook('routes:api')}
      </Route>
      <Route
        path="close-account/"
        name={t('Close Account')}
        componentPromise={() => import('sentry/views/settings/account/accountClose')}
        component={SafeLazyLoad}
      />
    </Route>
  );

  const projectSettingsRoutes = (
    <Route
      name={t('Project')}
      path="projects/:projectId/"
      getComponent={lazyLoad(
        () => import('sentry/views/settings/project/projectSettingsLayout')
      )}
    >
      <IndexRoute
        name={t('General')}
        componentPromise={() => import('sentry/views/settings/projectGeneralSettings')}
        component={SafeLazyLoad}
      />
      <Route
        path="teams/"
        name={t('Teams')}
        componentPromise={() => import('sentry/views/settings/project/projectTeams')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Alerts')}
        path="alerts/"
        component={SafeLazyLoad}
        componentPromise={() => import('sentry/views/settings/projectAlerts')}
      >
        <IndexRoute
          component={SafeLazyLoad}
          componentPromise={() => import('sentry/views/settings/projectAlerts/settings')}
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
        name={t('Environments')}
        path="environments/"
        componentPromise={() =>
          import('sentry/views/settings/project/projectEnvironments')
        }
        component={SafeLazyLoad}
      >
        <IndexRoute />
        <Route path="hidden/" />
      </Route>
      <Route
        name={t('Tags')}
        path="tags/"
        componentPromise={() => import('sentry/views/settings/projectTags')}
        component={SafeLazyLoad}
      />
      <Redirect from="issue-tracking/" to="/settings/:orgId/:projectId/plugins/" />
      <Route
        path="release-tracking/"
        name={t('Release Tracking')}
        componentPromise={() =>
          import('sentry/views/settings/project/projectReleaseTracking')
        }
        component={SafeLazyLoad}
      />
      <Route
        path="ownership/"
        name={t('Issue Owners')}
        componentPromise={() => import('sentry/views/settings/project/projectOwnership')}
        component={SafeLazyLoad}
      />
      <Route
        path="data-forwarding/"
        name={t('Data Forwarding')}
        componentPromise={() => import('sentry/views/settings/projectDataForwarding')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Security & Privacy')}
        path="security-and-privacy/"
        component={SafeLazyLoad}
        componentPromise={() => import('sentry/views/settings/projectSecurityAndPrivacy')}
      />
      <Route
        path="debug-symbols/"
        name={t('Debug Information Files')}
        componentPromise={() => import('sentry/views/settings/projectDebugFiles')}
        component={SafeLazyLoad}
      />
      <Route
        path="proguard/"
        name={t('ProGuard Mappings')}
        componentPromise={() => import('sentry/views/settings/projectProguard')}
        component={SafeLazyLoad}
      />
      <Route
        path="performance/"
        name={t('Performance')}
        componentPromise={() => import('sentry/views/settings/projectPerformance')}
        component={SafeLazyLoad}
      />
      <Route
        path="source-maps/"
        name={t('Source Maps')}
        componentPromise={() => import('sentry/views/settings/projectSourceMaps')}
        component={SafeLazyLoad}
      >
        <IndexRoute
          componentPromise={() => import('sentry/views/settings/projectSourceMaps/list')}
          component={SafeLazyLoad}
        />
        <Route
          path=":name/"
          name={t('Archive')}
          componentPromise={() =>
            import('sentry/views/settings/projectSourceMaps/detail')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        path="processing-issues/"
        name={t('Processing Issues')}
        componentPromise={() =>
          import('sentry/views/settings/project/projectProcessingIssues')
        }
        component={SafeLazyLoad}
      />
      <Route
        path="filters/"
        name={t('Inbound Filters')}
        componentPromise={() => import('sentry/views/settings/project/projectFilters')}
        component={SafeLazyLoad}
      >
        <IndexRedirect to="data-filters/" />
        <Route path=":filterType/" />
      </Route>
      <Route
        name={t('Filters & Sampling')}
        path="filters-and-sampling/"
        componentPromise={() =>
          import('sentry/views/settings/project/filtersAndSampling')
        }
        component={SafeLazyLoad}
      />
      <Route
        path="issue-grouping/"
        name={t('Issue Grouping')}
        componentPromise={() => import('sentry/views/settings/projectIssueGrouping')}
        component={SafeLazyLoad}
      />
      <Route
        path="hooks/"
        name={t('Service Hooks')}
        componentPromise={() =>
          import('sentry/views/settings/project/projectServiceHooks')
        }
        component={SafeLazyLoad}
      />
      <Route
        path="hooks/new/"
        name={t('Create Service Hook')}
        componentPromise={() =>
          import('sentry/views/settings/project/projectCreateServiceHook')
        }
        component={SafeLazyLoad}
      />
      <Route
        path="hooks/:hookId/"
        name={t('Service Hook Details')}
        componentPromise={() =>
          import('sentry/views/settings/project/projectServiceHookDetails')
        }
        component={SafeLazyLoad}
      />
      <Route path="keys/" name={t('Client Keys')}>
        <IndexRoute
          componentPromise={() =>
            import('sentry/views/settings/project/projectKeys/list')
          }
          component={SafeLazyLoad}
        />
        <Route
          path=":keyId/"
          name={t('Details')}
          componentPromise={() =>
            import('sentry/views/settings/project/projectKeys/details')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        path="user-feedback/"
        name={t('User Feedback')}
        componentPromise={() =>
          import('sentry/views/settings/project/projectUserFeedback')
        }
        component={SafeLazyLoad}
      />
      <Redirect from="csp/" to="security-headers/" />
      <Route path="security-headers/" name={t('Security Headers')}>
        <IndexRoute
          componentPromise={() => import('sentry/views/settings/projectSecurityHeaders')}
          component={SafeLazyLoad}
        />
        <Route
          path="csp/"
          name={t('Content Security Policy')}
          componentPromise={() =>
            import('sentry/views/settings/projectSecurityHeaders/csp')
          }
          component={SafeLazyLoad}
        />
        <Route
          path="expect-ct/"
          name={t('Certificate Transparency')}
          componentPromise={() =>
            import('sentry/views/settings/projectSecurityHeaders/expectCt')
          }
          component={SafeLazyLoad}
        />
        <Route
          path="hpkp/"
          name={t('HPKP')}
          componentPromise={() =>
            import('sentry/views/settings/projectSecurityHeaders/hpkp')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route path="plugins/" name={t('Legacy Integrations')}>
        <IndexRoute
          componentPromise={() => import('sentry/views/settings/projectPlugins')}
          component={SafeLazyLoad}
        />
        <Route
          path=":pluginId/"
          name={t('Integration Details')}
          componentPromise={() => import('sentry/views/settings/projectPlugins/details')}
          component={SafeLazyLoad}
        />
      </Route>
      <Route path="install/" name={t('Configuration')}>
        <IndexRoute
          componentPromise={() => import('sentry/views/projectInstall/overview')}
          component={SafeLazyLoad}
        />
        <Route
          path=":platform/"
          name={t('Docs')}
          componentPromise={() =>
            import('sentry/views/projectInstall/platformOrIntegration')
          }
          component={SafeLazyLoad}
        />
      </Route>
    </Route>
  );

  const orgSettingsRoutes = (
    <Route
      getComponent={lazyLoad(
        () => import('sentry/views/settings/organization/organizationSettingsLayout')
      )}
    >
      {hook('routes:organization')}
      <IndexRoute
        name={t('General')}
        componentPromise={() =>
          import('sentry/views/settings/organizationGeneralSettings')
        }
        component={SafeLazyLoad}
      />
      <Route
        path="projects/"
        name={t('Projects')}
        componentPromise={() => import('sentry/views/settings/organizationProjects')}
        component={SafeLazyLoad}
      />
      <Route path="api-keys/" name={t('API Key')}>
        <IndexRoute
          componentPromise={() => import('sentry/views/settings/organizationApiKeys')}
          component={SafeLazyLoad}
        />
        <Route
          path=":apiKey/"
          name={t('Details')}
          componentPromise={() =>
            import('sentry/views/settings/organizationApiKeys/organizationApiKeyDetails')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        path="audit-log/"
        name={t('Audit Log')}
        componentPromise={() => import('sentry/views/settings/organizationAuditLog')}
        component={SafeLazyLoad}
      />
      <Route
        path="auth/"
        name={t('Auth Providers')}
        componentPromise={() => import('sentry/views/settings/organizationAuth')}
        component={SafeLazyLoad}
      />
      <Redirect from="members/requests" to="members/" />
      <Route path="members/" name={t('Members')}>
        <Route
          componentPromise={() =>
            import('sentry/views/settings/organizationMembers/organizationMembersWrapper')
          }
          component={SafeLazyLoad}
        >
          <IndexRoute
            componentPromise={() =>
              import('sentry/views/settings/organizationMembers/organizationMembersList')
            }
            component={SafeLazyLoad}
          />
        </Route>
        <Route
          path=":memberId/"
          name={t('Details')}
          componentPromise={() =>
            import('sentry/views/settings/organizationMembers/organizationMemberDetail')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        path="rate-limits/"
        name={t('Rate Limits')}
        componentPromise={() => import('sentry/views/settings/organizationRateLimits')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Relay')}
        path="relay/"
        componentPromise={() => import('sentry/views/settings/organizationRelay')}
        component={SafeLazyLoad}
      />
      <Route
        path="repos/"
        name={t('Repositories')}
        componentPromise={() => import('sentry/views/settings/organizationRepositories')}
        component={SafeLazyLoad}
      />
      <Route
        path="settings/"
        componentPromise={() =>
          import('sentry/views/settings/organizationGeneralSettings')
        }
        component={SafeLazyLoad}
      />
      <Route
        name={t('Security & Privacy')}
        path="security-and-privacy/"
        componentPromise={() =>
          import('sentry/views/settings/organizationSecurityAndPrivacy')
        }
        component={SafeLazyLoad}
      />
      <Route name={t('Teams')} path="teams/">
        <IndexRoute
          componentPromise={() => import('sentry/views/settings/organizationTeams')}
          component={SafeLazyLoad}
        />
        <Route
          name={t('Team')}
          path=":teamId/"
          componentPromise={() =>
            import('sentry/views/settings/organizationTeams/teamDetails')
          }
          component={SafeLazyLoad}
        >
          <IndexRedirect to="members/" />
          <Route
            path="members/"
            name={t('Members')}
            componentPromise={() =>
              import('sentry/views/settings/organizationTeams/teamMembers')
            }
            component={SafeLazyLoad}
          />
          <Route
            path="notifications/"
            name={t('Notifications')}
            componentPromise={() =>
              import('sentry/views/settings/organizationTeams/teamNotifications')
            }
            component={SafeLazyLoad}
          />
          <Route
            path="projects/"
            name={t('Projects')}
            componentPromise={() =>
              import('sentry/views/settings/organizationTeams/teamProjects')
            }
            component={SafeLazyLoad}
          />
          <Route
            path="settings/"
            name={t('Settings')}
            componentPromise={() =>
              import('sentry/views/settings/organizationTeams/teamSettings')
            }
            component={SafeLazyLoad}
          />
        </Route>
      </Route>
      <Redirect from="plugins/" to="integrations/" />
      <Route name={t('Integrations')} path="plugins/">
        <Route
          name={t('Integration Details')}
          path=":integrationSlug/"
          componentPromise={() =>
            import('sentry/views/organizationIntegrations/pluginDetailedView')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Redirect from="sentry-apps/" to="integrations/" />
      <Route name={t('Integrations')} path="sentry-apps/">
        <Route
          name={t('Details')}
          path=":integrationSlug"
          componentPromise={() =>
            import('sentry/views/organizationIntegrations/sentryAppDetailedView')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Redirect from="document-integrations/" to="integrations/" />
      <Route name={t('Integrations')} path="document-integrations/">
        <Route
          name={t('Details')}
          path=":integrationSlug"
          componentPromise={() =>
            import('sentry/views/organizationIntegrations/docIntegrationDetailedView')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route name={t('Integrations')} path="integrations/">
        <IndexRoute
          componentPromise={() =>
            import('sentry/views/organizationIntegrations/integrationListDirectory')
          }
          component={SafeLazyLoad}
        />
        <Route
          name={t('Integration Details')}
          path=":integrationSlug"
          componentPromise={() =>
            import('sentry/views/organizationIntegrations/integrationDetailedView')
          }
          component={SafeLazyLoad}
        />
        <Route
          name={t('Configure Integration')}
          path=":providerKey/:integrationId/"
          componentPromise={() =>
            import('sentry/views/settings/organizationIntegrations/configureIntegration')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route name={t('Developer Settings')} path="developer-settings/">
        <IndexRoute
          componentPromise={() =>
            import('sentry/views/settings/organizationDeveloperSettings')
          }
          component={SafeLazyLoad}
        />
        <Route
          name={t('Create Integration')}
          path="new-public/"
          componentPromise={() =>
            import(
              'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
            )
          }
          component={SafeLazyLoad}
        />
        <Route
          name={t('Create Integration')}
          path="new-internal/"
          componentPromise={() =>
            import(
              'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
            )
          }
          component={SafeLazyLoad}
        />
        <Route
          name={t('Edit Integration')}
          path=":appSlug/"
          componentPromise={() =>
            import(
              'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
            )
          }
          component={SafeLazyLoad}
        />
        <Route
          name={t('Integration Dashboard')}
          path=":appSlug/dashboard/"
          componentPromise={() =>
            import(
              'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDashboard'
            )
          }
          component={SafeLazyLoad}
        />
      </Route>
    </Route>
  );

  const legacySettingsRedirects = (
    <Fragment>
      <Redirect from=":projectId/" to="projects/:projectId/" />
      <Redirect from=":projectId/alerts/" to="projects/:projectId/alerts/" />
      <Redirect from=":projectId/alerts/rules/" to="projects/:projectId/alerts/rules/" />
      <Redirect
        from=":projectId/alerts/rules/:ruleId/"
        to="projects/:projectId/alerts/rules/:ruleId/"
      />
    </Fragment>
  );

  const settingsRoutes = (
    <Route path="/settings/" name={t('Settings')} component={SettingsWrapper}>
      <IndexRoute
        getComponent={lazyLoad(() => import('sentry/views/settings/settingsIndex'))}
      />
      {accountSettingsRoutes}
      <Route name={t('Organization')} path=":orgId/">
        {orgSettingsRoutes}
        {projectSettingsRoutes}
        {legacySettingsRedirects}
      </Route>
    </Route>
  );

  const projectsRoutes = (
    <Route path="/organizations/:orgId/projects/">
      <IndexRoute
        componentPromise={() => import('sentry/views/projectsDashboard')}
        component={SafeLazyLoad}
      />
      <Route
        path="new/"
        componentPromise={() => import('sentry/views/projectInstall/newProject')}
        component={SafeLazyLoad}
      />
      <Route
        path=":projectId/getting-started/"
        componentPromise={() => import('sentry/views/projectInstall/gettingStarted')}
        component={SafeLazyLoad}
      >
        <IndexRoute
          componentPromise={() => import('sentry/views/projectInstall/overview')}
          component={SafeLazyLoad}
        />
        <Route
          path=":platform/"
          componentPromise={() =>
            import('sentry/views/projectInstall/platformOrIntegration')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        path=":projectId/"
        componentPromise={() => import('sentry/views/projectDetail')}
        component={SafeLazyLoad}
      />
      <Route
        path=":projectId/events/:eventId/"
        component={errorHandler(ProjectEventRedirect)}
      />
    </Route>
  );

  const dashboardRoutes = (
    <Fragment>
      <Route
        path="/organizations/:orgId/dashboards/"
        componentPromise={() => import('sentry/views/dashboardsV2')}
        component={SafeLazyLoad}
      >
        <IndexRoute
          componentPromise={() => import('sentry/views/dashboardsV2/manage')}
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        path="/organizations/:orgId/dashboards/new/"
        componentPromise={() => import('sentry/views/dashboardsV2/create')}
        component={SafeLazyLoad}
      >
        <Route
          path="widget/:widgetIndex/edit/"
          componentPromise={() => import('sentry/views/dashboardsV2/widgetBuilder')}
          component={SafeLazyLoad}
        />
        <Route
          path="widget/new/"
          componentPromise={() => import('sentry/views/dashboardsV2/widgetBuilder')}
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        path="/organizations/:orgId/dashboards/new/:templateId"
        componentPromise={() => import('sentry/views/dashboardsV2/create')}
        component={SafeLazyLoad}
      />
      <Redirect
        from="/organizations/:orgId/dashboards/:dashboardId/"
        to="/organizations/:orgId/dashboard/:dashboardId/"
      />
      <Route
        path="/organizations/:orgId/dashboard/:dashboardId/"
        componentPromise={() => import('sentry/views/dashboardsV2/view')}
        component={SafeLazyLoad}
      >
        <Route
          path="widget/:widgetIndex/edit/"
          componentPromise={() => import('sentry/views/dashboardsV2/widgetBuilder')}
          component={SafeLazyLoad}
        />
        <Route
          path="widget/new/"
          componentPromise={() => import('sentry/views/dashboardsV2/widgetBuilder')}
          component={SafeLazyLoad}
        />
        <Route
          path="widget/:widgetId/"
          componentPromise={() => import('sentry/views/dashboardsV2/view')}
          component={SafeLazyLoad}
        />
      </Route>
    </Fragment>
  );

  const alertRoutes = (
    <Route
      path="/organizations/:orgId/alerts/"
      componentPromise={() => import('sentry/views/alerts')}
      component={SafeLazyLoad}
    >
      <IndexRoute
        componentPromise={() => import('sentry/views/alerts/list')}
        component={SafeLazyLoad}
      />
      <Route path="rules/">
        <IndexRoute
          component={SafeLazyLoad}
          componentPromise={() => import('sentry/views/alerts/rules')}
        />
        <Route
          path="details/:ruleId/"
          name={t('Alert Rule Details')}
          component={SafeLazyLoad}
          componentPromise={() => import('sentry/views/alerts/rules/details')}
        />
        <Route
          path=":projectId/"
          componentPromise={() => import('sentry/views/alerts/builder/projectProvider')}
          component={SafeLazyLoad}
        >
          <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
          <Route
            path=":ruleId/"
            name={t('Edit Alert Rule')}
            componentPromise={() => import('sentry/views/alerts/edit')}
            component={SafeLazyLoad}
          />
        </Route>
        <Route
          path=":projectId/:ruleId/details/"
          name={t('Alert Rule Details')}
          componentPromise={() => import('sentry/views/alerts/details')}
          component={SafeLazyLoad}
        >
          <IndexRoute
            component={SafeLazyLoad}
            componentPromise={() => import('sentry/views/alerts/details/ruleDetails')}
          />
        </Route>
      </Route>
      <Route path="metric-rules/">
        <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
        <Route
          path=":projectId/"
          componentPromise={() => import('sentry/views/alerts/builder/projectProvider')}
          component={SafeLazyLoad}
        >
          <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
          <Route
            path=":ruleId/"
            name={t('Edit Alert Rule')}
            componentPromise={() => import('sentry/views/alerts/edit')}
            component={SafeLazyLoad}
          />
        </Route>
      </Route>
      <Route
        path=":alertId/"
        componentPromise={() => import('sentry/views/alerts/incidentRedirect')}
        component={SafeLazyLoad}
      />
      <Route
        path=":projectId/"
        componentPromise={() => import('sentry/views/alerts/builder/projectProvider')}
        component={SafeLazyLoad}
      >
        <Route
          path="new/"
          name={t('New Alert Rule')}
          component={SafeLazyLoad}
          componentPromise={() => import('sentry/views/alerts/create')}
        />
        <Route
          path="wizard/"
          name={t('Alert Creation Wizard')}
          component={SafeLazyLoad}
          componentPromise={() => import('sentry/views/alerts/wizard')}
        />
      </Route>
    </Route>
  );

  const monitorsRoutes = (
    <Route
      path="/organizations/:orgId/monitors/"
      componentPromise={() => import('sentry/views/monitors')}
      component={SafeLazyLoad}
    >
      <IndexRoute
        componentPromise={() => import('sentry/views/monitors/monitors')}
        component={SafeLazyLoad}
      />
      <Route
        path="/organizations/:orgId/monitors/create/"
        componentPromise={() => import('sentry/views/monitors/create')}
        component={SafeLazyLoad}
      />
      <Route
        path="/organizations/:orgId/monitors/:monitorId/"
        componentPromise={() => import('sentry/views/monitors/details')}
        component={SafeLazyLoad}
      />
      <Route
        path="/organizations/:orgId/monitors/:monitorId/edit/"
        componentPromise={() => import('sentry/views/monitors/edit')}
        component={SafeLazyLoad}
      />
    </Route>
  );

  const releasesRoutes = (
    <Route path="/organizations/:orgId/releases/">
      <IndexRoute
        componentPromise={() => import('sentry/views/releases/list')}
        component={SafeLazyLoad}
      />
      <Route
        path=":release/"
        componentPromise={() => import('sentry/views/releases/detail')}
        component={SafeLazyLoad}
      >
        <IndexRoute
          componentPromise={() => import('sentry/views/releases/detail/overview')}
          component={SafeLazyLoad}
        />
        <Route
          path="commits/"
          componentPromise={() =>
            import('sentry/views/releases/detail/commitsAndFiles/commits')
          }
          component={SafeLazyLoad}
        />
        <Route
          path="files-changed/"
          componentPromise={() =>
            import('sentry/views/releases/detail/commitsAndFiles/filesChanged')
          }
          component={SafeLazyLoad}
        />
        <Redirect from="new-events/" to="/organizations/:orgId/releases/:release/" />
        <Redirect from="all-events/" to="/organizations/:orgId/releases/:release/" />
      </Route>
    </Route>
  );

  const activityRoutes = (
    <Route
      path="/organizations/:orgId/activity/"
      componentPromise={() => import('sentry/views/organizationActivity')}
      component={SafeLazyLoad}
    />
  );

  const statsRoutes = (
    <Route path="/organizations/:orgId/stats/">
      <IndexRoute
        componentPromise={() => import('sentry/views/organizationStats')}
        component={SafeLazyLoad}
      />
      <Route
        path="issues/"
        componentPromise={() => import('sentry/views/organizationStats/teamInsights')}
        component={SafeLazyLoad}
      >
        <IndexRoute
          componentPromise={() =>
            import('sentry/views/organizationStats/teamInsights/issues')
          }
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        path="health/"
        componentPromise={() => import('sentry/views/organizationStats/teamInsights')}
        component={SafeLazyLoad}
      >
        <IndexRoute
          componentPromise={() =>
            import('sentry/views/organizationStats/teamInsights/health')
          }
          component={SafeLazyLoad}
        />
      </Route>

      <Redirect from="team/" to="/organizations/:orgId/stats/issues/" />
    </Route>
  );

  // TODO(mark) Long term this /queries route should go away and /discover
  // should be the canonical route for discover2. We have a redirect right now
  // as /discover was for discover 1 and most of the application is linking to
  // /discover/queries and not /discover
  const discoverRoutes = (
    <Route
      path="/organizations/:orgId/discover/"
      componentPromise={() => import('sentry/views/eventsV2')}
      component={SafeLazyLoad}
    >
      <IndexRedirect to="queries/" />
      <Route
        path="queries/"
        componentPromise={() => import('sentry/views/eventsV2/landing')}
        component={SafeLazyLoad}
      />
      <Route
        path="results/"
        componentPromise={() => import('sentry/views/eventsV2/results')}
        component={SafeLazyLoad}
      />
      <Route
        path=":eventSlug/"
        componentPromise={() => import('sentry/views/eventsV2/eventDetails')}
        component={SafeLazyLoad}
      />
    </Route>
  );

  const performanceRoutes = (
    <Route
      path="/organizations/:orgId/performance/"
      componentPromise={() => import('sentry/views/performance')}
      component={SafeLazyLoad}
    >
      <IndexRoute
        componentPromise={() => import('sentry/views/performance/content')}
        component={SafeLazyLoad}
      />
      <Route
        path="trends/"
        componentPromise={() => import('sentry/views/performance/trends')}
        component={SafeLazyLoad}
      />
      <Route path="/organizations/:orgId/performance/summary/">
        <IndexRoute
          componentPromise={() =>
            import('sentry/views/performance/transactionSummary/transactionOverview')
          }
          component={SafeLazyLoad}
        />
        <Route
          path="vitals/"
          componentPromise={() =>
            import('sentry/views/performance/transactionSummary/transactionVitals')
          }
          component={SafeLazyLoad}
        />
        <Route
          path="tags/"
          componentPromise={() =>
            import('sentry/views/performance/transactionSummary/transactionTags')
          }
          component={SafeLazyLoad}
        />
        <Route
          path="events/"
          componentPromise={() =>
            import('sentry/views/performance/transactionSummary/transactionEvents')
          }
          component={SafeLazyLoad}
        />
        <Route
          path="anomalies/"
          componentPromise={() =>
            import('sentry/views/performance/transactionSummary/transactionAnomalies')
          }
          component={SafeLazyLoad}
        />
        <Route path="spans/">
          <IndexRoute
            componentPromise={() =>
              import('sentry/views/performance/transactionSummary/transactionSpans')
            }
            component={SafeLazyLoad}
          />
          <Route
            path=":spanSlug/"
            componentPromise={() =>
              import(
                'sentry/views/performance/transactionSummary/transactionSpans/spanDetails'
              )
            }
            component={SafeLazyLoad}
          />
        </Route>
      </Route>
      <Route
        path="vitaldetail/"
        componentPromise={() => import('sentry/views/performance/vitalDetail')}
        component={SafeLazyLoad}
      />
      <Route
        path="trace/:traceSlug/"
        componentPromise={() => import('sentry/views/performance/traceDetails')}
        component={SafeLazyLoad}
      />
      <Route
        path=":eventSlug/"
        componentPromise={() => import('sentry/views/performance/transactionDetails')}
        component={SafeLazyLoad}
      />
    </Route>
  );

  const userFeedbackRoutes = (
    <Route
      path="/organizations/:orgId/user-feedback/"
      componentPromise={() => import('sentry/views/userFeedback')}
      component={SafeLazyLoad}
    />
  );

  const issueListRoutes = (
    <Route
      path="/organizations/:orgId/issues/"
      component={errorHandler(IssueListContainer)}
    >
      <Redirect from="/organizations/:orgId/" to="/organizations/:orgId/issues/" />
      <IndexRoute component={errorHandler(IssueListOverview)} />
      <Route path="searches/:searchId/" component={errorHandler(IssueListOverview)} />
    </Route>
  );

  // Once org issues is complete, these routes can be nested under
  // /organizations/:orgId/issues
  const groupDetailsRoutes = (
    <Route
      path="/organizations/:orgId/issues/:groupId/"
      componentPromise={() => import('sentry/views/organizationGroupDetails')}
      component={SafeLazyLoad}
    >
      <IndexRoute
        componentPromise={() =>
          import('sentry/views/organizationGroupDetails/groupEventDetails')
        }
        component={SafeLazyLoad}
        props={{
          currentTab: Tab.DETAILS,
          isEventRoute: false,
        }}
      />
      <Route
        path="activity/"
        componentPromise={() =>
          import('sentry/views/organizationGroupDetails/groupActivity')
        }
        component={SafeLazyLoad}
        props={{
          currentTab: Tab.ACTIVITY,
          isEventRoute: false,
        }}
      />
      <Route
        path="events/"
        componentPromise={() =>
          import('sentry/views/organizationGroupDetails/groupEvents')
        }
        component={SafeLazyLoad}
        props={{
          currentTab: Tab.EVENTS,
          isEventRoute: false,
        }}
      />
      <Route
        path="tags/"
        componentPromise={() => import('sentry/views/organizationGroupDetails/groupTags')}
        component={SafeLazyLoad}
        props={{
          currentTab: Tab.TAGS,
          isEventRoute: false,
        }}
      />
      <Route
        path="tags/:tagKey/"
        componentPromise={() =>
          import('sentry/views/organizationGroupDetails/groupTagValues')
        }
        component={SafeLazyLoad}
        props={{
          currentTab: Tab.TAGS,
          isEventRoute: false,
        }}
      />
      <Route
        path="feedback/"
        componentPromise={() =>
          import('sentry/views/organizationGroupDetails/groupUserFeedback')
        }
        component={SafeLazyLoad}
        props={{
          currentTab: Tab.USER_FEEDBACK,
          isEventRoute: false,
        }}
      />
      <Route
        path="attachments/"
        componentPromise={() =>
          import('sentry/views/organizationGroupDetails/groupEventAttachments')
        }
        component={SafeLazyLoad}
        props={{
          currentTab: Tab.ATTACHMENTS,
          isEventRoute: false,
        }}
      />
      <Route
        path="similar/"
        componentPromise={() =>
          import('sentry/views/organizationGroupDetails/groupSimilarIssues')
        }
        component={SafeLazyLoad}
        props={{
          currentTab: Tab.SIMILAR_ISSUES,
          isEventRoute: false,
        }}
      />
      <Route
        path="merged/"
        componentPromise={() =>
          import('sentry/views/organizationGroupDetails/groupMerged')
        }
        component={SafeLazyLoad}
        props={{
          currentTab: Tab.MERGED,
          isEventRoute: false,
        }}
      />
      <Route
        path="grouping/"
        componentPromise={() => import('sentry/views/organizationGroupDetails/grouping')}
        component={SafeLazyLoad}
        props={{
          currentTab: Tab.GROUPING,
          isEventRoute: false,
        }}
      />
      <Route path="events/:eventId/">
        <IndexRoute
          componentPromise={() =>
            import('sentry/views/organizationGroupDetails/groupEventDetails')
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
            import('sentry/views/organizationGroupDetails/groupActivity')
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
            import('sentry/views/organizationGroupDetails/groupEvents')
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
            import('sentry/views/organizationGroupDetails/groupSimilarIssues')
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
            import('sentry/views/organizationGroupDetails/groupTags')
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
            import('sentry/views/organizationGroupDetails/groupTagValues')
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
            import('sentry/views/organizationGroupDetails/groupUserFeedback')
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
            import('sentry/views/organizationGroupDetails/groupEventAttachments')
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
            import('sentry/views/organizationGroupDetails/groupMerged')
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
            import('sentry/views/organizationGroupDetails/grouping')
          }
          component={SafeLazyLoad}
          props={{
            currentTab: Tab.GROUPING,
            isEventRoute: true,
          }}
        />
      </Route>
    </Route>
  );

  // These are the "manage" pages. For sentry.io, these are _different_ from
  // the SaaS admin routes in getsentry.
  const adminManageRoutes = (
    <Route
      name={t('Admin')}
      path="/manage/"
      componentPromise={() => import('sentry/views/admin/adminLayout')}
      component={SafeLazyLoad}
    >
      <IndexRoute
        componentPromise={() => import('sentry/views/admin/adminOverview')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Buffer')}
        path="buffer/"
        componentPromise={() => import('sentry/views/admin/adminBuffer')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Relays')}
        path="relays/"
        componentPromise={() => import('sentry/views/admin/adminRelays')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Organizations')}
        path="organizations/"
        componentPromise={() => import('sentry/views/admin/adminOrganizations')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Projects')}
        path="projects/"
        componentPromise={() => import('sentry/views/admin/adminProjects')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Queue')}
        path="queue/"
        componentPromise={() => import('sentry/views/admin/adminQueue')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Quotas')}
        path="quotas/"
        componentPromise={() => import('sentry/views/admin/adminQuotas')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Settings')}
        path="settings/"
        componentPromise={() => import('sentry/views/admin/adminSettings')}
        component={SafeLazyLoad}
      />
      <Route name={t('Users')} path="users/">
        <IndexRoute
          componentPromise={() => import('sentry/views/admin/adminUsers')}
          component={SafeLazyLoad}
        />
        <Route
          path=":id"
          componentPromise={() => import('sentry/views/admin/adminUserEdit')}
          component={SafeLazyLoad}
        />
      </Route>
      <Route
        name={t('Mail')}
        path="status/mail/"
        componentPromise={() => import('sentry/views/admin/adminMail')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Environment')}
        path="status/environment/"
        componentPromise={() => import('sentry/views/admin/adminEnvironment')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Packages')}
        path="status/packages/"
        componentPromise={() => import('sentry/views/admin/adminPackages')}
        component={SafeLazyLoad}
      />
      <Route
        name={t('Warnings')}
        path="status/warnings/"
        componentPromise={() => import('sentry/views/admin/adminWarnings')}
        component={SafeLazyLoad}
      />
      {hook('routes:admin')}
    </Route>
  );

  // XXX(epurkhiser): This should probably go away. It's not totally clear to
  // me why we need the OrganizationRoot root container.
  const legacyOrganizationRootRoutes = (
    <Route component={errorHandler(OrganizationRoot)}>
      <Route
        path="/organizations/:orgId/teams/new/"
        componentPromise={() => import('sentry/views/teamCreate')}
        component={SafeLazyLoad}
      />
      <Route path="/organizations/:orgId/">
        {hook('routes:organization')}
        <Redirect from="/organizations/:orgId/teams/" to="/settings/:orgId/teams/" />
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
        <Redirect from="/organizations/:orgId/members/" to="/settings/:orgId/members/" />
        <Redirect
          from="/organizations/:orgId/members/:memberId/"
          to="/settings/:orgId/members/:memberId/"
        />
        <Redirect
          from="/organizations/:orgId/rate-limits/"
          to="/settings/:orgId/rate-limits/"
        />
        <Redirect from="/organizations/:orgId/repos/" to="/settings/:orgId/repos/" />
      </Route>
    </Route>
  );

  // XXX(epurkhiser): These also exist in the legacyOrganizationRootRoutes. Not
  // sure which one here is more correct.
  const legacyGettingStartedRoutes = (
    <Route
      path="/:orgId/:projectId/getting-started/"
      componentPromise={() => import('sentry/views/projectInstall/gettingStarted')}
      component={SafeLazyLoad}
    >
      <IndexRoute
        componentPromise={() => import('sentry/views/projectInstall/overview')}
        component={SafeLazyLoad}
      />
      <Route
        path=":platform/"
        componentPromise={() =>
          import('sentry/views/projectInstall/platformOrIntegration')
        }
        component={SafeLazyLoad}
      />
    </Route>
  );

  // Support for deprecated URLs (pre-Sentry 10). We just redirect users to new
  // canonical URLs.
  //
  // XXX(epurkhiser): Can these be moved over to the legacyOrgRedirects routes,
  // or do these need to be nested into the OrganizationDetails tree?
  const legacyOrgRedirects = (
    <Route name={t('Organization')} path="/:orgId/:projectId/">
      <IndexRoute
        component={errorHandler(
          redirectDeprecatedProjectRoute(
            ({orgId, projectId}) => `/organizations/${orgId}/issues/?project=${projectId}`
          )
        )}
      />
      <Route
        path="issues/"
        component={errorHandler(
          redirectDeprecatedProjectRoute(
            ({orgId, projectId}) => `/organizations/${orgId}/issues/?project=${projectId}`
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
  );

  const profilingRoutes = (
    <Route
      path="/organizations/:orgId/profiling/"
      componentPromise={() => import('sentry/views/profiling')}
      component={SafeLazyLoad}
    >
      <IndexRoute
        componentPromise={() => import('sentry/views/profiling/content')}
        component={SafeLazyLoad}
      />
      <Route
        path="flamegraph/:projectId/:eventId"
        component={SafeLazyLoad}
        componentPromise={() => import('sentry/views/profiling/flamegraph')}
      />
    </Route>
  );

  const organizationRoutes = (
    <Route component={errorHandler(OrganizationDetails)}>
      {settingsRoutes}
      {projectsRoutes}
      {dashboardRoutes}
      {userFeedbackRoutes}
      {issueListRoutes}
      {groupDetailsRoutes}
      {alertRoutes}
      {monitorsRoutes}
      {releasesRoutes}
      {activityRoutes}
      {statsRoutes}
      {discoverRoutes}
      {performanceRoutes}
      {profilingRoutes}
      {adminManageRoutes}
      {legacyOrganizationRootRoutes}
      {legacyGettingStartedRoutes}
      {legacyOrgRedirects}
    </Route>
  );

  const legacyRedirectRoutes = (
    <Route path="/:orgId/">
      <IndexRedirect to="/organizations/:orgId/" />
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
        <Redirect from="tags/" to="/settings/projects/:orgId/projects/:projectId/tags/" />
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
  );

  const appRoutes = (
    <Route>
      {experimentalSpaRoutes}
      <Route path="/" component={errorHandler(App)}>
        {rootRoutes}
        {organizationRoutes}
        {legacyRedirectRoutes}
        {hook('routes')}
        <Route path="*" component={errorHandler(RouteNotFound)} />
      </Route>
    </Route>
  );

  return appRoutes;
}

// We load routes both when initlaizing the SDK (for routing integrations) and
// when the app renders Main. Memoize to avoid rebuilding the route tree.
const routes = memoize(buildRoutes);

export default routes;
