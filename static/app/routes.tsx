import {Fragment, lazy} from 'react';
import memoize from 'lodash/memoize';

import LazyLoad from 'sentry/components/lazyLoad';
import {EXPERIMENTAL_SPA, USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import type {HookName} from 'sentry/types/hooks';
import errorHandler from 'sentry/utils/errorHandler';
import {ProvideAriaRouter} from 'sentry/utils/provideAriaRouter';
import retryableImport from 'sentry/utils/retryableImport';
import withDomainRedirect from 'sentry/utils/withDomainRedirect';
import withDomainRequired from 'sentry/utils/withDomainRequired';
import App from 'sentry/views/app';
import {AppBodyContent} from 'sentry/views/app/appBodyContent';
import AuthLayout from 'sentry/views/auth/layout';
import {automationRoutes} from 'sentry/views/automations/routes';
import {detectorRoutes} from 'sentry/views/detectors/routes';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {SUMMARY_PAGE_BASE_URL} from 'sentry/views/insights/mobile/screenRendering/settings';
import {AI_LANDING_SUB_PATH} from 'sentry/views/insights/pages/ai/settings';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {getModuleView} from 'sentry/views/insights/pages/utils';
import {INSIGHTS_BASE_URL} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';
import {GroupEventDetailsLoading} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsLoading';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {OverviewWrapper} from 'sentry/views/issueList/overviewWrapper';
import {IssueNavigation} from 'sentry/views/issues/navigation';
import OrganizationContainer from 'sentry/views/organizationContainer';
import OrganizationLayout from 'sentry/views/organizationLayout';
import OrganizationRoot from 'sentry/views/organizationRoot';
import {OrganizationStatsWrapper} from 'sentry/views/organizationStats/organizationStatsWrapper';
import ProjectEventRedirect from 'sentry/views/projectEventRedirect';
import redirectDeprecatedProjectRoute from 'sentry/views/projects/redirectDeprecatedProjectRoute';
import RouteNotFound from 'sentry/views/routeNotFound';
import SettingsWrapper from 'sentry/views/settings/components/settingsWrapper';

import {IndexRedirect, IndexRoute, Redirect, Route} from './components/route';

const hook = (name: HookName) => HookStore.get(name).map(cb => cb());

// LazyExoticComponent Props get crazy when wrapped in an additional layer
const SafeLazyLoad = errorHandler(LazyLoad) as unknown as React.ComponentType<
  typeof LazyLoad
>;

// NOTE: makeLazyloadComponent is exported for use in the sentry.io (getsentry)
// pirvate routing tree.

/**
 * Factory function to produce a component that will render the SafeLazyLoad
 * _with_ the required props.
 */
export function makeLazyloadComponent<C extends React.ComponentType<any>>(
  resolve: () => Promise<{default: C}>,
  loadingFallback?: React.ReactNode
) {
  const LazyComponent = lazy<C>(() => retryableImport(resolve));
  // XXX: Assign the component to a variable so it has a displayname
  function RouteLazyLoad(props: React.ComponentProps<C>) {
    // we can use this hook to set the organization as it's
    // a child of the organization context
    return (
      <SafeLazyLoad
        {...props}
        LazyComponent={LazyComponent}
        loadingFallback={loadingFallback}
      />
    );
  }

  return RouteLazyLoad;
}

// Shorthand to avoid extra line wrapping
const make = makeLazyloadComponent;

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
  //   the <OrganizationLayout /> component, which renders the sidebar and
  //   loads the organiztion into context (though in some cases, there may be
  //   no organiztion)
  //
  //   When adding new top-level organization routes, be sure the top level
  //   route includes withOrgPath to support installs that are not using
  //   customer domains.
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
      <IndexRoute component={make(() => import('sentry/views/auth/login'))} />
      <Route path=":orgId/" component={make(() => import('sentry/views/auth/login'))} />
    </Route>
  ) : null;

  const traceViewRoute = (
    <Route
      path="trace/:traceSlug/"
      component={make(() => import('sentry/views/performance/traceDetails'))}
    />
  );

  const rootRoutes = (
    <Route component={errorHandler(AppBodyContent)}>
      <IndexRoute component={make(() => import('sentry/views/app/root'))} />
      {hook('routes:root')}
      <Route
        path="/accept/:orgId/:memberId/:token/"
        component={make(() => import('sentry/views/acceptOrganizationInvite'))}
      />
      <Route
        path="/accept/:memberId/:token/"
        component={make(() => import('sentry/views/acceptOrganizationInvite'))}
      />
      <Route
        path="/accept-transfer/"
        component={make(() => import('sentry/views/acceptProjectTransfer'))}
      />
      <Route component={errorHandler(OrganizationContainer)}>
        <Route
          path="/extensions/external-install/:integrationSlug/:installationId"
          component={make(() => import('sentry/views/integrationOrganizationLink'))}
        />
        <Route
          path="/extensions/:integrationSlug/link/"
          component={make(() => import('sentry/views/integrationOrganizationLink'))}
        />
      </Route>
      <Route
        path="/sentry-apps/:sentryAppSlug/external-install/"
        component={make(() => import('sentry/views/sentryAppExternalInstallation'))}
      />
      <Redirect from="/account/" to="/settings/account/details/" />
      <Redirect from="/share/group/:shareId/" to="/share/issue/:shareId/" />
      {/* TODO: remove share/issue orgless url */}
      <Route
        path="/share/issue/:shareId/"
        component={make(() => import('sentry/views/sharedGroupDetails'))}
      />
      <Route
        path="/organizations/:orgId/share/issue/:shareId/"
        component={make(() => import('sentry/views/sharedGroupDetails'))}
      />
      {USING_CUSTOMER_DOMAIN && (
        <Route
          path="/unsubscribe/project/:id/"
          component={make(() => import('sentry/views/unsubscribe/project'))}
        />
      )}
      <Route
        path="/unsubscribe/:orgId/project/:id/"
        component={make(() => import('sentry/views/unsubscribe/project'))}
      />
      {USING_CUSTOMER_DOMAIN && (
        <Route
          path="/unsubscribe/issue/:id/"
          component={make(() => import('sentry/views/unsubscribe/issue'))}
        />
      )}
      <Route
        path="/unsubscribe/:orgId/issue/:id/"
        component={make(() => import('sentry/views/unsubscribe/issue'))}
      />
      <Route
        path="/organizations/new/"
        component={make(() => import('sentry/views/organizationCreate'))}
      />
      <Route
        path="/data-export/:dataExportId"
        component={make(() => import('sentry/views/dataExport/dataDownload'))}
        withOrgPath
      />
      <Route component={errorHandler(OrganizationContainer)}>
        <Route
          path="/disabled-member/"
          component={make(() => import('sentry/views/disabledMember'))}
          withOrgPath
        />
      </Route>
      {USING_CUSTOMER_DOMAIN && (
        <Route
          path="/restore/"
          component={make(() => import('sentry/views/organizationRestore'))}
        />
      )}
      <Route
        path="/organizations/:orgId/restore/"
        component={make(() => import('sentry/views/organizationRestore'))}
      />
      {USING_CUSTOMER_DOMAIN && (
        <Route
          path="/join-request/"
          component={withDomainRequired(
            make(() => import('sentry/views/organizationJoinRequest'))
          )}
          key="orgless-join-request"
        />
      )}
      <Route
        path="/join-request/:orgId/"
        component={withDomainRedirect(
          make(() => import('sentry/views/organizationJoinRequest'))
        )}
        key="org-join-request"
      />
      <Route
        path="/relocation/"
        component={make(() => import('sentry/views/relocation'))}
        key="orgless-relocation"
      >
        <IndexRedirect to="get-started/" />
        <Route path=":step/" component={make(() => import('sentry/views/relocation'))} />
      </Route>
      {USING_CUSTOMER_DOMAIN && (
        <Fragment>
          <Redirect from="/onboarding/" to="/onboarding/welcome/" />
          <Route
            path="/onboarding/:step/"
            component={errorHandler(withDomainRequired(OrganizationContainer))}
            key="orgless-onboarding"
          >
            <IndexRoute component={make(() => import('sentry/views/onboarding'))} />
          </Route>
        </Fragment>
      )}
      <Redirect from="/onboarding/:orgId/" to="/onboarding/:orgId/welcome/" />
      <Route
        path="/onboarding/:orgId/:step/"
        component={withDomainRedirect(errorHandler(OrganizationContainer))}
        key="org-onboarding"
      >
        <IndexRoute component={make(() => import('sentry/views/onboarding'))} />
      </Route>
      <Route
        path="/stories/"
        component={make(() => import('sentry/views/stories/index'))}
        withOrgPath
      />
    </Route>
  );

  const accountSettingsRoutes = (
    <Route
      path="account/"
      name={t('Account')}
      component={make(
        () => import('sentry/views/settings/account/accountSettingsLayout')
      )}
    >
      <IndexRedirect to="details/" />
      <Route
        path="details/"
        name={t('Details')}
        component={make(() => import('sentry/views/settings/account/accountDetails'))}
      />
      <Route path="notifications/" name={t('Notifications')}>
        <IndexRoute
          component={make(
            () =>
              import(
                'sentry/views/settings/account/notifications/notificationSettingsController'
              )
          )}
        />
        <Route
          path=":fineTuneType/"
          name={t('Fine Tune Alerts')}
          component={make(
            () =>
              import(
                'sentry/views/settings/account/accountNotificationFineTuningController'
              )
          )}
        />
      </Route>
      <Route
        path="emails/"
        name={t('Emails')}
        component={make(() => import('sentry/views/settings/account/accountEmails'))}
      />
      <Route
        path="authorizations/"
        component={make(
          () => import('sentry/views/settings/account/accountAuthorizations')
        )}
      />
      <Route path="security/" name={t('Security')}>
        <Route
          component={make(
            () =>
              import(
                'sentry/views/settings/account/accountSecurity/accountSecurityWrapper'
              )
          )}
        >
          <IndexRoute
            component={make(
              () => import('sentry/views/settings/account/accountSecurity')
            )}
          />
          <Route
            path="session-history/"
            name={t('Session History')}
            component={make(
              () => import('sentry/views/settings/account/accountSecurity/sessionHistory')
            )}
          />
          <Route
            path="mfa/:authId/"
            name={t('Details')}
            component={make(
              () =>
                import(
                  'sentry/views/settings/account/accountSecurity/accountSecurityDetails'
                )
            )}
          />
        </Route>
        <Route
          path="mfa/:authId/enroll/"
          name={t('Enroll')}
          component={make(
            () =>
              import(
                'sentry/views/settings/account/accountSecurity/accountSecurityEnroll'
              )
          )}
        />
      </Route>
      <Route
        path="subscriptions/"
        name={t('Subscriptions')}
        component={make(
          () => import('sentry/views/settings/account/accountSubscriptions')
        )}
      />
      <Route
        path="identities/"
        name={t('Identities')}
        component={make(() => import('sentry/views/settings/account/accountIdentities'))}
      />
      <Route path="api/" name={t('API')}>
        <IndexRedirect to="auth-tokens/" />
        <Route path="auth-tokens/" name={t('User Auth Tokens')}>
          <IndexRoute
            component={make(() => import('sentry/views/settings/account/apiTokens'))}
          />
          <Route
            path="new-token/"
            name={t('Create New Token')}
            component={make(() => import('sentry/views/settings/account/apiNewToken'))}
          />
          <Route
            path=":tokenId/"
            name={t('Edit User Auth Token')}
            component={make(
              () => import('sentry/views/settings/account/apiTokenDetails')
            )}
          />
        </Route>
        <Route path="applications/" name={t('Applications')}>
          <IndexRoute
            component={make(
              () => import('sentry/views/settings/account/apiApplications')
            )}
          />
          <Route
            path=":appId/"
            name={t('Details')}
            component={make(
              () => import('sentry/views/settings/account/apiApplications/details')
            )}
          />
        </Route>
      </Route>
      <Route
        path="close-account/"
        name={t('Close Account')}
        component={make(() => import('sentry/views/settings/account/accountClose'))}
      />
    </Route>
  );

  const projectSettingsRoutes = (
    <Route
      path="projects/:projectId/"
      name={t('Project')}
      component={make(
        () => import('sentry/views/settings/project/projectSettingsLayout')
      )}
    >
      <IndexRoute
        name={t('General')}
        component={make(() => import('sentry/views/settings/projectGeneralSettings'))}
      />
      <Redirect from="install/" to="/projects/:projectId/getting-started/" />
      <Route
        path="teams/"
        name={t('Teams')}
        component={make(() => import('sentry/views/settings/project/projectTeams'))}
      />
      <Route
        path="alerts/"
        name={t('Alerts')}
        component={make(() => import('sentry/views/settings/projectAlerts'))}
      >
        <IndexRoute
          component={make(() => import('sentry/views/settings/projectAlerts/settings'))}
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
        path="environments/"
        name={t('Environments')}
        component={make(
          () => import('sentry/views/settings/project/projectEnvironments')
        )}
      >
        <IndexRoute />
        <Route path="hidden/" />
      </Route>
      <Route
        path="tags/"
        name={t('Tags & Context')}
        component={make(() => import('sentry/views/settings/projectTags'))}
      />
      <Redirect from="issue-tracking/" to="/settings/:orgId/:projectId/plugins/" />
      <Route
        path="release-tracking/"
        name={t('Release Tracking')}
        component={make(
          () => import('sentry/views/settings/project/projectReleaseTracking')
        )}
      />
      <Route
        path="ownership/"
        name={t('Ownership Rules')}
        component={make(() => import('sentry/views/settings/project/projectOwnership'))}
      />
      <Route
        path="data-forwarding/"
        name={t('Data Forwarding')}
        component={make(() => import('sentry/views/settings/projectDataForwarding'))}
      />
      <Route
        path="user-feedback/"
        name={t('User Feedback')}
        component={make(() => import('sentry/views/settings/projectUserFeedback'))}
      />
      <Route path="security-and-privacy/" name={t('Security & Privacy')}>
        <IndexRoute
          component={make(
            () => import('sentry/views/settings/projectSecurityAndPrivacy')
          )}
        />
        <Route
          path="advanced-data-scrubbing/:scrubbingId/"
          component={make(
            () => import('sentry/views/settings/projectSecurityAndPrivacy')
          )}
        />
      </Route>
      <Route
        path="debug-symbols/"
        name={t('Debug Information Files')}
        component={make(() => import('sentry/views/settings/projectDebugFiles'))}
      />
      <Route
        path="proguard/"
        name={t('ProGuard Mappings')}
        component={make(() => import('sentry/views/settings/projectProguard'))}
      />
      <Route
        path="performance/"
        name={t('Performance')}
        component={make(() => import('sentry/views/settings/projectPerformance'))}
      />

      <Route
        path="playstation/"
        name={t('PlayStation')}
        component={make(() => import('sentry/views/settings/project/tempest'))}
      />
      <Route
        path="replays/"
        name={t('Replays')}
        component={make(() => import('sentry/views/settings/project/projectReplays'))}
      />
      <Route
        path="toolbar/"
        name={t('Developer Toolbar')}
        component={make(() => import('sentry/views/settings/project/projectToolbar'))}
      />
      <Route path="source-maps/" name={t('Source Maps')}>
        <IndexRoute
          component={make(() => import('sentry/views/settings/projectSourceMaps'))}
        />
        <Route
          name={t('Source Map Uploads')}
          path=":bundleId/"
          component={make(() => import('sentry/views/settings/projectSourceMaps'))}
        />
        <Redirect from="source-maps/artifact-bundles/" to="source-maps/" />
        <Redirect from="source-maps/release-bundles/" to="source-maps/" />
      </Route>
      <Route
        path="filters/"
        name={t('Inbound Filters')}
        component={make(() => import('sentry/views/settings/project/projectFilters'))}
      >
        <IndexRedirect to="data-filters/" />
        <Route path=":filterType/" />
      </Route>
      <Redirect from="dynamic-sampling/" to="performance/" />
      <Route
        path="issue-grouping/"
        name={t('Issue Grouping')}
        component={make(() => import('sentry/views/settings/projectIssueGrouping'))}
      />
      <Route
        path="hooks/"
        name={t('Service Hooks')}
        component={make(
          () => import('sentry/views/settings/project/projectServiceHooks')
        )}
      />
      <Route
        path="hooks/new/"
        name={t('Create Service Hook')}
        component={make(
          () => import('sentry/views/settings/project/projectCreateServiceHook')
        )}
      />
      <Route
        path="hooks/:hookId/"
        name={t('Service Hook Details')}
        component={make(
          () => import('sentry/views/settings/project/projectServiceHookDetails')
        )}
      />
      <Route path="keys/" name={t('Client Keys')}>
        <IndexRoute
          component={make(() => import('sentry/views/settings/project/projectKeys/list'))}
        />
        <Route
          path=":keyId/"
          name={t('Details')}
          component={make(
            () => import('sentry/views/settings/project/projectKeys/details')
          )}
        />
      </Route>
      <Route
        path="loader-script/"
        name={t('Loader Script')}
        component={make(() => import('sentry/views/settings/project/loaderScript'))}
      />
      <Redirect
        from="csp/"
        to="/settings/:orgId/projects/:projectId/security-headers/csp/"
      />
      <Route path="security-headers/" name={t('Security Headers')}>
        <IndexRoute
          component={make(() => import('sentry/views/settings/projectSecurityHeaders'))}
        />
        <Route
          path="csp/"
          name={t('Content Security Policy')}
          component={make(
            () => import('sentry/views/settings/projectSecurityHeaders/csp')
          )}
        />
        <Route
          path="expect-ct/"
          name={t('Certificate Transparency')}
          component={make(
            () => import('sentry/views/settings/projectSecurityHeaders/expectCt')
          )}
        />
        <Route
          path="hpkp/"
          name={t('HPKP')}
          component={make(
            () => import('sentry/views/settings/projectSecurityHeaders/hpkp')
          )}
        />
      </Route>
      <Route path="plugins/" name={t('Legacy Integrations')}>
        <IndexRoute
          component={make(() => import('sentry/views/settings/projectPlugins'))}
        />
        <Route
          path=":pluginId/"
          name={t('Integration Details')}
          component={make(() => import('sentry/views/settings/projectPlugins/details'))}
        />
      </Route>
    </Route>
  );

  const statsChildRoutes = (
    <Fragment>
      <IndexRoute component={make(() => import('sentry/views/organizationStats'))} />
      <Route
        component={make(() => import('sentry/views/organizationStats/teamInsights'))}
      >
        <Route
          path="issues/"
          component={make(
            () => import('sentry/views/organizationStats/teamInsights/issues')
          )}
        />
        <Route
          path="health/"
          component={make(
            () => import('sentry/views/organizationStats/teamInsights/health')
          )}
        />
      </Route>
    </Fragment>
  );
  const statsRoutes = (
    <Fragment>
      <Route path="/stats/" withOrgPath component={OrganizationStatsWrapper}>
        {statsChildRoutes}
      </Route>
      <Redirect
        from="/organizations/:orgId/stats/team/"
        to="/organizations/:orgId/stats/issues/"
      />
    </Fragment>
  );

  const orgSettingsRoutes = (
    <Route
      component={make(
        () => import('sentry/views/settings/organization/organizationSettingsLayout')
      )}
    >
      {hook('routes:settings')}
      {!USING_CUSTOMER_DOMAIN && (
        <IndexRoute
          name={t('General')}
          component={make(
            () => import('sentry/views/settings/organizationGeneralSettings')
          )}
        />
      )}
      <Route
        path="organization/"
        name={t('General')}
        component={make(
          () => import('sentry/views/settings/organizationGeneralSettings')
        )}
      />
      <Route
        path="projects/"
        name={t('Projects')}
        component={make(() => import('sentry/views/settings/organizationProjects'))}
      />
      <Route path="api-keys/" name={t('API Key')}>
        <IndexRoute
          component={make(() => import('sentry/views/settings/organizationApiKeys'))}
        />
        <Route
          path=":apiKey/"
          name={t('Details')}
          component={make(
            () =>
              import(
                'sentry/views/settings/organizationApiKeys/organizationApiKeyDetails'
              )
          )}
        />
      </Route>
      <Route
        path="audit-log/"
        name={t('Audit Log')}
        component={make(() => import('sentry/views/settings/organizationAuditLog'))}
      />
      <Route
        path="auth/"
        name={t('Auth Providers')}
        component={make(() => import('sentry/views/settings/organizationAuth'))}
      />
      <Redirect from="members/requests" to="../members/" />
      <Route path="members/" name={t('Members')}>
        <IndexRoute
          component={make(
            () =>
              import('sentry/views/settings/organizationMembers/organizationMembersList')
          )}
        />
        <Route
          path=":memberId/"
          name={t('Details')}
          component={make(
            () =>
              import('sentry/views/settings/organizationMembers/organizationMemberDetail')
          )}
        />
      </Route>
      <Route
        path="rate-limits/"
        name={t('Rate Limits')}
        component={make(() => import('sentry/views/settings/organizationRateLimits'))}
      />
      <Route
        path="relay/"
        name={t('Relay')}
        component={make(() => import('sentry/views/settings/organizationRelay'))}
      />
      <Route
        path="repos/"
        name={t('Repositories')}
        component={make(() => import('sentry/views/settings/organizationRepositories'))}
      />
      <Route
        path="settings/"
        component={make(
          () => import('sentry/views/settings/organizationGeneralSettings')
        )}
      />
      <Route path="security-and-privacy/" name={t('Security & Privacy')}>
        <IndexRoute
          component={make(
            () => import('sentry/views/settings/organizationSecurityAndPrivacy')
          )}
        />
        <Route
          path="advanced-data-scrubbing/:scrubbingId/"
          component={make(
            () => import('sentry/views/settings/organizationSecurityAndPrivacy')
          )}
        />
      </Route>
      <Route path="teams/" name={t('Teams')}>
        <IndexRoute
          component={make(() => import('sentry/views/settings/organizationTeams'))}
        />
        <Route
          path=":teamId/"
          name={t('Team')}
          component={make(
            () => import('sentry/views/settings/organizationTeams/teamDetails')
          )}
        >
          <IndexRedirect to="members/" />
          <Route
            path="members/"
            name={t('Members')}
            component={make(
              () => import('sentry/views/settings/organizationTeams/teamMembers')
            )}
          />
          <Route
            path="notifications/"
            name={t('Notifications')}
            component={make(
              () => import('sentry/views/settings/organizationTeams/teamNotifications')
            )}
          />
          <Route
            path="projects/"
            name={t('Projects')}
            component={make(
              () => import('sentry/views/settings/organizationTeams/teamProjects')
            )}
          />
          <Route
            path="settings/"
            name={t('Settings')}
            component={make(
              () => import('sentry/views/settings/organizationTeams/teamSettings')
            )}
          />
        </Route>
      </Route>
      <Redirect from="plugins/" to="integrations/" />
      <Route path="plugins/" name={t('Integrations')}>
        <Route
          path=":integrationSlug/"
          name={t('Integration Details')}
          component={make(
            () =>
              import('sentry/views/settings/organizationIntegrations/pluginDetailedView')
          )}
        />
      </Route>
      <Redirect from="sentry-apps/" to="integrations/" />
      <Route path="sentry-apps/" name={t('Integrations')}>
        <Route
          path=":integrationSlug"
          name={t('Details')}
          component={make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/sentryAppDetailedView'
              )
          )}
        />
      </Route>
      <Redirect from="document-integrations/" to="integrations/" />
      <Route path="document-integrations/" name={t('Integrations')}>
        <Route
          path=":integrationSlug"
          name={t('Details')}
          component={make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/docIntegrationDetailedView'
              )
          )}
        />
      </Route>
      <Route path="integrations/" name={t('Integrations')}>
        <IndexRoute
          component={make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/integrationListDirectory'
              )
          )}
        />
        <Route
          path=":integrationSlug"
          name={t('Integration Details')}
          component={make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/integrationDetailedView'
              )
          )}
        />
        <Route
          path=":providerKey/:integrationId/"
          name={t('Configure Integration')}
          component={make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/configureIntegration'
              )
          )}
        />
      </Route>
      <Route path="developer-settings/" name={t('Custom Integrations')}>
        <IndexRoute
          component={make(
            () => import('sentry/views/settings/organizationDeveloperSettings')
          )}
        />
        <Route
          path="new-public/"
          name={t('Create Integration')}
          component={make(
            () =>
              import(
                'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
              )
          )}
        />
        <Route
          path="new-internal/"
          name={t('Create Integration')}
          component={make(
            () =>
              import(
                'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
              )
          )}
        />
        <Route
          path=":appSlug/"
          name={t('Edit Integration')}
          component={make(
            () =>
              import(
                'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
              )
          )}
        />
        <Route
          path=":appSlug/dashboard/"
          name={t('Integration Dashboard')}
          component={make(
            () =>
              import(
                'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDashboard'
              )
          )}
        />
      </Route>
      <Route path="auth-tokens/" name={t('Auth Tokens')}>
        <IndexRoute
          component={make(() => import('sentry/views/settings/organizationAuthTokens'))}
        />
        <Route
          path="new-token/"
          name={t('Create New Auth Token')}
          component={make(
            () => import('sentry/views/settings/organizationAuthTokens/newAuthToken')
          )}
        />
        <Route
          path=":tokenId/"
          name={t('Edit Auth Token')}
          component={make(
            () => import('sentry/views/settings/organizationAuthTokens/authTokenDetails')
          )}
        />
      </Route>
      <Route
        path="early-features/"
        name={t('Early Features')}
        component={make(() => import('sentry/views/settings/earlyFeatures'))}
      />
      <Route
        path="dynamic-sampling/"
        name={t('Dynamic Sampling')}
        component={make(() => import('sentry/views/settings/dynamicSampling'))}
      />
      <Route path="feature-flags/" name={t('Feature Flags')}>
        <IndexRoute
          component={make(() => import('sentry/views/settings/featureFlags'))}
        />
        <Route path="change-tracking/" name={t('Change Tracking')}>
          <IndexRoute
            component={make(
              () => import('sentry/views/settings/featureFlags/changeTracking')
            )}
          />
          <Route
            path="new-provider/"
            name={t('Add New Provider')}
            component={make(
              () =>
                import(
                  'sentry/views/settings/featureFlags/changeTracking/organizationFeatureFlagsNewSecret'
                )
            )}
          />
        </Route>
      </Route>
      <Route path="stats/" name={t('Stats')}>
        {statsChildRoutes}
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
      <IndexRoute component={make(() => import('sentry/views/settings/settingsIndex'))} />
      {accountSettingsRoutes}
      <Fragment>
        {USING_CUSTOMER_DOMAIN && (
          <Route
            name={t('Organization')}
            component={withDomainRequired(NoOp)}
            key="orgless-settings-route"
          >
            {orgSettingsRoutes}
            {projectSettingsRoutes}
          </Route>
        )}
        <Route
          path=":orgId/"
          name={t('Organization')}
          component={withDomainRedirect(NoOp)}
          key="org-settings"
        >
          {orgSettingsRoutes}
          {projectSettingsRoutes}
          {legacySettingsRedirects}
        </Route>
      </Fragment>
    </Route>
  );

  const projectsChildRoutes = (
    <Fragment>
      <IndexRoute component={make(() => import('sentry/views/projectsDashboard'))} />
      <Route
        path="new/"
        component={make(() => import('sentry/views/projectInstall/newProject'))}
      />
      <Route
        path=":projectId/"
        component={make(() => import('sentry/views/projectDetail'))}
      />
      <Route
        path=":projectId/events/:eventId/"
        component={errorHandler(ProjectEventRedirect)}
      />
      <Route
        path=":projectId/getting-started/"
        component={make(
          () => import('sentry/views/projectInstall/platformOrIntegration')
        )}
      />
    </Fragment>
  );
  const projectsRoutes = (
    <Route
      path="/projects/"
      component={make(() => import('sentry/views/projects/'))}
      withOrgPath
    >
      {projectsChildRoutes}
    </Route>
  );

  const dashboardRoutes = (
    <Route component={make(() => import('sentry/views/dashboards/navigation'))}>
      <Fragment>
        {USING_CUSTOMER_DOMAIN && (
          <Route
            path="/dashboards/"
            component={withDomainRequired(make(() => import('sentry/views/dashboards')))}
            key="orgless-dashboards-route"
          >
            <IndexRoute
              component={make(() => import('sentry/views/dashboards/manage'))}
            />
            {traceViewRoute}
          </Route>
        )}
        <Route
          path="/organizations/:orgId/dashboards/"
          component={withDomainRedirect(make(() => import('sentry/views/dashboards')))}
          key="org-dashboards"
        >
          <IndexRoute component={make(() => import('sentry/views/dashboards/manage'))} />
        </Route>
      </Fragment>
      <Fragment>
        {USING_CUSTOMER_DOMAIN && (
          <Route
            path="/dashboards/new/"
            component={withDomainRequired(
              make(() => import('sentry/views/dashboards/create'))
            )}
            key="orgless-dashboards-new-route"
          >
            {/* New widget builder routes */}
            <Route
              path="widget-builder/widget/:widgetIndex/edit/"
              component={make(() => import('sentry/views/dashboards/view'))}
            />
            <Route
              path="widget-builder/widget/new/"
              component={make(() => import('sentry/views/dashboards/view'))}
            />

            {/* Old widget builder routes */}
            <Route
              path="widget/:widgetIndex/edit/"
              component={make(() => import('sentry/views/dashboards/widgetBuilder'))}
            />
            <Route
              path="widget/new/"
              component={make(() => import('sentry/views/dashboards/widgetBuilder'))}
            />
          </Route>
        )}
        <Route
          path="/organizations/:orgId/dashboards/new/"
          component={withDomainRedirect(
            make(() => import('sentry/views/dashboards/create'))
          )}
          key="org-dashboards-new"
        >
          {/* New widget builder routes */}
          <Route
            path="widget-builder/widget/:widgetIndex/edit/"
            component={make(() => import('sentry/views/dashboards/view'))}
          />
          <Route
            path="widget-builder/widget/new/"
            component={make(() => import('sentry/views/dashboards/view'))}
          />

          {/* Old widget builder routes */}
          <Route
            path="widget/:widgetIndex/edit/"
            component={make(() => import('sentry/views/dashboards/widgetBuilder'))}
          />
          <Route
            path="widget/new/"
            component={make(() => import('sentry/views/dashboards/widgetBuilder'))}
          />
        </Route>
      </Fragment>
      <Fragment>
        {USING_CUSTOMER_DOMAIN && (
          <Route
            path="/dashboards/new/:templateId"
            component={withDomainRequired(
              make(() => import('sentry/views/dashboards/create'))
            )}
            key="orgless-dashboards-new-template-route"
          >
            <Route
              path="widget/:widgetId/"
              component={make(() => import('sentry/views/dashboards/create'))}
            />
          </Route>
        )}
        <Route
          path="/organizations/:orgId/dashboards/new/:templateId"
          component={withDomainRedirect(
            make(() => import('sentry/views/dashboards/create'))
          )}
          key="org-dashboards-new-template"
        >
          <Route
            path="widget/:widgetId/"
            component={make(() => import('sentry/views/dashboards/create'))}
          />
        </Route>
      </Fragment>
      <Redirect
        from="/organizations/:orgId/dashboards/:dashboardId/"
        to="/organizations/:orgId/dashboard/:dashboardId/"
      />
      {USING_CUSTOMER_DOMAIN && (
        <Redirect from="/dashboards/:dashboardId/" to="/dashboard/:dashboardId/" />
      )}
      <Route
        path="/dashboard/:dashboardId/"
        component={make(() => import('sentry/views/dashboards/view'))}
        withOrgPath
      >
        {/* New widget builder routes */}
        <Route
          path="widget-builder/widget/:widgetIndex/edit/"
          component={make(() => import('sentry/views/dashboards/view'))}
        />
        <Route
          path="widget-builder/widget/new/"
          component={make(() => import('sentry/views/dashboards/view'))}
        />

        {/* Old widget builder routes */}
        <Route
          path="widget/:widgetIndex/edit/"
          component={make(() => import('sentry/views/dashboards/widgetBuilder'))}
        />
        <Route
          path="widget/new/"
          component={make(() => import('sentry/views/dashboards/widgetBuilder'))}
        />
        <Route
          path="widget/:widgetId/"
          component={make(() => import('sentry/views/dashboards/view'))}
        />
      </Route>
    </Route>
  );

  const alertChildRoutes = ({forCustomerDomain}: {forCustomerDomain: boolean}) => {
    // ALERT CHILD ROUTES
    return (
      <Fragment>
        <IndexRoute
          component={make(() => import('sentry/views/alerts/list/incidents'))}
        />
        <Route path="rules/">
          <IndexRoute
            component={make(
              () => import('sentry/views/alerts/list/rules/alertRulesList')
            )}
          />
          <Route
            path="details/:ruleId/"
            component={make(() => import('sentry/views/alerts/rules/metric/details'))}
          />
          <Route
            path=":projectId/"
            component={make(() => import('sentry/views/alerts/builder/projectProvider'))}
          >
            <IndexRedirect
              to={
                forCustomerDomain
                  ? '/alerts/rules/'
                  : '/organizations/:orgId/alerts/rules/'
              }
            />
            <Route
              path=":ruleId/"
              component={make(() => import('sentry/views/alerts/edit'))}
            />
          </Route>
          <Route path=":projectId/:ruleId/details/">
            <IndexRoute
              component={make(
                () => import('sentry/views/alerts/rules/issue/details/ruleDetails')
              )}
            />
          </Route>
          <Route
            path="uptime/"
            component={make(() => import('sentry/views/alerts/rules/uptime'))}
          >
            <Route
              path=":projectId/:uptimeRuleId/details/"
              component={make(() => import('sentry/views/alerts/rules/uptime/details'))}
            />
            <Route
              path="existing-or-create/"
              component={make(
                () => import('sentry/views/alerts/rules/uptime/existingOrCreate')
              )}
            />
          </Route>
          <Route
            path="crons/"
            component={make(() => import('sentry/views/alerts/rules/crons'))}
          >
            <Route
              path=":projectId/:monitorSlug/details/"
              component={make(() => import('sentry/views/alerts/rules/crons/details'))}
            />
          </Route>
        </Route>
        <Route path="metric-rules/">
          <IndexRedirect
            to={
              forCustomerDomain ? '/alerts/rules/' : '/organizations/:orgId/alerts/rules/'
            }
          />
          <Route
            path=":projectId/"
            component={make(() => import('sentry/views/alerts/builder/projectProvider'))}
          >
            <IndexRedirect
              to={
                forCustomerDomain
                  ? '/alerts/rules/'
                  : '/organizations/:orgId/alerts/rules/'
              }
            />
            <Route
              path=":ruleId/"
              component={make(() => import('sentry/views/alerts/edit'))}
            />
          </Route>
        </Route>
        <Route path="uptime-rules/">
          <Route
            path=":projectId/"
            component={make(() => import('sentry/views/alerts/builder/projectProvider'))}
          >
            <Route
              path=":ruleId/"
              component={make(() => import('sentry/views/alerts/edit'))}
            />
          </Route>
        </Route>
        <Route path="crons-rules/">
          <Route
            path=":projectId/"
            component={make(() => import('sentry/views/alerts/builder/projectProvider'))}
          >
            <Route
              path=":monitorSlug/"
              component={make(() => import('sentry/views/alerts/edit'))}
            />
          </Route>
        </Route>
        <Route
          path="wizard/"
          component={make(() => import('sentry/views/alerts/builder/projectProvider'))}
        >
          <IndexRoute component={make(() => import('sentry/views/alerts/wizard'))} />
        </Route>
        <Route
          path="new/"
          component={make(() => import('sentry/views/alerts/builder/projectProvider'))}
        >
          <IndexRedirect
            to={
              forCustomerDomain
                ? '/alerts/wizard/'
                : '/organizations/:orgId/alerts/wizard/'
            }
          />
          <Route
            path=":alertType/"
            component={make(() => import('sentry/views/alerts/create'))}
          />
        </Route>
        <Route
          path=":alertId/"
          component={make(() => import('sentry/views/alerts/incidentRedirect'))}
        />
        <Route
          path=":projectId/"
          component={make(() => import('sentry/views/alerts/builder/projectProvider'))}
        >
          <Route
            path="new/"
            component={make(() => import('sentry/views/alerts/create'))}
          />
          <Route
            path="wizard/"
            component={make(() => import('sentry/views/alerts/wizard'))}
          />
        </Route>
      </Fragment>
    );
  };
  // ALERT ROUTES
  const alertRoutes = (
    <Fragment>
      {USING_CUSTOMER_DOMAIN && (
        <Route
          path="/alerts/"
          component={withDomainRequired(make(() => import('sentry/views/alerts')))}
          key="orgless-alerts-route"
        >
          {alertChildRoutes({forCustomerDomain: true})}
        </Route>
      )}
      <Route
        path="/organizations/:orgId/alerts/"
        component={withDomainRedirect(make(() => import('sentry/views/alerts')))}
        key="org-alerts"
      >
        {alertChildRoutes({forCustomerDomain: false})}
      </Route>
    </Fragment>
  );

  const cronsRoutes = (
    <Route
      path="/crons/"
      component={make(() => import('sentry/views/monitors'))}
      withOrgPath
    >
      <IndexRoute component={make(() => import('sentry/views/monitors/overview'))} />
      <Route
        path="create/"
        component={make(() => import('sentry/views/monitors/create'))}
      />
      <Redirect from=":monitorSlug/" to="/crons/" />
      <Redirect from=":monitorSlug/edit/" to="/crons/" />
      <Route
        path=":projectId/:monitorSlug/"
        component={make(() => import('sentry/views/monitors/details'))}
      />
      <Route
        path=":projectId/:monitorSlug/edit/"
        component={make(() => import('sentry/views/monitors/edit'))}
      />
    </Route>
  );

  const replayChildRoutes = (
    <Fragment>
      <IndexRoute component={make(() => import('sentry/views/replays/list'))} />
      <Route
        path="selectors/"
        component={make(
          () => import('sentry/views/replays/deadRageClick/deadRageClickList')
        )}
      />
      <Route
        path=":replaySlug/"
        component={make(() => import('sentry/views/replays/details'))}
      />
    </Fragment>
  );
  const replayRoutes = (
    <Route
      path="/replays/"
      component={make(() => import('sentry/views/replays/index'))}
      withOrgPath
    >
      {replayChildRoutes}
    </Route>
  );

  const releasesChildRoutes = (
    <Fragment>
      <IndexRoute component={make(() => import('sentry/views/releases/list'))} />
      <Route
        path=":release/"
        component={make(() => import('sentry/views/releases/detail'))}
      >
        <IndexRoute
          component={make(() => import('sentry/views/releases/detail/overview'))}
        />
        <Route
          path="commits/"
          component={make(
            () => import('sentry/views/releases/detail/commitsAndFiles/commits')
          )}
        />
        <Route
          path="files-changed/"
          component={make(
            () => import('sentry/views/releases/detail/commitsAndFiles/filesChanged')
          )}
        />
      </Route>
    </Fragment>
  );
  const releasesRoutes = (
    <Fragment>
      <Route
        path="/releases/"
        component={make(() => import('sentry/views/releases/index'))}
        withOrgPath
      >
        {releasesChildRoutes}
      </Route>
      <Redirect
        from="/releases/new-events/"
        to="/organizations/:orgId/releases/:release/"
      />
      <Redirect
        from="/releases/all-events/"
        to="/organizations/:orgId/releases/:release/"
      />
    </Fragment>
  );

  const discoverChildRoutes = (
    <Fragment>
      <IndexRedirect to="queries/" />
      <Route
        path="homepage/"
        component={make(() => import('sentry/views/discover/homepage'))}
      />
      {traceViewRoute}
      <Route
        path="queries/"
        component={make(() => import('sentry/views/discover/landing'))}
      />
      <Route
        path="results/"
        component={make(() => import('sentry/views/discover/results'))}
      />
      <Route
        path=":eventSlug/"
        component={make(() => import('sentry/views/discover/eventDetails'))}
      />
    </Fragment>
  );
  const discoverRoutes = (
    <Route
      path="/discover/"
      component={make(() => import('sentry/views/discover'))}
      withOrgPath
    >
      {discoverChildRoutes}
    </Route>
  );

  const llmMonitoringRedirects = USING_CUSTOMER_DOMAIN ? (
    <Redirect
      from="/llm-monitoring/"
      to={`/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.AI]}/`}
    />
  ) : (
    <Redirect
      from="/organizations/:orgId/llm-monitoring/"
      to={`/organizations/:orgId/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.AI]}/`}
    />
  );

  const moduleUrlToModule: Record<string, ModuleName> = Object.fromEntries(
    Object.values(ModuleName).map(name => [MODULE_BASE_URLS[name], name])
  );

  const insightsRedirects = Object.values(MODULE_BASE_URLS)
    .map(
      moduleBaseURL =>
        moduleBaseURL && (
          <Redirect
            key={moduleBaseURL}
            from={`${moduleBaseURL}/*`}
            to={`/${DOMAIN_VIEW_BASE_URL}/${getModuleView(moduleUrlToModule[moduleBaseURL]!)}${moduleBaseURL}/:splat`}
          />
        )
    )
    .filter(Boolean);

  const transactionSummaryRoutes = (
    <Route path="summary/">
      <IndexRoute
        component={make(
          () => import('sentry/views/performance/transactionSummary/transactionOverview')
        )}
      />
      <Route
        path="replays/"
        component={make(
          () => import('sentry/views/performance/transactionSummary/transactionReplays')
        )}
      />
      <Route
        path="vitals/"
        component={make(
          () => import('sentry/views/performance/transactionSummary/transactionVitals')
        )}
      />
      <Route
        path="tags/"
        component={make(
          () => import('sentry/views/performance/transactionSummary/transactionTags')
        )}
      />
      <Route
        path="events/"
        component={make(
          () => import('sentry/views/performance/transactionSummary/transactionEvents')
        )}
      />
      <Route
        path="profiles/"
        component={make(
          () => import('sentry/views/performance/transactionSummary/transactionProfiles')
        )}
      />
      <Route
        path="aggregateWaterfall/"
        component={make(
          () =>
            import('sentry/views/performance/transactionSummary/aggregateSpanWaterfall')
        )}
      />
      <Route path="spans/">
        <IndexRoute
          component={make(
            () => import('sentry/views/performance/transactionSummary/transactionSpans')
          )}
        />
        <Route
          path=":spanSlug/"
          component={make(
            () =>
              import(
                'sentry/views/performance/transactionSummary/transactionSpans/spanDetails'
              )
          )}
        />
      </Route>
    </Route>
  );

  const moduleRoutes = (
    <Fragment>
      <Route path={`${MODULE_BASE_URLS[ModuleName.HTTP]}/`}>
        <IndexRoute
          component={make(
            () => import('sentry/views/insights/http/views/httpLandingPage')
          )}
        />
        <Route
          path="domains/"
          component={make(
            () => import('sentry/views/insights/http/views/httpDomainSummaryPage')
          )}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.VITAL]}/`}>
        <IndexRoute
          component={make(
            () =>
              import('sentry/views/insights/browser/webVitals/views/webVitalsLandingPage')
          )}
        />
        <Route
          path="overview/"
          component={make(
            () => import('sentry/views/insights/browser/webVitals/views/pageOverview')
          )}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.RESOURCE]}/`}>
        <IndexRoute
          component={make(
            () =>
              import('sentry/views/insights/browser/resources/views/resourcesLandingPage')
          )}
        />
        <Route
          path="spans/span/:groupId/"
          component={make(
            () =>
              import('sentry/views/insights/browser/resources/views/resourceSummaryPage')
          )}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.DB]}/`}>
        <IndexRoute
          component={make(
            () => import('sentry/views/insights/database/views/databaseLandingPage')
          )}
        />
        <Route
          path="spans/span/:groupId/"
          component={make(
            () => import('sentry/views/insights/database/views/databaseSpanSummaryPage')
          )}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.CACHE]}/`}>
        <IndexRoute
          component={make(
            () => import('sentry/views/insights/cache/views/cacheLandingPage')
          )}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.QUEUE]}/`}>
        <IndexRoute
          component={make(
            () => import('sentry/views/insights/queues/views/queuesLandingPage')
          )}
        />
        <Route
          path="destination/"
          component={make(
            () => import('sentry/views/insights/queues/views/destinationSummaryPage')
          )}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.MOBILE_VITALS]}/`}>
        <IndexRoute
          component={make(
            () => import('sentry/views/insights/mobile/screens/views/screensLandingPage')
          )}
        />
        <Route
          path="details/"
          component={make(
            () => import('sentry/views/insights/mobile/screens/views/screenDetailsPage')
          )}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.SCREEN_RENDERING]}/`}>
        <IndexRoute
          component={make(
            () =>
              import(
                'sentry/views/insights/mobile/screenRendering/screenRenderingLandingPage'
              )
          )}
        />
        <Route
          path={`${SUMMARY_PAGE_BASE_URL}/`}
          component={make(
            () =>
              import(
                'sentry/views/insights/mobile/screenRendering/screenRenderingSummaryPage'
              )
          )}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.APP_START]}/`}>
        <IndexRoute
          component={make(
            () =>
              import('sentry/views/insights/mobile/appStarts/views/appStartsLandingPage')
          )}
        />
        <Route
          path="spans/"
          component={make(
            () => import('sentry/views/insights/mobile/appStarts/views/screenSummaryPage')
          )}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.MOBILE_UI]}/`}>
        <IndexRoute
          component={make(
            () => import('sentry/views/insights/mobile/ui/views/uiLandingPage')
          )}
        />
        <Route
          path="spans/"
          component={make(
            () => import('sentry/views/insights/mobile/ui/views/screenSummaryPage')
          )}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.SCREEN_LOAD]}/`}>
        <IndexRoute
          component={make(
            () =>
              import(
                'sentry/views/insights/mobile/screenload/views/screenloadLandingPage'
              )
          )}
        />
        <Route
          path="spans/"
          component={make(
            () =>
              import('sentry/views/insights/mobile/screenload/views/screenLoadSpansPage')
          )}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.UPTIME]}/`}>
        <IndexRoute
          component={make(() => import('sentry/views/insights/uptime/views/overview'))}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.AI]}/`}>
        <IndexRoute
          component={make(
            () =>
              import('sentry/views/insights/llmMonitoring/views/llmMonitoringLandingPage')
          )}
        />
        <Route
          path="pipeline-type/:groupId/"
          component={make(
            () =>
              import('sentry/views/insights/llmMonitoring/views/llmMonitoringDetailsPage')
          )}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.CRONS]}/`}>
        <IndexRoute
          component={make(() => import('sentry/views/insights/crons/views/overview'))}
        />
      </Route>
      <Route path={`${MODULE_BASE_URLS[ModuleName.SESSIONS]}/`}>
        <IndexRoute
          component={make(() => import('sentry/views/insights/sessions/views/overview'))}
        />
      </Route>
    </Fragment>
  );

  const domainViewRoutes = (
    <Route
      path={`/${DOMAIN_VIEW_BASE_URL}/`}
      withOrgPath
      component={make(() => import('sentry/views/insights/navigation'))}
    >
      {transactionSummaryRoutes}
      <Route path={`${FRONTEND_LANDING_SUB_PATH}/`}>
        <IndexRoute
          component={make(
            () => import('sentry/views/insights/pages/frontend/frontendOverviewPage')
          )}
        />
        {transactionSummaryRoutes}
        {traceViewRoute}
        <Route
          path="trends/"
          component={make(() => import('sentry/views/performance/trends'))}
        />
        {moduleRoutes}
      </Route>
      <Route path={`${BACKEND_LANDING_SUB_PATH}/`}>
        <IndexRoute
          component={make(
            () => import('sentry/views/insights/pages/backend/backendOverviewPage')
          )}
        />
        {transactionSummaryRoutes}
        {traceViewRoute}
        <Route
          path="trends/"
          component={make(() => import('sentry/views/performance/trends'))}
        />
        {moduleRoutes}
      </Route>
      <Route path={`${MOBILE_LANDING_SUB_PATH}/`}>
        <IndexRoute
          component={make(
            () => import('sentry/views/insights/pages/mobile/mobileOverviewPage')
          )}
        />
        {transactionSummaryRoutes}
        {traceViewRoute}
        <Route
          path="trends/"
          component={make(() => import('sentry/views/performance/trends'))}
        />
        {moduleRoutes}
      </Route>
      <Route path={`${AI_LANDING_SUB_PATH}/`}>
        {traceViewRoute}
        <Route
          path="trends/"
          component={make(() => import('sentry/views/performance/trends'))}
        />
        {moduleRoutes}
      </Route>
      <Route path="projects/" component={make(() => import('sentry/views/projects/'))}>
        {projectsChildRoutes}
      </Route>
    </Route>
  );

  const performanceRoutes = (
    <Route
      path="/performance/"
      component={make(() => import('sentry/views/performance'))}
      withOrgPath
    >
      <IndexRoute component={make(() => import('sentry/views/performance/content'))} />
      <Route
        path="trends/"
        component={make(() => import('sentry/views/performance/trends'))}
      />
      {transactionSummaryRoutes}
      <Route
        path="vitaldetail/"
        component={make(() => import('sentry/views/performance/vitalDetail'))}
      />
      {traceViewRoute}
      {insightsRedirects}
      <Redirect
        from="browser/resources"
        to={`/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.RESOURCE]}/`}
      />
      <Redirect
        from="browser/assets"
        to={`/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.RESOURCE]}/`}
      />
      <Redirect
        from="browser/pageloads"
        to={`/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.VITAL]}/`}
      />
      <Route
        path=":eventSlug/"
        component={make(() => import('sentry/views/performance/transactionDetails'))}
      />
    </Route>
  );

  const tracesChildRoutes = (
    <Fragment>
      <IndexRoute component={make(() => import('sentry/views/traces/content'))} />
      {traceViewRoute}
      <Route
        path="compare/"
        component={make(() => import('sentry/views/explore/multiQueryMode'))}
      />
    </Fragment>
  );
  const tracesRoutes = (
    <Route
      path="/traces/"
      component={make(() => import('sentry/views/traces'))}
      withOrgPath
    >
      {tracesChildRoutes}
    </Route>
  );

  const profilingChildRoutes = (
    <Fragment>
      <IndexRoute component={make(() => import('sentry/views/profiling/content'))} />
      <Route
        path="summary/:projectId/"
        component={make(() => import('sentry/views/profiling/profileSummary'))}
      />
      <Route
        path="profile/:projectId/differential-flamegraph/"
        component={make(() => import('sentry/views/profiling/differentialFlamegraph'))}
      />
      {traceViewRoute}
      <Route
        path="profile/:projectId/"
        component={make(() => import('sentry/views/profiling/continuousProfileProvider'))}
      >
        <Route
          path="flamegraph/"
          component={make(
            () => import('sentry/views/profiling/continuousProfileFlamegraph')
          )}
        />
      </Route>
      <Route
        path="profile/:projectId/:eventId/"
        component={make(
          () => import('sentry/views/profiling/transactionProfileProvider')
        )}
      >
        <Route
          path="flamegraph/"
          component={make(() => import('sentry/views/profiling/profileFlamechart'))}
        />
      </Route>
    </Fragment>
  );

  const exploreRoutes = (
    <Route
      path="/explore/"
      component={make(() => import('sentry/views/explore/navigation'))}
      withOrgPath
    >
      <Route path="profiling/" component={make(() => import('sentry/views/profiling'))}>
        {profilingChildRoutes}
      </Route>
      <Route path="traces/" component={make(() => import('sentry/views/traces'))}>
        {tracesChildRoutes}
      </Route>
      <Route path="replays/" component={make(() => import('sentry/views/replays/index'))}>
        {replayChildRoutes}
      </Route>
      <Route path="discover/" component={make(() => import('sentry/views/discover'))}>
        {discoverChildRoutes}
      </Route>
      <Route
        path="releases/"
        component={make(() => import('sentry/views/releases/index'))}
      >
        {releasesChildRoutes}
      </Route>
      <Route path="logs/" component={make(() => import('sentry/views/explore/logs'))} />
    </Route>
  );

  const userFeedbackRoutes = (
    <Route
      path="/user-feedback/"
      component={make(() => import('sentry/views/userFeedback'))}
      withOrgPath
    />
  );

  const feedbackV2ChildRoutes = (
    <Fragment>
      <IndexRoute
        component={make(() => import('sentry/views/feedback/feedbackListPage'))}
      />
      {traceViewRoute}
    </Fragment>
  );
  const feedbackv2Routes = (
    <Route
      path="/feedback/"
      component={make(() => import('sentry/views/feedback/index'))}
      withOrgPath
    >
      {feedbackV2ChildRoutes}
    </Route>
  );

  const issueTabs = (
    <Fragment>
      <IndexRoute
        component={make(
          () => import('sentry/views/issueDetails/groupEventDetails/groupEventDetails'),
          <GroupEventDetailsLoading />
        )}
      />
      <Route
        path={TabPaths[Tab.REPLAYS]}
        component={make(() => import('sentry/views/issueDetails/groupReplays'))}
      />
      <Route
        path={TabPaths[Tab.ACTIVITY]}
        component={make(() => import('sentry/views/issueDetails/groupActivity'))}
      />
      <Route
        path={TabPaths[Tab.EVENTS]}
        component={make(() => import('sentry/views/issueDetails/groupEvents'))}
      />
      <Route
        path={TabPaths[Tab.OPEN_PERIODS]}
        component={make(() => import('sentry/views/issueDetails/groupOpenPeriods'))}
      />
      <Route
        path={TabPaths[Tab.UPTIME_CHECKS]}
        component={make(() => import('sentry/views/issueDetails/groupUptimeChecks'))}
      />
      <Route
        path={TabPaths[Tab.CHECK_INS]}
        component={make(() => import('sentry/views/issueDetails/groupCheckIns'))}
      />
      <Route
        path={TabPaths[Tab.TAGS]}
        component={make(() => import('sentry/views/issueDetails/groupTags/groupTagsTab'))}
      />
      <Route
        path={`${TabPaths[Tab.TAGS]}:tagKey/`}
        component={make(() => import('sentry/views/issueDetails/groupTagValues'))}
      />
      <Route
        path={TabPaths[Tab.USER_FEEDBACK]}
        component={make(() => import('sentry/views/issueDetails/groupUserFeedback'))}
      />
      <Route
        path={TabPaths[Tab.ATTACHMENTS]}
        component={make(() => import('sentry/views/issueDetails/groupEventAttachments'))}
      />
      <Route
        path={TabPaths[Tab.SIMILAR_ISSUES]}
        component={make(
          () =>
            import('sentry/views/issueDetails/groupSimilarIssues/groupSimilarIssuesTab')
        )}
      />
      <Route
        path={TabPaths[Tab.MERGED]}
        component={make(
          () => import('sentry/views/issueDetails/groupMerged/groupMergedTab')
        )}
      />
    </Fragment>
  );

  const issueRoutes = (
    <Route path="/issues" component={errorHandler(IssueNavigation)} withOrgPath>
      <IndexRoute component={errorHandler(OverviewWrapper)} />
      <Route path="views/:viewId/" component={errorHandler(OverviewWrapper)} />
      <Route path="searches/:searchId/" component={errorHandler(OverviewWrapper)} />
      <Route
        path=":groupId/"
        component={make(() => import('sentry/views/issueDetails/groupDetails'))}
        key="org-issues-group-id"
      >
        {issueTabs}
        <Route path={`${TabPaths[Tab.EVENTS]}:eventId/`}>{issueTabs}</Route>
      </Route>
      <Route
        path="feedback/"
        component={make(() => import('sentry/views/feedback/index'))}
      >
        {feedbackV2ChildRoutes}
      </Route>
      <Route path="alerts/" component={make(() => import('sentry/views/alerts'))}>
        {alertChildRoutes({forCustomerDomain: true})}
      </Route>
      {traceViewRoute}
    </Route>
  );

  // These are the "manage" pages. For sentry.io, these are _different_ from
  // the SaaS admin routes in getsentry.
  const adminManageRoutes = (
    <Route
      path="/manage/"
      component={make(() => import('sentry/views/admin/adminLayout'))}
    >
      <IndexRoute component={make(() => import('sentry/views/admin/adminOverview'))} />
      <Route
        path="buffer/"
        component={make(() => import('sentry/views/admin/adminBuffer'))}
      />
      <Route
        path="relays/"
        component={make(() => import('sentry/views/admin/adminRelays'))}
      />
      <Route
        path="organizations/"
        component={make(() => import('sentry/views/admin/adminOrganizations'))}
      />
      <Route
        path="projects/"
        component={make(() => import('sentry/views/admin/adminProjects'))}
      />
      <Route
        path="queue/"
        component={make(() => import('sentry/views/admin/adminQueue'))}
      />
      <Route
        path="quotas/"
        component={make(() => import('sentry/views/admin/adminQuotas'))}
      />
      <Route
        path="settings/"
        component={make(() => import('sentry/views/admin/adminSettings'))}
      />
      <Route path="users/">
        <IndexRoute component={make(() => import('sentry/views/admin/adminUsers'))} />
        <Route
          path=":id"
          component={make(() => import('sentry/views/admin/adminUserEdit'))}
        />
      </Route>
      <Route
        path="status/mail/"
        component={make(() => import('sentry/views/admin/adminMail'))}
      />
      <Route
        path="status/environment/"
        component={make(() => import('sentry/views/admin/adminEnvironment'))}
      />
      <Route
        path="status/packages/"
        component={make(() => import('sentry/views/admin/adminPackages'))}
      />
      <Route
        path="status/warnings/"
        component={make(() => import('sentry/views/admin/adminWarnings'))}
      />
    </Route>
  );

  // XXX(epurkhiser): This should probably go away. It's not totally clear to
  // me why we need the OrganizationRoot root container.
  const legacyOrganizationRootRoutes = (
    <Route component={errorHandler(OrganizationRoot)}>
      <Redirect from="/organizations/:orgId/teams/new/" to="/settings/:orgId/teams/" />
      <Route path="/organizations/:orgId/">
        {hook('routes:legacy-organization-redirects')}
        <IndexRedirect to="issues/" />
        <Redirect from="teams/" to="/settings/:orgId/teams/" />
        <Redirect from="teams/your-teams/" to="/settings/:orgId/teams/" />
        <Redirect from="teams/all-teams/" to="/settings/:orgId/teams/" />
        <Redirect from="teams/:teamId/" to="/settings/:orgId/teams/:teamId/" />
        <Redirect
          from="teams/:teamId/members/"
          to="/settings/:orgId/teams/:teamId/members/"
        />
        <Redirect
          from="teams/:teamId/projects/"
          to="/settings/:orgId/teams/:teamId/projects/"
        />
        <Redirect
          from="teams/:teamId/settings/"
          to="/settings/:orgId/teams/:teamId/settings/"
        />
        <Redirect from="settings/" to="/settings/:orgId/" />
        <Redirect from="api-keys/" to="/settings/:orgId/api-keys/" />
        <Redirect from="api-keys/:apiKey/" to="/settings/:orgId/api-keys/:apiKey/" />
        <Redirect from="members/" to="/settings/:orgId/members/" />
        <Redirect from="members/:memberId/" to="/settings/:orgId/members/:memberId/" />
        <Redirect from="rate-limits/" to="/settings/:orgId/rate-limits/" />
        <Redirect from="repos/" to="/settings/:orgId/repos/" />
      </Route>
    </Route>
  );

  const gettingStartedRoutes = (
    <Fragment>
      {USING_CUSTOMER_DOMAIN && (
        <Fragment>
          <Redirect
            from="/getting-started/:projectId/"
            to="/projects/:projectId/getting-started/"
          />
          <Redirect
            from="/getting-started/:projectId/:platform/"
            to="/projects/:projectId/getting-started/"
          />
        </Fragment>
      )}
      <Redirect
        from="/:orgId/:projectId/getting-started/"
        to="/organizations/:orgId/projects/:projectId/getting-started/"
      />
      <Redirect
        from="/:orgId/:projectId/getting-started/:platform/"
        to="/organizations/:orgId/projects/:projectId/getting-started/"
      />
    </Fragment>
  );

  const profilingRoutes = (
    <Route
      path="/profiling/"
      component={make(() => import('sentry/views/profiling'))}
      withOrgPath
    >
      <IndexRoute component={make(() => import('sentry/views/profiling/content'))} />
      <Route
        path="summary/:projectId/"
        component={make(() => import('sentry/views/profiling/profileSummary'))}
      />
      <Route
        path="profile/:projectId/differential-flamegraph/"
        component={make(() => import('sentry/views/profiling/differentialFlamegraph'))}
      />
      {traceViewRoute}
      <Route
        path="profile/:projectId/"
        component={make(() => import('sentry/views/profiling/continuousProfileProvider'))}
      >
        <Route
          path="flamegraph/"
          component={make(
            () => import('sentry/views/profiling/continuousProfileFlamegraph')
          )}
        />
      </Route>
      <Route
        path="profile/:projectId/:eventId/"
        component={make(
          () => import('sentry/views/profiling/transactionProfileProvider')
        )}
      >
        <Route
          path="flamegraph/"
          component={make(() => import('sentry/views/profiling/profileFlamechart'))}
        />
      </Route>
    </Route>
  );

  // Support for deprecated URLs (pre-Sentry 10). We just redirect users to new
  // canonical URLs.
  //
  // XXX(epurkhiser): Can these be moved over to the legacyOrgRedirects routes,
  // or do these need to be nested into the OrganizationLayout tree?
  const legacyOrgRedirects = (
    <Route path="/:orgId/:projectId/">
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

  const organizationRoutes = (
    <Route component={errorHandler(OrganizationLayout)}>
      {automationRoutes}
      {detectorRoutes}
      {settingsRoutes}
      {projectsRoutes}
      {dashboardRoutes}
      {userFeedbackRoutes}
      {feedbackv2Routes}
      {issueRoutes}
      {alertRoutes}
      {cronsRoutes}
      {replayRoutes}
      {releasesRoutes}
      {statsRoutes}
      {discoverRoutes}
      {performanceRoutes}
      {domainViewRoutes}
      {tracesRoutes}
      {exploreRoutes}
      {llmMonitoringRedirects}
      {profilingRoutes}
      {gettingStartedRoutes}
      {adminManageRoutes}
      {legacyOrganizationRootRoutes}
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
    <ProvideAriaRouter>
      <Route>
        {experimentalSpaRoutes}
        <Route path="/" component={errorHandler(App)}>
          {rootRoutes}
          {organizationRoutes}
          {legacyRedirectRoutes}
          <Route path="*" component={errorHandler(RouteNotFound)} />
        </Route>
      </Route>
    </ProvideAriaRouter>
  );

  return appRoutes;
}

// We load routes both when initializing the SDK (for routing integrations) and
// when the app renders Main. Memoize to avoid rebuilding the route tree.
export const routes = memoize(buildRoutes);

// Exported for use in tests.
export {buildRoutes};

function NoOp({children}: {children: JSX.Element}) {
  return children;
}
