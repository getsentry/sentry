import {Fragment} from 'react';
import memoize from 'lodash/memoize';

import {EXPERIMENTAL_SPA, USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import type {HookName} from 'sentry/types/hooks';
import errorHandler from 'sentry/utils/errorHandler';
import {ProvideAriaRouter} from 'sentry/utils/provideAriaRouter';
import withDomainRedirect from 'sentry/utils/withDomainRedirect';
import withDomainRequired from 'sentry/utils/withDomainRequired';
import App from 'sentry/views/app';
import {AppBodyContent} from 'sentry/views/app/appBodyContent';
import AuthLayout from 'sentry/views/auth/layout';
import {authV2Routes} from 'sentry/views/authV2/routes';
import {automationRoutes} from 'sentry/views/automations/routes';
import {detectorRoutes} from 'sentry/views/detectors/routes';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {AGENTS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/agents/settings';
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
import {IssueTaxonomy} from 'sentry/views/issueList/taxonomies';
import OrganizationContainer from 'sentry/views/organizationContainer';
import OrganizationLayout from 'sentry/views/organizationLayout';
import {OrganizationStatsWrapper} from 'sentry/views/organizationStats/organizationStatsWrapper';
import ProjectEventRedirect from 'sentry/views/projectEventRedirect';
import redirectDeprecatedProjectRoute from 'sentry/views/projects/redirectDeprecatedProjectRoute';
import RouteNotFound from 'sentry/views/routeNotFound';
import SettingsWrapper from 'sentry/views/settings/components/settingsWrapper';

import {
  IndexRedirect,
  IndexRoute,
  Redirect,
  Route,
  type SentryRouteObject,
  WorkingRedirect,
} from './components/route';
import {makeLazyloadComponent as make} from './makeLazyloadComponent';

const hook = (name: HookName) => HookStore.get(name).map(cb => cb());

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

  const traceViewRouteObject: SentryRouteObject = {
    path: 'trace/:traceSlug/',
    component: make(() => import('sentry/views/performance/traceDetails')),
  };

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
      {/* Add redirect from old user feedback to new feedback */}
      <Redirect from="/user-feedback/" to="/feedback/" />
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
        path="/stories/:storyType?/:storySlug?/"
        component={make(() => import('sentry/stories/view/index'))}
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
        <Route path="auth-tokens/" name={t('Personal Tokens')}>
          <IndexRoute
            component={make(() => import('sentry/views/settings/account/apiTokens'))}
          />
          <Route
            path="new-token/"
            name={t('Create Personal Token')}
            component={make(() => import('sentry/views/settings/account/apiNewToken'))}
          />
          <Route
            path=":tokenId/"
            name={t('Edit Personal Token')}
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

  const projectSettingsChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      name: t('General'),
      component: make(() => import('sentry/views/settings/projectGeneralSettings')),
    },
    {
      path: 'install/',
      component: () => (
        <WorkingRedirect to="/projects/:projectId/getting-started/" replace />
      ),
    },
    {
      path: 'teams/',
      name: t('Teams'),
      component: make(() => import('sentry/views/settings/project/projectTeams')),
    },
    {
      path: 'alerts/',
      name: t('Alerts'),
      component: make(() => import('sentry/views/settings/projectAlerts')),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/projectAlerts/settings')),
        },
        {
          path: 'new/',
          component: () => (
            <WorkingRedirect to="/organizations/:orgId/alerts/:projectId/new/" replace />
          ),
        },
        {
          path: 'rules/',
          component: () => (
            <WorkingRedirect to="/organizations/:orgId/alerts/rules/" replace />
          ),
        },
        {
          path: 'rules/new/',
          component: () => (
            <WorkingRedirect to="/organizations/:orgId/alerts/:projectId/new/" replace />
          ),
        },
        {
          path: 'metric-rules/new/',
          component: () => (
            <WorkingRedirect to="/organizations/:orgId/alerts/:projectId/new/" replace />
          ),
        },
        {
          path: 'rules/:ruleId/',
          component: () => (
            <WorkingRedirect
              to="/organizations/:orgId/alerts/rules/:projectId/:ruleId/"
              replace
            />
          ),
        },
        {
          path: 'metric-rules/:ruleId/',
          component: () => (
            <WorkingRedirect
              to="/organizations/:orgId/alerts/metric-rules/:projectId/:ruleId/"
              replace
            />
          ),
        },
      ],
    },
    {
      path: 'environments/',
      name: t('Environments'),
      component: make(() => import('sentry/views/settings/project/projectEnvironments')),
      children: [
        {
          index: true,
        },
        {
          path: 'hidden/',
        },
      ],
    },
    {
      path: 'tags/',
      name: t('Tags & Context'),
      component: make(() => import('sentry/views/settings/projectTags')),
    },
    {
      path: 'issue-tracking/',
      component: () => (
        <WorkingRedirect to="/settings/:orgId/:projectId/plugins/" replace />
      ),
    },
    {
      path: 'release-tracking/',
      name: t('Release Tracking'),
      component: make(
        () => import('sentry/views/settings/project/projectReleaseTracking')
      ),
    },
    {
      path: 'ownership/',
      name: t('Ownership Rules'),
      component: make(() => import('sentry/views/settings/project/projectOwnership')),
    },
    {
      path: 'data-forwarding/',
      name: t('Data Forwarding'),
      component: make(() => import('sentry/views/settings/projectDataForwarding')),
    },
    {
      path: 'seer/',
      name: t('Seer'),
      component: make(() => import('sentry/views/settings/projectSeer/index')),
    },
    {
      path: 'user-feedback/',
      name: t('User Feedback'),
      component: make(() => import('sentry/views/settings/projectUserFeedback')),
    },
    {
      path: 'security-and-privacy/',
      name: t('Security & Privacy'),
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/settings/projectSecurityAndPrivacy')
          ),
        },
        {
          path: 'advanced-data-scrubbing/:scrubbingId/',
          component: make(
            () => import('sentry/views/settings/projectSecurityAndPrivacy')
          ),
        },
      ],
    },
    {
      path: 'debug-symbols/',
      name: t('Debug Information Files'),
      component: make(() => import('sentry/views/settings/projectDebugFiles')),
    },
    {
      path: 'proguard/',
      name: t('ProGuard Mappings'),
      component: make(() => import('sentry/views/settings/projectProguard')),
    },
    {
      path: 'performance/',
      name: t('Performance'),
      component: make(() => import('sentry/views/settings/projectPerformance')),
    },
    {
      path: 'playstation/',
      name: t('PlayStation'),
      component: make(() => import('sentry/views/settings/project/tempest')),
    },
    {
      path: 'replays/',
      name: t('Replays'),
      component: make(() => import('sentry/views/settings/project/projectReplays')),
    },
    {
      path: 'toolbar/',
      name: t('Developer Toolbar'),
      component: make(() => import('sentry/views/settings/project/projectToolbar')),
    },
    {
      path: 'source-maps/',
      name: t('Source Maps'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/projectSourceMaps')),
        },
        {
          path: ':bundleId/',
          name: t('Source Map Uploads'),
          component: make(() => import('sentry/views/settings/projectSourceMaps')),
        },
        {
          path: 'source-maps/artifact-bundles/',
          component: () => <WorkingRedirect to="source-maps/" replace />,
        },
        {
          path: 'source-maps/release-bundles/',
          component: () => <WorkingRedirect to="source-maps/" replace />,
        },
      ],
    },
    {
      path: 'filters/',
      name: t('Inbound Filters'),
      component: make(() => import('sentry/views/settings/project/projectFilters')),
      children: [
        {
          index: true,
          component: () => <WorkingRedirect to="data-filters/" replace />,
        },
        {
          path: ':filterType/',
        },
      ],
    },
    {
      path: 'dynamic-sampling/',
      component: () => <WorkingRedirect to="performance/" replace />,
    },
    {
      path: 'issue-grouping/',
      name: t('Issue Grouping'),
      component: make(() => import('sentry/views/settings/projectIssueGrouping')),
    },
    {
      path: 'hooks/',
      name: t('Service Hooks'),
      component: make(() => import('sentry/views/settings/project/projectServiceHooks')),
    },
    {
      path: 'hooks/new/',
      name: t('Create Service Hook'),
      component: make(
        () => import('sentry/views/settings/project/projectCreateServiceHook')
      ),
    },
    {
      path: 'hooks/:hookId/',
      name: t('Service Hook Details'),
      component: make(
        () => import('sentry/views/settings/project/projectServiceHookDetails')
      ),
    },
    {
      path: 'keys/',
      name: t('Client Keys'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/project/projectKeys/list')),
        },
        {
          path: ':keyId/',
          name: t('Details'),
          component: make(
            () => import('sentry/views/settings/project/projectKeys/details')
          ),
        },
      ],
    },
    {
      path: 'loader-script/',
      name: t('Loader Script'),
      component: make(() => import('sentry/views/settings/project/loaderScript')),
    },
    {
      path: 'csp/',
      component: () => (
        <WorkingRedirect
          to="/settings/:orgId/projects/:projectId/security-headers/csp/"
          replace
        />
      ),
    },
    {
      path: 'security-headers/',
      name: t('Security Headers'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/projectSecurityHeaders')),
        },
        {
          path: 'csp/',
          name: t('Content Security Policy'),
          component: make(
            () => import('sentry/views/settings/projectSecurityHeaders/csp')
          ),
        },
        {
          path: 'expect-ct/',
          name: t('Certificate Transparency'),
          component: make(
            () => import('sentry/views/settings/projectSecurityHeaders/expectCt')
          ),
        },
        {
          path: 'hpkp/',
          name: t('HPKP'),
          component: make(
            () => import('sentry/views/settings/projectSecurityHeaders/hpkp')
          ),
        },
      ],
    },
    {
      path: 'plugins/',
      name: t('Legacy Integrations'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/projectPlugins')),
        },
        {
          path: ':pluginId/',
          name: t('Integration Details'),
          component: make(() => import('sentry/views/settings/projectPlugins/details')),
        },
      ],
    },
  ];

  const projectSettingsRoutes = (
    <Route
      path="projects/:projectId/"
      name={t('Project')}
      component={make(
        () => import('sentry/views/settings/project/projectSettingsLayout')
      )}
      newStyleChildren={projectSettingsChildRoutes}
    />
  );

  const statsChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/organizationStats')),
    },
    {
      component: make(() => import('sentry/views/organizationStats/teamInsights')),
      children: [
        {
          path: 'issues/',
          component: make(
            () => import('sentry/views/organizationStats/teamInsights/issues')
          ),
        },
        {
          path: 'health/',
          component: make(
            () => import('sentry/views/organizationStats/teamInsights/health')
          ),
        },
      ],
    },
  ];
  const statsRoutes = (
    <Fragment>
      <Route
        path="/stats/"
        withOrgPath
        component={OrganizationStatsWrapper}
        newStyleChildren={statsChildRoutes}
      />
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
      <Route path="auth-tokens/" name={t('Organization Tokens')}>
        <IndexRoute
          component={make(() => import('sentry/views/settings/organizationAuthTokens'))}
        />
        <Route
          path="new-token/"
          name={t('Create New Organization Token')}
          component={make(
            () => import('sentry/views/settings/organizationAuthTokens/newAuthToken')
          )}
        />
        <Route
          path=":tokenId/"
          name={t('Edit Organization Token')}
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
      <Route path="seer/" name={t('Seer Automation')}>
        <IndexRoute component={make(() => import('getsentry/views/seerAutomation'))} />
        <Route
          path="onboarding/"
          name={t('Configure Seer for All Projects')}
          component={make(() => import('getsentry/views/seerAutomation/onboarding'))}
        />
      </Route>
      <Route path="stats/" name={t('Stats')} newStyleChildren={statsChildRoutes} />
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

  const projectsChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/projectsDashboard')),
    },
    {
      path: 'new/',
      component: make(() => import('sentry/views/projectInstall/newProject')),
    },
    {
      path: ':projectId/',
      component: make(() => import('sentry/views/projectDetail')),
    },
    {
      path: ':projectId/events/:eventId/',
      component: errorHandler(ProjectEventRedirect),
    },
    {
      path: ':projectId/getting-started/',
      component: make(() => import('sentry/views/projectInstall/gettingStarted')),
    },
  ];
  const projectsRoutes = (
    <Route
      path="/projects/"
      component={make(() => import('sentry/views/projects/'))}
      withOrgPath
      newStyleChildren={projectsChildRoutes}
    />
  );

  const dashboardRoutes = (
    <Route>
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

  const replayChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/replays/list')),
    },
    {
      path: 'selectors/',
      component: make(
        () => import('sentry/views/replays/deadRageClick/deadRageClickList')
      ),
    },
    {
      path: ':replaySlug/',
      component: make(() => import('sentry/views/replays/details')),
    },
  ];
  const replayRoutes = (
    <Route
      path="/replays/"
      component={make(() => import('sentry/views/replays/index'))}
      withOrgPath
      newStyleChildren={replayChildRoutes}
    />
  );

  const releasesChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/releases/list')),
    },
    {
      path: ':release/',
      component: make(() => import('sentry/views/releases/detail')),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/releases/detail/overview')),
        },
        {
          path: 'commits/',
          component: make(
            () => import('sentry/views/releases/detail/commitsAndFiles/commits')
          ),
        },
        {
          path: 'files-changed/',
          component: make(
            () => import('sentry/views/releases/detail/commitsAndFiles/filesChanged')
          ),
        },
      ],
    },
  ];
  const releasesRoutes = (
    <Fragment>
      <Route
        path="/releases/"
        component={make(() => import('sentry/views/releases/index'))}
        withOrgPath
        newStyleChildren={releasesChildRoutes}
      />
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

  const discoverChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: () => <WorkingRedirect to="queries/" replace />,
    },
    {
      path: 'homepage/',
      component: make(() => import('sentry/views/discover/homepage')),
    },
    traceViewRouteObject,
    {
      path: 'queries/',
      component: make(() => import('sentry/views/discover/landing')),
    },
    {
      path: 'results/',
      component: make(() => import('sentry/views/discover/results')),
    },
    {
      path: ':eventSlug/',
      component: make(() => import('sentry/views/discover/eventDetails')),
    },
  ];
  const discoverRoutes = (
    <Route
      path="/discover/"
      component={make(() => import('sentry/views/discover'))}
      withOrgPath
      newStyleChildren={discoverChildRoutes}
    />
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

  const insightsRedirectObjects: SentryRouteObject[] = Object.values(MODULE_BASE_URLS)
    .map(moduleBaseURL =>
      moduleBaseURL
        ? {
            path: `${moduleBaseURL}/*`,
            component: () => (
              <WorkingRedirect
                to={`/${DOMAIN_VIEW_BASE_URL}/${getModuleView(moduleUrlToModule[moduleBaseURL]!)}${moduleBaseURL}/:splat`}
                replace
              />
            ),
          }
        : null
    )
    .filter(route => route !== null);

  const transactionSummaryChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionOverview')
      ),
    },
    traceViewRouteObject,
    {
      path: 'replays/',
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionReplays')
      ),
    },
    {
      path: 'vitals/',
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionVitals')
      ),
    },
    {
      path: 'tags/',
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionTags')
      ),
    },
    {
      path: 'events/',
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionEvents')
      ),
    },
    {
      path: 'profiles/',
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionProfiles')
      ),
    },
    {
      path: 'spans/',
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/performance/transactionSummary/transactionSpans')
          ),
        },
        {
          path: ':spanSlug/',
          component: make(
            () =>
              import(
                'sentry/views/performance/transactionSummary/transactionSpans/spanDetails'
              )
          ),
        },
      ],
    },
  ];

  const moduleRoutes: SentryRouteObject[] = [
    {
      path: `${MODULE_BASE_URLS[ModuleName.HTTP]}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/http/views/httpLandingPage')
          ),
        },
        {
          path: 'domains/',
          component: make(
            () => import('sentry/views/insights/http/views/httpDomainSummaryPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.VITAL]}/`,
      children: [
        {
          index: true,
          component: make(
            () =>
              import('sentry/views/insights/browser/webVitals/views/webVitalsLandingPage')
          ),
        },
        {
          path: 'overview/',
          component: make(
            () => import('sentry/views/insights/browser/webVitals/views/pageOverview')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.RESOURCE]}/`,
      children: [
        {
          index: true,
          component: make(
            () =>
              import('sentry/views/insights/browser/resources/views/resourcesLandingPage')
          ),
        },
        {
          path: 'spans/span/:groupId/',
          component: make(
            () =>
              import('sentry/views/insights/browser/resources/views/resourceSummaryPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.DB]}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/database/views/databaseLandingPage')
          ),
        },
        {
          path: 'spans/span/:groupId/',
          component: make(
            () => import('sentry/views/insights/database/views/databaseSpanSummaryPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.CACHE]}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/cache/views/cacheLandingPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.QUEUE]}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/queues/views/queuesLandingPage')
          ),
        },
        {
          path: 'destination/',
          component: make(
            () => import('sentry/views/insights/queues/views/destinationSummaryPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.MOBILE_VITALS]}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/mobile/screens/views/screensLandingPage')
          ),
        },
        {
          path: 'details/',
          component: make(
            () => import('sentry/views/insights/mobile/screens/views/screenDetailsPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.AI]}/`,
      children: [
        {
          index: true,
          component: make(
            () =>
              import('sentry/views/insights/llmMonitoring/views/llmMonitoringLandingPage')
          ),
        },
        {
          path: 'pipeline-type/:groupId/',
          component: make(
            () =>
              import('sentry/views/insights/llmMonitoring/views/llmMonitoringDetailsPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.SESSIONS]}/`,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/insights/sessions/views/overview')),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.AGENTS]}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/agentMonitoring/views/agentsOverviewPage')
          ),
        },
      ],
    },
    {
      path: `${MODULE_BASE_URLS[ModuleName.MCP]}/`,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/insights/mcp/views/overview')),
        },
      ],
    },
  ];

  const domainViewChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/insights/index')),
    },
    {
      path: 'summary/',
      children: transactionSummaryChildRoutes,
    },
    {
      path: `${FRONTEND_LANDING_SUB_PATH}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/pages/frontend/frontendOverviewPage')
          ),
        },
        {
          path: 'summary/',
          children: transactionSummaryChildRoutes,
        },
        traceViewRouteObject,
        ...moduleRoutes,
      ],
    },
    {
      path: `${BACKEND_LANDING_SUB_PATH}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/pages/backend/backendOverviewPage')
          ),
        },
        {
          path: 'summary/',
          children: transactionSummaryChildRoutes,
        },
        traceViewRouteObject,
        ...moduleRoutes,
      ],
    },
    {
      path: `${MOBILE_LANDING_SUB_PATH}/`,
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/insights/pages/mobile/mobileOverviewPage')
          ),
        },
        {
          path: 'summary/',
          children: transactionSummaryChildRoutes,
        },
        traceViewRouteObject,
        ...moduleRoutes,
      ],
    },
    {
      path: `${AI_LANDING_SUB_PATH}/`,
      children: [traceViewRouteObject, ...moduleRoutes],
    },
    {
      path: `${AGENTS_LANDING_SUB_PATH}/`,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/insights/pages/agents/redirect')),
        },
        {
          path: 'summary/',
          children: transactionSummaryChildRoutes,
        },
        traceViewRouteObject,
        ...moduleRoutes,
      ],
    },
    {
      path: 'projects/',
      component: make(() => import('sentry/views/projects/')),
      children: projectsChildRoutes,
    },
    {
      path: `${FRONTEND_LANDING_SUB_PATH}/uptime/`,
      component: () => <WorkingRedirect to="/insights/uptime/" replace />,
    },
    {
      path: `${BACKEND_LANDING_SUB_PATH}/uptime/`,
      component: () => <WorkingRedirect to="/insights/uptime/" replace />,
    },
    {
      path: `${BACKEND_LANDING_SUB_PATH}/crons/`,
      component: () => <WorkingRedirect to="/insights/crons/" replace />,
    },
    {
      path: 'uptime/',
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/insights/uptime/views/overview')),
        },
      ],
    },
    {
      path: 'crons/',
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/insights/crons/views/overview')),
        },
      ],
    },
  ];

  const domainViewRoutes = (
    <Route
      path={`/${DOMAIN_VIEW_BASE_URL}/`}
      withOrgPath
      newStyleChildren={domainViewChildRoutes}
    />
  );

  const performanceChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: () => <WorkingRedirect to="/insights/frontend/" replace />,
    },
    {
      path: 'summary/',
      children: transactionSummaryChildRoutes,
    },
    {
      path: 'vitaldetail/',
      component: make(() => import('sentry/views/performance/vitalDetail')),
    },
    traceViewRouteObject,
    ...insightsRedirectObjects,
    {
      path: 'browser/resources',
      component: () => (
        <WorkingRedirect
          to={`/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.RESOURCE]}/`}
          replace
        />
      ),
    },
    {
      path: 'browser/assets',
      component: () => (
        <WorkingRedirect
          to={`/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.RESOURCE]}/`}
          replace
        />
      ),
    },
    {
      path: 'browser/pageloads',
      component: () => (
        <WorkingRedirect
          to={`/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.VITAL]}/`}
          replace
        />
      ),
    },
    {
      path: ':eventSlug/',
      component: make(() => import('sentry/views/performance/transactionDetails')),
    },
  ];

  const performanceRoutes = (
    <Route
      path="/performance/"
      component={make(() => import('sentry/views/performance'))}
      withOrgPath
      newStyleChildren={performanceChildRoutes}
    />
  );

  const tracesChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/traces/content')),
    },
    traceViewRouteObject,
    {
      path: 'compare/',
      component: make(() => import('sentry/views/explore/multiQueryMode')),
    },
  ];

  const logsChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/explore/logs/content')),
    },
    traceViewRouteObject,
  ];

  const tracesRoutes = (
    <Route
      path="/traces/"
      component={make(() => import('sentry/views/traces'))}
      withOrgPath
      newStyleChildren={tracesChildRoutes}
    />
  );

  const profilingChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/profiling/content')),
    },
    {
      path: 'summary/:projectId/',
      component: make(() => import('sentry/views/profiling/profileSummary')),
    },
    {
      path: 'profile/:projectId/differential-flamegraph/',
      component: make(() => import('sentry/views/profiling/differentialFlamegraph')),
    },
    traceViewRouteObject,
    {
      path: 'profile/:projectId/',
      component: make(() => import('sentry/views/profiling/continuousProfileProvider')),
      children: [
        {
          path: 'flamegraph/',
          component: make(
            () => import('sentry/views/profiling/continuousProfileFlamegraph')
          ),
        },
      ],
    },
    {
      path: 'profile/:projectId/:eventId/',
      component: make(() => import('sentry/views/profiling/transactionProfileProvider')),
      children: [
        {
          path: 'flamegraph/',
          component: make(() => import('sentry/views/profiling/profileFlamechart')),
        },
      ],
    },
  ];

  const exploreChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/explore/indexRedirect')),
    },
    {
      path: 'profiling/',
      component: make(() => import('sentry/views/profiling')),
      children: profilingChildRoutes,
    },
    {
      path: 'traces/',
      component: make(() => import('sentry/views/traces')),
      children: tracesChildRoutes,
    },
    {
      path: 'replays/',
      component: make(() => import('sentry/views/replays/index')),
      children: replayChildRoutes,
    },
    {
      path: 'discover/',
      component: make(() => import('sentry/views/discover')),
      children: discoverChildRoutes,
    },
    {
      path: 'releases/',
      component: make(() => import('sentry/views/releases/index')),
      children: releasesChildRoutes,
    },
    {
      path: 'logs/',
      component: make(() => import('sentry/views/explore/logs')),
      children: logsChildRoutes,
    },
    {
      path: 'saved-queries/',
      component: make(() => import('sentry/views/explore/savedQueries')),
    },
  ];

  const exploreRoutes = (
    <Route path="/explore/" withOrgPath newStyleChildren={exploreChildRoutes} />
  );

  const codecovCommitRoutes = (
    /* This is a layout route that will render a header for a commit */
    <Route
      path="commits/:sha/"
      component={make(
        () => import('sentry/views/codecov/coverage/commits/commitWrapper')
      )}
    >
      <IndexRoute
        component={make(
          () => import('sentry/views/codecov/coverage/commits/commitDetail')
        )}
      />
      <Route
        path="history/"
        component={make(
          () => import('sentry/views/codecov/coverage/commits/commitHistory')
        )}
      />
      <Route
        path="yaml/"
        component={make(() => import('sentry/views/codecov/coverage/commits/commitYaml'))}
      />
    </Route>
  );
  const codecovPRRoutes = (
    /* This is a layout route that will render a header for a pull request */
    <Route
      path="pulls/:pullId/"
      component={make(() => import('sentry/views/codecov/coverage/pulls/pullWrapper'))}
    >
      <IndexRoute
        component={make(() => import('sentry/views/codecov/coverage/pulls/pullDetail'))}
      />
    </Route>
  );
  const codecovChildrenRoutes = (
    <Fragment>
      <Route path="coverage/">
        {/* This is a layout route that will render a header for coverage */}
        <Route
          component={make(() => import('sentry/views/codecov/coverage/coverageWrapper'))}
        >
          <Route
            path="file-explorer/"
            component={make(() => import('sentry/views/codecov/coverage/coverage'))}
          />
          <Route
            path="commits/"
            component={make(() => import('sentry/views/codecov/coverage/commits'))}
          />
          <Route
            path="pulls/"
            component={make(() => import('sentry/views/codecov/coverage/pulls'))}
          />
          <Route
            path="coverage-trend/"
            component={make(() => import('sentry/views/codecov/coverage/coverageTrend'))}
          />
        </Route>

        {/* Render coverage onboarding without any layout wrapping */}
        <Route
          path="new/"
          component={make(() => import('sentry/views/codecov/coverage/onboarding'))}
        />

        {codecovCommitRoutes}
        {codecovPRRoutes}
      </Route>
      <Route path="tests/">
        {/* Render tests page with layout wrapper */}
        <Route component={make(() => import('sentry/views/codecov/tests/testsWrapper'))}>
          <IndexRoute
            component={make(() => import('sentry/views/codecov/tests/tests'))}
          />
        </Route>
        {/* Render tests onboarding with layout wrapper */}
        <Route
          path="new/"
          component={make(() => import('sentry/views/codecov/tests/testsWrapper'))}
        >
          <IndexRoute
            component={make(() => import('sentry/views/codecov/tests/onboarding'))}
          />
        </Route>
      </Route>
      <Route path="tokens/">
        <Route
          component={make(() => import('sentry/views/codecov/tokens/tokensWrapper'))}
        >
          <IndexRoute
            component={make(() => import('sentry/views/codecov/tokens/tokens'))}
          />
        </Route>
      </Route>
    </Fragment>
  );
  const codecovRoutes = (
    <Route
      path="/codecov/"
      withOrgPath
      component={make(() => import('sentry/views/codecov/index'))}
    >
      {codecovChildrenRoutes}
    </Route>
  );

  const preprodRoutes = (
    <Route
      path="/preprod/:projectId/:artifactId/"
      component={make(() => import('sentry/views/preprod/index'))}
      withOrgPath
    >
      <IndexRoute component={make(() => import('sentry/views/preprod/buildDetails'))} />
    </Route>
  );

  const feedbackV2ChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/feedback/feedbackListPage')),
    },
    traceViewRouteObject,
  ];
  const feedbackv2Routes = (
    <Route
      path="/feedback/"
      component={make(() => import('sentry/views/feedback/index'))}
      withOrgPath
      newStyleChildren={feedbackV2ChildRoutes}
    />
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
        path={TabPaths[Tab.DISTRIBUTIONS]}
        component={make(() => import('sentry/views/issueDetails/groupTags/groupTagsTab'))}
      />
      <Route
        path={`${TabPaths[Tab.DISTRIBUTIONS]}:tagKey/`}
        component={make(
          () => import('sentry/views/issueDetails/groupTags/groupTagValues')
        )}
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
    <Route path="/issues/" withOrgPath>
      <IndexRoute component={errorHandler(OverviewWrapper)} />
      <Route
        path={`${IssueTaxonomy.ERRORS_AND_OUTAGES}/`}
        component={make(() => import('sentry/views/issueList/pages/errorsOutages'))}
      />
      <Route
        path={`${IssueTaxonomy.BREACHED_METRICS}/`}
        component={make(() => import('sentry/views/issueList/pages/breachedMetrics'))}
      />
      <Route
        path={`${IssueTaxonomy.WARNINGS}/`}
        component={make(() => import('sentry/views/issueList/pages/warnings'))}
      />
      <Route
        path="views/"
        component={make(
          () => import('sentry/views/issueList/issueViews/issueViewsList/issueViewsList')
        )}
      />
      <Route path="views/:viewId/" component={errorHandler(OverviewWrapper)} />
      <Route path="searches/:searchId/" component={errorHandler(OverviewWrapper)} />

      {/* Redirects for legacy tags route. */}
      <Redirect
        from=":groupId/tags/"
        to={`/issues/:groupId/${TabPaths[Tab.DISTRIBUTIONS]}`}
      />
      <Redirect
        from=":groupId/tags/:tagKey/"
        to={`/issues/:groupId/${TabPaths[Tab.DISTRIBUTIONS]}:tagKey/`}
      />
      <Redirect
        from={`:groupId/${TabPaths[Tab.EVENTS]}:eventId/tags/`}
        to={`/issues/:groupId/${TabPaths[Tab.EVENTS]}:eventId/${TabPaths[Tab.DISTRIBUTIONS]}`}
      />
      <Redirect
        from={`:groupId/${TabPaths[Tab.EVENTS]}:eventId/tags/:tagKey/`}
        to={`/issues/:groupId/${TabPaths[Tab.EVENTS]}:eventId/${TabPaths[Tab.DISTRIBUTIONS]}:tagKey/`}
      />

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
        newStyleChildren={feedbackV2ChildRoutes}
      />
      <Route path="alerts/" component={make(() => import('sentry/views/alerts'))}>
        {alertChildRoutes({forCustomerDomain: true})}
      </Route>
      {traceViewRoute}
      {automationRoutes}
      {detectorRoutes}
    </Route>
  );

  // These are the "manage" pages. For sentry.io, these are _different_ from
  // the SaaS admin routes in getsentry.
  const adminManageRoutes = (
    <Route
      path="/manage/"
      component={make(() => import('sentry/views/admin/adminLayout'))}
      newStyleChildren={[
        {
          index: true,
          component: make(() => import('sentry/views/admin/adminOverview')),
        },
        {
          path: 'buffer/',
          component: make(() => import('sentry/views/admin/adminBuffer')),
        },
        {
          path: 'relays/',
          component: make(() => import('sentry/views/admin/adminRelays')),
        },
        {
          path: 'organizations/',
          component: make(() => import('sentry/views/admin/adminOrganizations')),
        },
        {
          path: 'projects/',
          component: make(() => import('sentry/views/admin/adminProjects')),
        },
        {
          path: 'queue/',
          component: make(() => import('sentry/views/admin/adminQueue')),
        },
        {
          path: 'quotas/',
          component: make(() => import('sentry/views/admin/adminQuotas')),
        },
        {
          path: 'settings/',
          component: make(() => import('sentry/views/admin/adminSettings')),
        },
        {
          path: 'users/',
          children: [
            {
              index: true,
              component: make(() => import('sentry/views/admin/adminUsers')),
            },
            {
              path: ':id',
              component: make(() => import('sentry/views/admin/adminUserEdit')),
            },
          ],
        },
        {
          path: 'status/mail/',
          component: make(() => import('sentry/views/admin/adminMail')),
        },
        {
          path: 'status/environment/',
          component: make(() => import('sentry/views/admin/adminEnvironment')),
        },
        {
          path: 'status/packages/',
          component: make(() => import('sentry/views/admin/adminPackages')),
        },
        {
          path: 'status/warnings/',
          component: make(() => import('sentry/views/admin/adminWarnings')),
        },
      ]}
    />
  );

  const legacyOrganizationRootRoutes = (
    <Fragment>
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
        <Redirect from="user-feedback/" to="/organizations/:orgId/feedback/" />
      </Route>
    </Fragment>
  );

  const gettingStartedChildRoutes: SentryRouteObject[] = [
    {
      path: '/getting-started/:projectId/',
      component: () => (
        <WorkingRedirect to="/projects/:projectId/getting-started/" replace />
      ),
      customerDomainOnlyRoute: true,
    },
    {
      path: '/getting-started/:projectId/:platform/',
      component: () => (
        <WorkingRedirect to="/projects/:projectId/getting-started/" replace />
      ),
      customerDomainOnlyRoute: true,
    },
    {
      path: '/:orgId/:projectId/getting-started/',
      component: () => (
        <WorkingRedirect
          to="/organizations/:orgId/projects/:projectId/getting-started/"
          replace
        />
      ),
    },
    {
      path: '/:orgId/:projectId/getting-started/:platform/',
      component: () => (
        <WorkingRedirect
          to="/organizations/:orgId/projects/:projectId/getting-started/"
          replace
        />
      ),
    },
  ];

  const gettingStartedRoutes = <Route newStyleChildren={gettingStartedChildRoutes} />;

  const profilingRoutes = (
    <Route
      path="/profiling/"
      component={make(() => import('sentry/views/profiling'))}
      withOrgPath
      newStyleChildren={profilingChildRoutes}
    />
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
              `/organizations/${orgId}/feedback/?project=${projectId}`
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
      {settingsRoutes}
      {projectsRoutes}
      {dashboardRoutes}
      {feedbackv2Routes}
      {issueRoutes}
      {alertRoutes}
      {codecovRoutes}
      {preprodRoutes}
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
    <Route component={ProvideAriaRouter}>
      {experimentalSpaRoutes}
      <Route path="/" component={errorHandler(App)}>
        {rootRoutes}
        {authV2Routes}
        {organizationRoutes}
        {legacyRedirectRoutes}
        <Route path="*" component={errorHandler(RouteNotFound)} />
      </Route>
    </Route>
  );

  return appRoutes;
}

// We load routes both when initializing the SDK (for routing integrations) and
// when the app renders Main. Memoize to avoid rebuilding the route tree.
export const routes = memoize(buildRoutes);

// Exported for use in tests.
export {buildRoutes};

function NoOp({children}: {children: React.JSX.Element}) {
  return children;
}
