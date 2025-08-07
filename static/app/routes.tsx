import type {RouteObject} from 'react-router-dom';
import memoize from 'lodash/memoize';

import {EXPERIMENTAL_SPA} from 'sentry/constants';
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

import {type SentryRouteObject} from './components/route';
import {translateSentryRoute} from './utils/reactRouter6Compat/router';
import {makeLazyloadComponent as make} from './makeLazyloadComponent';

const routeHook = (name: HookName): SentryRouteObject => {
  const route = HookStore.get(name)?.[0]?.() ?? {};
  return {
    ...route,
    deprecatedRouteProps: true,
  };
};

function buildRoutes(): RouteObject[] {
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
  //   loads the organization into context (though in some cases, there may be
  //   no organization)
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
  //   This route tree contains redirect routes for many old legacy paths.
  //
  //   You may also find redirects's collocated next to the feature routes
  //   they have redirects for. A good rule here is to place 'helper' redirects
  //   next to the routes they redirect to, and place 'legacy route' redirects
  //   for routes that have completely changed in this tree.

  const experimentalSpaChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/auth/login')),
      deprecatedRouteProps: true,
    },
    {
      path: ':orgId/',
      component: make(() => import('sentry/views/auth/login')),
      deprecatedRouteProps: true,
    },
  ];
  const experimentalSpaRoutes: SentryRouteObject = EXPERIMENTAL_SPA
    ? {
        path: '/auth/login/',
        component: errorHandler(AuthLayout),
        children: experimentalSpaChildRoutes,
      }
    : {};

  const rootChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/app/root')),
    },
    routeHook('routes:root'),
    {
      path: '/accept/:orgId/:memberId/:token/',
      component: make(() => import('sentry/views/acceptOrganizationInvite')),
    },
    {
      path: '/accept/:memberId/:token/',
      component: make(() => import('sentry/views/acceptOrganizationInvite')),
    },
    {
      path: '/accept-transfer/',
      component: make(() => import('sentry/views/acceptProjectTransfer')),
    },
    {
      component: errorHandler(OrganizationContainer),
      deprecatedRouteProps: true,
      children: [
        {
          path: '/extensions/external-install/:integrationSlug/:installationId',
          component: make(() => import('sentry/views/integrationOrganizationLink')),
        },
        {
          path: '/extensions/:integrationSlug/link/',
          component: make(() => import('sentry/views/integrationOrganizationLink')),
        },
      ],
    },
    {
      path: '/sentry-apps/:sentryAppSlug/external-install/',
      component: make(() => import('sentry/views/sentryAppExternalInstallation')),
      deprecatedRouteProps: true,
    },
    {
      path: '/account/',
      redirectTo: '/settings/account/details/',
    },
    {
      path: '/share/group/:shareId/',
      redirectTo: '/share/issue/:shareId/',
    },
    // Add redirect from old user feedback to new feedback
    {
      path: '/user-feedback/',
      redirectTo: '/feedback/',
    },
    // TODO: remove share/issue orgless url
    {
      path: '/share/issue/:shareId/',
      component: make(() => import('sentry/views/sharedGroupDetails')),
      deprecatedRouteProps: true,
    },
    {
      path: '/organizations/:orgId/share/issue/:shareId/',
      component: make(() => import('sentry/views/sharedGroupDetails')),
      deprecatedRouteProps: true,
    },
    {
      path: '/unsubscribe/project/:id/',
      component: make(() => import('sentry/views/unsubscribe/project')),
      customerDomainOnlyRoute: true,
      deprecatedRouteProps: true,
    },
    {
      path: '/unsubscribe/:orgId/project/:id/',
      component: make(() => import('sentry/views/unsubscribe/project')),
      deprecatedRouteProps: true,
    },
    {
      path: '/unsubscribe/issue/:id/',
      component: make(() => import('sentry/views/unsubscribe/issue')),
      customerDomainOnlyRoute: true,
      deprecatedRouteProps: true,
    },
    {
      path: '/unsubscribe/:orgId/issue/:id/',
      component: make(() => import('sentry/views/unsubscribe/issue')),
      deprecatedRouteProps: true,
    },
    {
      path: '/organizations/new/',
      component: make(() => import('sentry/views/organizationCreate')),
      deprecatedRouteProps: true,
    },
    {
      path: '/data-export/:dataExportId',
      component: make(() => import('sentry/views/dataExport/dataDownload')),
      withOrgPath: true,
      deprecatedRouteProps: true,
    },
    {
      component: errorHandler(OrganizationContainer),
      deprecatedRouteProps: true,
      children: [
        {
          path: '/disabled-member/',
          component: make(() => import('sentry/views/disabledMember')),
          withOrgPath: true,
          deprecatedRouteProps: true,
        },
      ],
    },
    {
      path: '/restore/',
      component: make(() => import('sentry/views/organizationRestore')),
      customerDomainOnlyRoute: true,
      deprecatedRouteProps: true,
    },
    {
      path: '/organizations/:orgId/restore/',
      component: make(() => import('sentry/views/organizationRestore')),
      deprecatedRouteProps: true,
    },
    {
      path: '/join-request/',
      component: withDomainRequired(
        make(() => import('sentry/views/organizationJoinRequest'))
      ),
      customerDomainOnlyRoute: true,
      deprecatedRouteProps: true,
    },
    {
      path: '/join-request/:orgId/',
      component: withDomainRedirect(
        make(() => import('sentry/views/organizationJoinRequest'))
      ),
      deprecatedRouteProps: true,
    },
    {
      path: '/relocation/',
      component: make(() => import('sentry/views/relocation')),
      deprecatedRouteProps: true,
      children: [
        {
          index: true,
          redirectTo: 'get-started/',
        },
        {
          path: ':step/',
          component: make(() => import('sentry/views/relocation')),
          deprecatedRouteProps: true,
        },
      ],
    },
    {
      path: '/onboarding/',
      redirectTo: '/onboarding/welcome/',
      customerDomainOnlyRoute: true,
    },
    {
      path: '/onboarding/:step/',
      component: errorHandler(withDomainRequired(OrganizationContainer)),
      customerDomainOnlyRoute: true,
      deprecatedRouteProps: true,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/onboarding')),
          deprecatedRouteProps: true,
        },
      ],
    },
    {
      path: '/onboarding/:orgId/',
      redirectTo: '/onboarding/:orgId/welcome/',
    },
    {
      path: '/onboarding/:orgId/:step/',
      component: withDomainRedirect(errorHandler(OrganizationContainer)),
      deprecatedRouteProps: true,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/onboarding')),
          deprecatedRouteProps: true,
        },
      ],
    },
    {
      path: '/stories/:storyType?/:storySlug?/',
      component: make(() => import('sentry/stories/view/index')),
      withOrgPath: true,
    },
    {
      path: '/debug/notifications/',
      component: make(() => import('sentry/debug/notifications/views/index')),
      withOrgPath: true,
    },
  ];
  const rootRoutes: SentryRouteObject = {
    component: errorHandler(AppBodyContent),
    children: rootChildren,
    deprecatedRouteProps: true,
  };

  const accountSettingsChildren: SentryRouteObject[] = [
    {
      index: true,
      redirectTo: 'details/',
    },
    {
      path: 'details/',
      name: t('Details'),
      component: make(() => import('sentry/views/settings/account/accountDetails')),
    },
    {
      path: 'notifications/',
      name: t('Notifications'),
      children: [
        {
          index: true,
          component: make(
            () =>
              import(
                'sentry/views/settings/account/notifications/notificationSettingsController'
              )
          ),
          deprecatedRouteProps: true,
        },
        {
          path: ':fineTuneType/',
          name: t('Fine Tune Alerts'),
          component: make(
            () =>
              import(
                'sentry/views/settings/account/accountNotificationFineTuningController'
              )
          ),
          deprecatedRouteProps: true,
        },
      ],
    },
    {
      path: 'emails/',
      name: t('Emails'),
      component: make(() => import('sentry/views/settings/account/accountEmails')),
    },
    {
      path: 'merge-accounts/',
      name: t('Merge Accounts'),
      component: make(() => import('sentry/views/settings/account/mergeAccounts')),
    },
    {
      path: 'authorizations/',
      component: make(
        () => import('sentry/views/settings/account/accountAuthorizations')
      ),
    },
    {
      path: 'security/',
      name: t('Security'),
      children: [
        {
          component: make(
            () =>
              import(
                'sentry/views/settings/account/accountSecurity/accountSecurityWrapper'
              )
          ),
          deprecatedRouteProps: true,
          children: [
            {
              index: true,
              component: make(
                () => import('sentry/views/settings/account/accountSecurity')
              ),
              deprecatedRouteProps: true,
            },
            {
              path: 'session-history/',
              name: t('Session History'),
              component: make(
                () =>
                  import('sentry/views/settings/account/accountSecurity/sessionHistory')
              ),
              deprecatedRouteProps: true,
            },
            {
              path: 'mfa/:authId/',
              name: t('Details'),
              component: make(
                () =>
                  import(
                    'sentry/views/settings/account/accountSecurity/accountSecurityDetails'
                  )
              ),
              deprecatedRouteProps: true,
            },
          ],
        },
        {
          path: 'mfa/:authId/enroll/',
          name: t('Enroll'),
          component: make(
            () =>
              import(
                'sentry/views/settings/account/accountSecurity/accountSecurityEnroll'
              )
          ),
        },
      ],
    },
    {
      path: 'subscriptions/',
      name: t('Subscriptions'),
      component: make(() => import('sentry/views/settings/account/accountSubscriptions')),
    },
    {
      path: 'identities/',
      name: t('Identities'),
      component: make(() => import('sentry/views/settings/account/accountIdentities')),
    },
    {
      path: 'api/',
      name: t('API'),
      children: [
        {
          index: true,
          redirectTo: 'auth-tokens/',
        },
        {
          path: 'auth-tokens/',
          name: t('Personal Tokens'),
          children: [
            {
              index: true,
              component: make(() => import('sentry/views/settings/account/apiTokens')),
            },
            {
              path: 'new-token/',
              name: t('Create Personal Token'),
              component: make(() => import('sentry/views/settings/account/apiNewToken')),
            },
            {
              path: ':tokenId/',
              name: t('Edit Personal Token'),
              component: make(
                () => import('sentry/views/settings/account/apiTokenDetails')
              ),
            },
          ],
        },
        {
          path: 'applications/',
          name: t('Applications'),
          children: [
            {
              index: true,
              component: make(
                () => import('sentry/views/settings/account/apiApplications')
              ),
              deprecatedRouteProps: true,
            },
            {
              path: ':appId/',
              name: t('Details'),
              component: make(
                () => import('sentry/views/settings/account/apiApplications/details')
              ),
              deprecatedRouteProps: true,
            },
          ],
        },
      ],
    },
    {
      path: 'close-account/',
      name: t('Close Account'),
      component: make(() => import('sentry/views/settings/account/accountClose')),
    },
  ];
  const accountSettingsRoutes: SentryRouteObject = {
    path: 'account/',
    name: t('Account'),
    component: make(() => import('sentry/views/settings/account/accountSettingsLayout')),
    children: accountSettingsChildren,
    deprecatedRouteProps: true,
  };

  const projectSettingsChildren: SentryRouteObject[] = [
    {
      index: true,
      name: t('General'),
      component: make(() => import('sentry/views/settings/projectGeneralSettings')),
    },
    {
      path: 'install/',
      redirectTo: '/projects/:projectId/getting-started/',
    },
    {
      path: 'teams/',
      name: t('Teams'),
      component: make(() => import('sentry/views/settings/project/projectTeams')),
      deprecatedRouteProps: true,
    },
    {
      path: 'alerts/',
      name: t('Alerts'),
      component: make(() => import('sentry/views/settings/projectAlerts')),
      deprecatedRouteProps: true,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/projectAlerts/settings')),
          deprecatedRouteProps: true,
        },
        {
          path: 'new/',
          redirectTo: '/organizations/:orgId/alerts/:projectId/new/',
        },
        {
          path: 'rules/',
          redirectTo: '/organizations/:orgId/alerts/rules/',
        },
        {
          path: 'rules/new/',
          redirectTo: '/organizations/:orgId/alerts/:projectId/new/',
        },
        {
          path: 'metric-rules/new/',
          redirectTo: '/organizations/:orgId/alerts/:projectId/new/',
        },
        {
          path: 'rules/:ruleId/',
          redirectTo: '/organizations/:orgId/alerts/rules/:projectId/:ruleId/',
        },
        {
          path: 'metric-rules/:ruleId/',
          redirectTo: '/organizations/:orgId/alerts/metric-rules/:projectId/:ruleId/',
        },
      ],
    },
    {
      path: 'environments/',
      name: t('Environments'),
      component: make(() => import('sentry/views/settings/project/projectEnvironments')),
      deprecatedRouteProps: true,
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
      deprecatedRouteProps: true,
    },
    {
      path: 'issue-tracking/',
      redirectTo: '/settings/:orgId/:projectId/plugins/',
    },
    {
      path: 'release-tracking/',
      name: t('Release Tracking'),
      component: make(
        () => import('sentry/views/settings/project/projectReleaseTracking')
      ),
      deprecatedRouteProps: true,
    },
    {
      path: 'ownership/',
      name: t('Ownership Rules'),
      component: make(() => import('sentry/views/settings/project/projectOwnership')),
      deprecatedRouteProps: true,
    },
    {
      path: 'data-forwarding/',
      name: t('Data Forwarding'),
      component: make(() => import('sentry/views/settings/projectDataForwarding')),
      deprecatedRouteProps: true,
    },
    {
      path: 'seer/',
      name: t('Seer'),
      component: make(() => import('sentry/views/settings/projectSeer/index')),
      deprecatedRouteProps: true,
    },
    {
      path: 'user-feedback/',
      name: t('User Feedback'),
      component: make(() => import('sentry/views/settings/projectUserFeedback')),
      deprecatedRouteProps: true,
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
          deprecatedRouteProps: true,
        },
        {
          path: 'advanced-data-scrubbing/:scrubbingId/',
          component: make(
            () => import('sentry/views/settings/projectSecurityAndPrivacy')
          ),
          deprecatedRouteProps: true,
        },
      ],
    },
    {
      path: 'debug-symbols/',
      name: t('Debug Information Files'),
      component: make(() => import('sentry/views/settings/projectDebugFiles')),
      deprecatedRouteProps: true,
    },
    {
      path: 'proguard/',
      name: t('ProGuard Mappings'),
      component: make(() => import('sentry/views/settings/projectProguard')),
      deprecatedRouteProps: true,
    },
    {
      path: 'performance/',
      name: t('Performance'),
      component: make(() => import('sentry/views/settings/projectPerformance')),
      deprecatedRouteProps: true,
    },
    {
      path: 'playstation/',
      name: t('PlayStation'),
      component: make(() => import('sentry/views/settings/project/tempest')),
      deprecatedRouteProps: true,
    },
    {
      path: 'replays/',
      name: t('Replays'),
      component: make(() => import('sentry/views/settings/project/projectReplays')),
      deprecatedRouteProps: true, // Should be false except for ProjectContext passed via `outletContext`
    },
    {
      path: 'toolbar/',
      name: t('Developer Toolbar'),
      component: make(() => import('sentry/views/settings/project/projectToolbar')),
      deprecatedRouteProps: true, // Should be false except for ProjectContext passed via `outletContext`
    },
    {
      path: 'source-maps/',
      name: t('Source Maps'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/projectSourceMaps')),
          deprecatedRouteProps: true,
        },
        {
          path: ':bundleId/',
          name: t('Source Map Uploads'),
          component: make(() => import('sentry/views/settings/projectSourceMaps')),
          deprecatedRouteProps: true,
        },
        {
          path: 'source-maps/artifact-bundles/',
          redirectTo: 'source-maps/',
        },
        {
          path: 'source-maps/release-bundles/',
          redirectTo: 'source-maps/',
        },
      ],
    },
    {
      path: 'filters/',
      name: t('Inbound Filters'),
      component: make(() => import('sentry/views/settings/project/projectFilters')),
      deprecatedRouteProps: true,
      children: [
        {
          index: true,
          redirectTo: 'data-filters/',
        },
        {
          path: ':filterType/',
        },
      ],
    },
    {
      path: 'dynamic-sampling/',
      redirectTo: 'performance/',
    },
    {
      path: 'issue-grouping/',
      name: t('Issue Grouping'),
      component: make(() => import('sentry/views/settings/projectIssueGrouping')),
      deprecatedRouteProps: true,
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
      deprecatedRouteProps: true,
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
          deprecatedRouteProps: true,
        },
        {
          path: ':keyId/',
          name: t('Details'),
          component: make(
            () => import('sentry/views/settings/project/projectKeys/details')
          ),
          deprecatedRouteProps: true,
        },
      ],
    },
    {
      path: 'loader-script/',
      name: t('Loader Script'),
      component: make(() => import('sentry/views/settings/project/loaderScript')),
      deprecatedRouteProps: true,
    },
    {
      path: 'csp/',
      redirectTo: '/settings/:orgId/projects/:projectId/security-headers/csp/',
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
          deprecatedRouteProps: true,
        },
        {
          path: ':pluginId/',
          name: t('Integration Details'),
          component: make(() => import('sentry/views/settings/projectPlugins/details')),
          deprecatedRouteProps: true,
        },
      ],
    },
  ];
  const projectSettingsRoutes: SentryRouteObject = {
    path: 'projects/:projectId/',
    name: t('Project'),
    component: make(() => import('sentry/views/settings/project/projectSettingsLayout')),
    children: projectSettingsChildren,
    deprecatedRouteProps: true,
  };

  const statsChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/organizationStats')),
      deprecatedRouteProps: true,
    },
    {
      component: make(() => import('sentry/views/organizationStats/teamInsights')),
      deprecatedRouteProps: true,
      children: [
        {
          path: 'issues/',
          component: make(
            () => import('sentry/views/organizationStats/teamInsights/issues')
          ),
          deprecatedRouteProps: true,
        },
        {
          path: 'health/',
          component: make(
            () => import('sentry/views/organizationStats/teamInsights/health')
          ),
          deprecatedRouteProps: true,
        },
      ],
    },
  ];
  const statsRoutes: SentryRouteObject = {
    children: [
      {
        path: '/stats/',
        withOrgPath: true,
        component: OrganizationStatsWrapper,
        children: statsChildren,
        deprecatedRouteProps: true,
      },
      {
        path: '/organizations/:orgId/stats/team/',
        redirectTo: '/organizations/:orgId/stats/issues/',
      },
    ],
  };

  const orgSettingsChildren: SentryRouteObject[] = [
    routeHook('routes:settings'),
    {
      index: true,
      name: t('General'),
      component: make(() => import('sentry/views/settings/organizationGeneralSettings')),
    },
    {
      path: 'organization/',
      name: t('General'),
      component: make(() => import('sentry/views/settings/organizationGeneralSettings')),
    },
    {
      path: 'projects/',
      name: t('Projects'),
      component: make(() => import('sentry/views/settings/organizationProjects')),
    },
    {
      path: 'api-keys/',
      name: t('API Key'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/organizationApiKeys')),
        },
        {
          path: ':apiKey/',
          name: t('Details'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationApiKeys/organizationApiKeyDetails'
              )
          ),
        },
      ],
    },
    {
      path: 'audit-log/',
      name: t('Audit Log'),
      component: make(() => import('sentry/views/settings/organizationAuditLog')),
      deprecatedRouteProps: true,
    },
    {
      path: 'auth/',
      name: t('Auth Providers'),
      component: make(() => import('sentry/views/settings/organizationAuth')),
    },
    {
      path: 'members/requests',
      redirectTo: '../members/',
    },
    {
      path: 'members/',
      name: t('Members'),
      children: [
        {
          index: true,
          component: make(
            () =>
              import('sentry/views/settings/organizationMembers/organizationMembersList')
          ),
        },
        {
          path: ':memberId/',
          name: t('Details'),
          component: make(
            () =>
              import('sentry/views/settings/organizationMembers/organizationMemberDetail')
          ),
        },
      ],
    },
    {
      path: 'relay/',
      name: t('Relay'),
      component: make(() => import('sentry/views/settings/organizationRelay')),
    },
    {
      path: 'repos/',
      name: t('Repositories'),
      component: make(() => import('sentry/views/settings/organizationRepositories')),
    },
    {
      path: 'settings/',
      component: make(() => import('sentry/views/settings/organizationGeneralSettings')),
    },
    {
      path: 'security-and-privacy/',
      name: t('Security & Privacy'),
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/settings/organizationSecurityAndPrivacy')
          ),
        },
        {
          path: 'advanced-data-scrubbing/:scrubbingId/',
          component: make(
            () => import('sentry/views/settings/organizationSecurityAndPrivacy')
          ),
        },
      ],
    },
    {
      path: 'teams/',
      name: t('Teams'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/organizationTeams')),
          deprecatedRouteProps: true,
        },
        {
          path: ':teamId/',
          name: t('Team'),
          component: make(
            () => import('sentry/views/settings/organizationTeams/teamDetails')
          ),
          deprecatedRouteProps: true,
          children: [
            {
              index: true,
              redirectTo: 'members/',
            },
            {
              path: 'members/',
              name: t('Members'),
              component: make(
                () => import('sentry/views/settings/organizationTeams/teamMembers')
              ),
              deprecatedRouteProps: true,
            },
            {
              path: 'notifications/',
              name: t('Notifications'),
              component: make(
                () => import('sentry/views/settings/organizationTeams/teamNotifications')
              ),
            },
            {
              path: 'projects/',
              name: t('Projects'),
              component: make(
                () => import('sentry/views/settings/organizationTeams/teamProjects')
              ),
              deprecatedRouteProps: true,
            },
            {
              path: 'settings/',
              name: t('Settings'),
              component: make(
                () => import('sentry/views/settings/organizationTeams/teamSettings')
              ),
              deprecatedRouteProps: true,
            },
          ],
        },
      ],
    },
    {
      path: 'plugins/',
      redirectTo: 'integrations/',
    },
    {
      path: 'plugins/',
      name: t('Integrations'),
      children: [
        {
          path: ':integrationSlug/',
          name: t('Integration Details'),
          component: make(
            () =>
              import('sentry/views/settings/organizationIntegrations/pluginDetailedView')
          ),
        },
      ],
    },
    {
      path: 'sentry-apps/',
      redirectTo: 'integrations/',
    },
    {
      path: 'sentry-apps/',
      name: t('Integrations'),
      children: [
        {
          path: ':integrationSlug',
          name: t('Details'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/sentryAppDetailedView'
              )
          ),
        },
      ],
    },
    {
      path: 'document-integrations/',
      redirectTo: 'integrations/',
    },
    {
      path: 'document-integrations/',
      name: t('Integrations'),
      children: [
        {
          path: ':integrationSlug',
          name: t('Details'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/docIntegrationDetailedView'
              )
          ),
        },
      ],
    },
    {
      path: 'integrations/',
      name: t('Integrations'),
      children: [
        {
          index: true,
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/integrationListDirectory'
              )
          ),
        },
        {
          path: ':integrationSlug',
          name: t('Integration Details'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/integrationDetailedView'
              )
          ),
        },
        {
          path: ':providerKey/:integrationId/',
          name: t('Configure Integration'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationIntegrations/configureIntegration'
              )
          ),
          deprecatedRouteProps: true,
        },
      ],
    },
    {
      path: 'developer-settings/',
      name: t('Custom Integrations'),
      children: [
        {
          index: true,
          component: make(
            () => import('sentry/views/settings/organizationDeveloperSettings')
          ),
        },
        {
          path: 'new-public/',
          name: t('Create Integration'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
              )
          ),
          deprecatedRouteProps: true,
        },
        {
          path: 'new-internal/',
          name: t('Create Integration'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
              )
          ),
          deprecatedRouteProps: true,
        },
        {
          path: ':appSlug/',
          name: t('Edit Integration'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDetails'
              )
          ),
          deprecatedRouteProps: true,
        },
        {
          path: ':appSlug/dashboard/',
          name: t('Integration Dashboard'),
          component: make(
            () =>
              import(
                'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDashboard'
              )
          ),
        },
      ],
    },
    {
      path: 'auth-tokens/',
      name: t('Organization Tokens'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/organizationAuthTokens')),
        },
        {
          path: 'new-token/',
          name: t('Create New Organization Token'),
          component: make(
            () => import('sentry/views/settings/organizationAuthTokens/newAuthToken')
          ),
        },
        {
          path: ':tokenId/',
          name: t('Edit Organization Token'),
          component: make(
            () => import('sentry/views/settings/organizationAuthTokens/authTokenDetails')
          ),
          deprecatedRouteProps: true,
        },
      ],
    },
    {
      path: 'early-features/',
      name: t('Early Features'),
      component: make(() => import('sentry/views/settings/earlyFeatures')),
      deprecatedRouteProps: true,
    },
    {
      path: 'dynamic-sampling/',
      name: t('Dynamic Sampling'),
      component: make(() => import('sentry/views/settings/dynamicSampling')),
    },
    {
      path: 'feature-flags/',
      name: t('Feature Flags'),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/settings/featureFlags')),
        },
        {
          path: 'change-tracking/',
          name: t('Change Tracking'),
          children: [
            {
              index: true,
              component: make(
                () => import('sentry/views/settings/featureFlags/changeTracking')
              ),
            },
            {
              path: 'new-provider/',
              name: t('Add New Provider'),
              component: make(
                () =>
                  import(
                    'sentry/views/settings/featureFlags/changeTracking/organizationFeatureFlagsNewSecret'
                  )
              ),
            },
          ],
        },
      ],
    },
    {
      path: 'seer/',
      name: t('Seer Automation'),
      children: [
        {
          index: true,
          component: make(() => import('getsentry/views/seerAutomation')),
        },
        {
          path: 'onboarding/',
          name: t('Configure Seer for All Projects'),
          component: make(() => import('getsentry/views/seerAutomation/onboarding')),
        },
      ],
    },
    {
      path: 'stats/',
      name: t('Stats'),
      children: statsChildren,
    },
  ];
  const orgSettingsRoutes: SentryRouteObject = {
    component: make(
      () => import('sentry/views/settings/organization/organizationSettingsLayout')
    ),
    children: orgSettingsChildren,
    deprecatedRouteProps: true,
  };

  const legacySettingsRedirects: SentryRouteObject = {
    children: [
      {
        path: ':projectId/',
        redirectTo: 'projects/:projectId/',
      },
      {
        path: ':projectId/alerts/',
        redirectTo: 'projects/:projectId/alerts/',
      },
      {
        path: ':projectId/alerts/rules/',
        redirectTo: 'projects/:projectId/alerts/rules/',
      },
      {
        path: ':projectId/alerts/rules/:ruleId/',
        redirectTo: 'projects/:projectId/alerts/rules/:ruleId/',
      },
    ],
  };

  const settingsRoutes: SentryRouteObject = {
    path: '/settings/',
    name: t('Settings'),
    component: SettingsWrapper,
    children: [
      {
        index: true,
        component: make(() => import('sentry/views/settings/settingsIndex')),
        deprecatedRouteProps: true,
      },
      accountSettingsRoutes,
      {
        name: t('Organization'),
        component: withDomainRequired(NoOp),
        customerDomainOnlyRoute: true,
        children: [orgSettingsRoutes, projectSettingsRoutes],
        deprecatedRouteProps: true,
      },
      {
        path: ':orgId/',
        name: t('Organization'),
        component: withDomainRedirect(NoOp),
        children: [orgSettingsRoutes, projectSettingsRoutes, legacySettingsRedirects],
        deprecatedRouteProps: true,
      },
    ],
    deprecatedRouteProps: true,
  };

  const projectsChildren: SentryRouteObject[] = [
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
      deprecatedRouteProps: true,
    },
    {
      path: ':projectId/events/:eventId/',
      component: errorHandler(ProjectEventRedirect),
      deprecatedRouteProps: true,
    },
    {
      path: ':projectId/getting-started/',
      component: make(() => import('sentry/views/projectInstall/gettingStarted')),
      deprecatedRouteProps: true,
    },
  ];
  const projectsRoutes: SentryRouteObject = {
    path: '/projects/',
    component: make(() => import('sentry/views/projects/')),
    withOrgPath: true,
    children: projectsChildren,
    deprecatedRouteProps: true,
  };

  const traceView: SentryRouteObject = {
    path: 'trace/:traceSlug/',
    component: make(() => import('sentry/views/performance/traceDetails')),
    deprecatedRouteProps: true,
  };

  const dashboardChildren: SentryRouteObject[] = [
    {
      path: '/dashboards/',
      component: withDomainRequired(make(() => import('sentry/views/dashboards'))),
      customerDomainOnlyRoute: true,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/dashboards/manage')),
        },
        traceView,
      ],
      deprecatedRouteProps: true,
    },
    {
      path: '/organizations/:orgId/dashboards/',
      component: withDomainRedirect(make(() => import('sentry/views/dashboards'))),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/dashboards/manage')),
        },
      ],
      deprecatedRouteProps: true,
    },
    {
      path: '/dashboards/new/',
      component: make(() => import('sentry/views/dashboards/create')),
      deprecatedRouteProps: true,
      withOrgPath: true,
      children: [
        // new widget builder routes
        {
          path: 'widget-builder/widget/:widgetIndex/edit/',
          component: make(() => import('sentry/views/dashboards/view')),
          deprecatedRouteProps: true,
        },
        {
          path: 'widget-builder/widget/new/',
          component: make(() => import('sentry/views/dashboards/view')),
          deprecatedRouteProps: true,
        },
        // old widget builder routes
        {
          path: 'widget/:widgetIndex/edit/',
          component: make(() => import('sentry/views/dashboards/widgetBuilder')),
          deprecatedRouteProps: true,
        },
        {
          path: 'widget/new/',
          component: make(() => import('sentry/views/dashboards/widgetBuilder')),
          deprecatedRouteProps: true,
        },
      ],
    },
    {
      path: '/dashboards/new/:templateId',
      component: make(() => import('sentry/views/dashboards/create')),
      deprecatedRouteProps: true,
      withOrgPath: true,
      children: [
        {
          path: 'widget/:widgetId/',
          component: make(() => import('sentry/views/dashboards/create')),
          deprecatedRouteProps: true,
        },
      ],
    },
    {
      path: '/organizations/:orgId/dashboards/:dashboardId/',
      redirectTo: '/organizations/:orgId/dashboard/:dashboardId/',
    },
    {
      path: '/dashboards/:dashboardId/',
      redirectTo: '/dashboard/:dashboardId/',
      customerDomainOnlyRoute: true,
    },
    {
      path: '/dashboard/:dashboardId/',
      component: make(() => import('sentry/views/dashboards/view')),
      deprecatedRouteProps: true,
      withOrgPath: true,
      children: [
        {
          path: 'widget-builder/widget/:widgetIndex/edit/',
          component: make(() => import('sentry/views/dashboards/view')),
          deprecatedRouteProps: true,
        },
        {
          path: 'widget-builder/widget/new/',
          component: make(() => import('sentry/views/dashboards/view')),
          deprecatedRouteProps: true,
        },
        {
          path: 'widget/:widgetIndex/edit/',
          component: make(() => import('sentry/views/dashboards/widgetBuilder')),
          deprecatedRouteProps: true,
        },
        {
          path: 'widget/new/',
          component: make(() => import('sentry/views/dashboards/widgetBuilder')),
          deprecatedRouteProps: true,
        },
        {
          path: 'widget/:widgetId/',
          component: make(() => import('sentry/views/dashboards/view')),
          deprecatedRouteProps: true,
        },
      ],
    },
  ];
  const dashboardRoutes: SentryRouteObject = {
    children: dashboardChildren,
  };

  const alertChildRoutes = (forCustomerDomain: boolean): SentryRouteObject[] => [
    {
      index: true,
      component: make(() => import('sentry/views/alerts/list/incidents')),
      deprecatedRouteProps: true,
    },
    {
      path: 'rules/',
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/alerts/list/rules/alertRulesList')),
          deprecatedRouteProps: true,
        },
        {
          path: 'details/:ruleId/',
          component: make(() => import('sentry/views/alerts/rules/metric/details')),
          deprecatedRouteProps: true,
        },
        {
          path: ':projectId/',
          component: make(() => import('sentry/views/alerts/builder/projectProvider')),
          deprecatedRouteProps: true,
          children: [
            {
              index: true,
              redirectTo: forCustomerDomain
                ? '/alerts/rules/'
                : '/organizations/:orgId/alerts/rules/',
            },
            {
              path: ':ruleId/',
              component: make(() => import('sentry/views/alerts/edit')),
              deprecatedRouteProps: true,
            },
          ],
        },
        {
          path: ':projectId/:ruleId/details/',
          children: [
            {
              index: true,
              component: make(
                () => import('sentry/views/alerts/rules/issue/details/ruleDetails')
              ),
              deprecatedRouteProps: true,
            },
          ],
        },
        {
          path: 'uptime/',
          component: make(() => import('sentry/views/alerts/rules/uptime')),
          deprecatedRouteProps: true,
          children: [
            {
              path: ':projectId/:uptimeRuleId/details/',
              component: make(() => import('sentry/views/alerts/rules/uptime/details')),
              deprecatedRouteProps: true,
            },
            {
              path: 'existing-or-create/',
              component: make(
                () => import('sentry/views/alerts/rules/uptime/existingOrCreate')
              ),
              deprecatedRouteProps: true,
            },
          ],
        },
        {
          path: 'crons/',
          component: make(() => import('sentry/views/alerts/rules/crons')),
          deprecatedRouteProps: true,
          children: [
            {
              path: ':projectId/:monitorSlug/details/',
              component: make(() => import('sentry/views/alerts/rules/crons/details')),
              deprecatedRouteProps: true,
            },
          ],
        },
      ],
    },
    {
      path: 'metric-rules/',
      children: [
        {
          index: true,
          redirectTo: forCustomerDomain
            ? '/alerts/rules/'
            : '/organizations/:orgId/alerts/rules/',
        },
        {
          path: ':projectId/',
          component: make(() => import('sentry/views/alerts/builder/projectProvider')),
          deprecatedRouteProps: true,
          children: [
            {
              index: true,
              redirectTo: forCustomerDomain
                ? '/alerts/rules/'
                : '/organizations/:orgId/alerts/rules/',
            },
            {
              path: ':ruleId/',
              component: make(() => import('sentry/views/alerts/edit')),
              deprecatedRouteProps: true,
            },
          ],
        },
      ],
    },
    {
      path: 'uptime-rules/',
      children: [
        {
          path: ':projectId/',
          component: make(() => import('sentry/views/alerts/builder/projectProvider')),
          deprecatedRouteProps: true,
          children: [
            {
              path: ':ruleId/',
              component: make(() => import('sentry/views/alerts/edit')),
              deprecatedRouteProps: true,
            },
          ],
        },
      ],
    },
    {
      path: 'crons-rules/',
      children: [
        {
          path: ':projectId/',
          component: make(() => import('sentry/views/alerts/builder/projectProvider')),
          deprecatedRouteProps: true,
          children: [
            {
              path: ':monitorSlug/',
              component: make(() => import('sentry/views/alerts/edit')),
              deprecatedRouteProps: true,
            },
          ],
        },
      ],
    },
    {
      path: 'wizard/',
      component: make(() => import('sentry/views/alerts/builder/projectProvider')),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/alerts/wizard')),
          deprecatedRouteProps: true,
        },
      ],
      deprecatedRouteProps: true,
    },
    {
      path: 'new/',
      component: make(() => import('sentry/views/alerts/builder/projectProvider')),
      deprecatedRouteProps: true,
      children: [
        {
          index: true,
          redirectTo: forCustomerDomain
            ? '/alerts/wizard/'
            : '/organizations/:orgId/alerts/wizard/',
        },
        {
          path: ':alertType/',
          component: make(() => import('sentry/views/alerts/create')),
          deprecatedRouteProps: true,
        },
      ],
    },
    {
      path: ':alertId/',
      component: make(() => import('sentry/views/alerts/incidentRedirect')),
      deprecatedRouteProps: true,
    },
    {
      path: ':projectId/',
      component: make(() => import('sentry/views/alerts/builder/projectProvider')),
      deprecatedRouteProps: true,
      children: [
        {
          path: 'new/',
          component: make(() => import('sentry/views/alerts/create')),
          deprecatedRouteProps: true,
        },
        {
          path: 'wizard/',
          component: make(() => import('sentry/views/alerts/wizard')),
          deprecatedRouteProps: true,
        },
      ],
    },
  ];
  const alertRoutes: SentryRouteObject = {
    children: [
      {
        path: '/alerts/',
        component: withDomainRequired(make(() => import('sentry/views/alerts'))),
        customerDomainOnlyRoute: true,
        children: alertChildRoutes(true),
        deprecatedRouteProps: true,
      },
      {
        path: '/organizations/:orgId/alerts/',
        component: withDomainRedirect(make(() => import('sentry/views/alerts'))),
        children: alertChildRoutes(false),
        deprecatedRouteProps: true,
      },
    ],
  };

  const replayChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/replays/list')),
    },
    {
      path: 'selectors/',
      component: make(() => import('sentry/views/replays/selectors')),
    },
    {
      path: ':replaySlug/',
      component: make(() => import('sentry/views/replays/details')),
    },
  ];
  const replayRoutes: SentryRouteObject = {
    path: '/replays/',
    component: make(() => import('sentry/views/replays/index')),
    withOrgPath: true,
    children: replayChildren,
  };

  const releaseChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/releases/list')),
    },
    {
      path: ':release/',
      component: make(() => import('sentry/views/releases/detail')),
      deprecatedRouteProps: true,
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
  const releasesRoutes: SentryRouteObject = {
    children: [
      {
        path: '/releases/',
        component: make(() => import('sentry/views/releases/index')),
        withOrgPath: true,
        children: releaseChildren,
        deprecatedRouteProps: true,
      },
      {
        path: '/releases/new-events/',
        redirectTo: '/organizations/:orgId/releases/:release/',
      },
      {
        path: '/releases/all-events/',
        redirectTo: '/organizations/:orgId/releases/:release/',
      },
    ],
  };

  const discoverChildren: SentryRouteObject[] = [
    {
      index: true,
      redirectTo: 'queries/',
    },
    {
      path: 'homepage/',
      component: make(() => import('sentry/views/discover/homepage')),
      deprecatedRouteProps: true,
    },
    traceView,
    {
      path: 'queries/',
      component: make(() => import('sentry/views/discover/landing')),
    },
    {
      path: 'results/',
      component: make(() => import('sentry/views/discover/results')),
      deprecatedRouteProps: true,
    },
    {
      path: ':eventSlug/',
      component: make(() => import('sentry/views/discover/eventDetails')),
      deprecatedRouteProps: true,
    },
  ];
  const discoverRoutes: SentryRouteObject = {
    path: '/discover/',
    component: make(() => import('sentry/views/discover')),
    withOrgPath: true,
    children: discoverChildren,
    deprecatedRouteProps: true,
  };

  // Redirects for old LLM monitoring routes
  const llmMonitoringRedirects: SentryRouteObject = {
    children: [
      {
        path: '/llm-monitoring/',
        redirectTo: `/${INSIGHTS_BASE_URL}/${AGENTS_LANDING_SUB_PATH}/`,
        customerDomainOnlyRoute: true,
      },
      {
        path: '/organizations/:orgId/llm-monitoring/',
        redirectTo: `/organizations/:orgId/${INSIGHTS_BASE_URL}/${AGENTS_LANDING_SUB_PATH}/`,
      },
    ],
  };

  const moduleUrlToModule: Record<string, ModuleName> = Object.fromEntries(
    Object.values(ModuleName).map(name => [MODULE_BASE_URLS[name], name])
  );

  const insightsRedirectObjects: SentryRouteObject[] = Object.values(MODULE_BASE_URLS)
    .map(moduleBaseURL =>
      moduleBaseURL
        ? {
            path: `${moduleBaseURL}/*`,
            redirectTo: `/${DOMAIN_VIEW_BASE_URL}/${getModuleView(moduleUrlToModule[moduleBaseURL]!)}${moduleBaseURL}/:splat`,
          }
        : null
    )
    .filter(route => route !== null);

  const transactionSummaryChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionOverview')
      ),
      deprecatedRouteProps: true,
    },
    traceView,
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
      deprecatedRouteProps: true,
    },
    {
      path: 'tags/',
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionTags')
      ),
      deprecatedRouteProps: true,
    },
    {
      path: 'events/',
      component: make(
        () => import('sentry/views/performance/transactionSummary/transactionEvents')
      ),
      deprecatedRouteProps: true,
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
          deprecatedRouteProps: true,
        },
        {
          path: ':spanSlug/',
          component: make(
            () =>
              import(
                'sentry/views/performance/transactionSummary/transactionSpans/spanDetails'
              )
          ),
          deprecatedRouteProps: true,
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
          deprecatedRouteProps: true,
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
      children: transactionSummaryChildren,
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
          children: transactionSummaryChildren,
        },
        traceView,
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
          children: transactionSummaryChildren,
        },
        traceView,
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
          children: transactionSummaryChildren,
        },
        traceView,
        ...moduleRoutes,
      ],
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
          children: transactionSummaryChildren,
        },
        traceView,
        ...moduleRoutes,
      ],
    },
    {
      path: 'projects/',
      component: make(() => import('sentry/views/projects/')),
      children: projectsChildren,
      deprecatedRouteProps: true,
    },
    {
      path: `${FRONTEND_LANDING_SUB_PATH}/uptime/`,
      redirectTo: '/insights/uptime/',
    },
    {
      path: `${BACKEND_LANDING_SUB_PATH}/uptime/`,
      redirectTo: '/insights/uptime/',
    },
    {
      path: `${BACKEND_LANDING_SUB_PATH}/crons/`,
      redirectTo: '/insights/crons/',
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

  const domainViewRoutes: SentryRouteObject = {
    path: `/${DOMAIN_VIEW_BASE_URL}/`,
    withOrgPath: true,
    children: domainViewChildRoutes,
  };

  const performanceChildren: SentryRouteObject[] = [
    {
      index: true,
      redirectTo: '/insights/frontend/',
    },
    {
      path: 'summary/',
      children: transactionSummaryChildren,
    },
    {
      path: 'vitaldetail/',
      component: make(() => import('sentry/views/performance/vitalDetail')),
      deprecatedRouteProps: true,
    },
    traceView,
    ...insightsRedirectObjects,
    {
      path: 'browser/resources',
      redirectTo: `/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.RESOURCE]}/`,
    },
    {
      path: 'browser/assets',
      redirectTo: `/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.RESOURCE]}/`,
    },
    {
      path: 'browser/pageloads',
      redirectTo: `/${INSIGHTS_BASE_URL}/${MODULE_BASE_URLS[ModuleName.VITAL]}/`,
    },
    {
      path: ':eventSlug/',
      component: make(() => import('sentry/views/performance/transactionDetails')),
      deprecatedRouteProps: true,
    },
  ];
  const performanceRoutes: SentryRouteObject = {
    path: '/performance/',
    component: make(() => import('sentry/views/performance')),
    withOrgPath: true,
    children: performanceChildren,
    deprecatedRouteProps: true,
  };

  const tracesChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/traces/content')),
    },
    traceView,
    {
      path: 'compare/',
      component: make(() => import('sentry/views/explore/multiQueryMode')),
    },
  ];
  const tracesRoutes: SentryRouteObject = {
    path: '/traces/',
    component: make(() => import('sentry/views/traces')),
    withOrgPath: true,
    children: tracesChildren,
    deprecatedRouteProps: true,
  };

  const logsChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/explore/logs/content')),
    },
    traceView,
  ];

  const profilingChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/profiling/content')),
      deprecatedRouteProps: true,
    },
    {
      path: 'summary/:projectId/',
      component: make(() => import('sentry/views/profiling/profileSummary')),
      deprecatedRouteProps: true,
    },
    {
      path: 'profile/:projectId/differential-flamegraph/',
      component: make(() => import('sentry/views/profiling/differentialFlamegraph')),
    },
    traceView,
    {
      path: 'profile/:projectId/',
      component: make(() => import('sentry/views/profiling/continuousProfileProvider')),
      deprecatedRouteProps: true,
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
      deprecatedRouteProps: true,
      children: [
        {
          path: 'flamegraph/',
          component: make(() => import('sentry/views/profiling/profileFlamechart')),
        },
      ],
    },
  ];
  const profilingRoutes: SentryRouteObject = {
    path: '/profiling/',
    component: make(() => import('sentry/views/profiling')),
    withOrgPath: true,
    children: profilingChildren,
    deprecatedRouteProps: true,
  };

  const exploreChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/explore/indexRedirect')),
      deprecatedRouteProps: true,
    },
    {
      path: 'profiling/',
      component: make(() => import('sentry/views/profiling')),
      children: profilingChildren,
      deprecatedRouteProps: true,
    },
    {
      path: 'traces/',
      component: make(() => import('sentry/views/traces')),
      children: tracesChildren,
      deprecatedRouteProps: true,
    },
    {
      path: 'replays/',
      component: make(() => import('sentry/views/replays/index')),
      children: replayChildren,
      deprecatedRouteProps: true,
    },
    {
      path: 'discover/',
      component: make(() => import('sentry/views/discover')),
      children: discoverChildren,
      deprecatedRouteProps: true,
    },
    {
      path: 'releases/',
      component: make(() => import('sentry/views/releases/index')),
      children: releaseChildren,
      deprecatedRouteProps: true,
    },
    {
      path: 'logs/',
      component: make(() => import('sentry/views/explore/logs')),
      children: logsChildren,
      deprecatedRouteProps: true,
    },
    {
      path: 'saved-queries/',
      component: make(() => import('sentry/views/explore/savedQueries')),
      deprecatedRouteProps: true,
    },
  ];
  const exploreRoutes: SentryRouteObject = {
    path: '/explore/',
    withOrgPath: true,
    children: exploreChildren,
  };

  // This is a layout route that will render a header for a commit
  const codecovCommitRoutes: SentryRouteObject = {
    path: 'commits/:sha/',
    component: make(() => import('sentry/views/codecov/coverage/commits/commitWrapper')),
    children: [
      {
        index: true,
        component: make(
          () => import('sentry/views/codecov/coverage/commits/commitDetail')
        ),
      },
      {
        path: 'history/',
        component: make(
          () => import('sentry/views/codecov/coverage/commits/commitHistory')
        ),
      },
      {
        path: 'yaml/',
        component: make(() => import('sentry/views/codecov/coverage/commits/commitYaml')),
      },
    ],
  };

  // This is a layout route that will render a header for a pull request
  const codecovPRRoutes: SentryRouteObject = {
    path: 'pulls/:pullId/',
    component: make(() => import('sentry/views/codecov/coverage/pulls/pullWrapper')),
    children: [
      {
        index: true,
        component: make(() => import('sentry/views/codecov/coverage/pulls/pullDetail')),
      },
    ],
  };

  const codecovChildren: SentryRouteObject[] = [
    {
      path: 'coverage/',
      children: [
        // This is a layout route that will render a header for coverage
        {
          component: make(() => import('sentry/views/codecov/coverage/coverageWrapper')),
          children: [
            {
              path: 'file-explorer/',
              component: make(() => import('sentry/views/codecov/coverage/coverage')),
            },
            {
              path: 'commits/',
              component: make(() => import('sentry/views/codecov/coverage/commits')),
            },
            {
              path: 'pulls/',
              component: make(() => import('sentry/views/codecov/coverage/pulls')),
            },
            {
              path: 'coverage-trend/',
              component: make(
                () => import('sentry/views/codecov/coverage/coverageTrend')
              ),
            },
          ],
        },
        // Render coverage onboarding without any layout wrapping
        {
          path: 'new/',
          component: make(() => import('sentry/views/codecov/coverage/onboarding')),
        },
        codecovCommitRoutes,
        codecovPRRoutes,
      ],
    },
    {
      path: 'tests/',
      children: [
        // Render tests page with layout wrapper
        {
          component: make(() => import('sentry/views/codecov/tests/testsWrapper')),
          children: [
            {
              index: true,
              component: make(() => import('sentry/views/codecov/tests/tests')),
            },
          ],
        },
        // Render tests onboarding with layout wrapper
        {
          path: 'new/',
          component: make(() => import('sentry/views/codecov/tests/testsWrapper')),
          children: [
            {
              index: true,
              component: make(() => import('sentry/views/codecov/tests/onboarding')),
            },
          ],
        },
      ],
    },
    {
      path: 'prevent-ai/',
      children: [
        // Render prevent AI onboarding with layout wrapper
        {
          path: 'new/',
          component: make(() => import('sentry/views/codecov/preventAI/wrapper')),
          children: [
            {
              index: true,
              component: make(() => import('sentry/views/codecov/preventAI/onboarding')),
            },
          ],
        },
      ],
    },
    {
      path: 'tokens/',
      children: [
        {
          component: make(() => import('sentry/views/codecov/tokens/tokensWrapper')),
          children: [
            {
              index: true,
              component: make(() => import('sentry/views/codecov/tokens/tokens')),
            },
          ],
        },
      ],
    },
  ];
  const codecovRoutes: SentryRouteObject = {
    path: '/codecov/',
    withOrgPath: true,
    component: make(() => import('sentry/views/codecov/index')),
    children: codecovChildren,
    deprecatedRouteProps: true,
  };

  const preprodChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/preprod/buildDetails')),
      deprecatedRouteProps: true,
    },
  ];
  const preprodRoutes: SentryRouteObject = {
    path: '/preprod/:projectId/:artifactId/',
    component: make(() => import('sentry/views/preprod/index')),
    withOrgPath: true,
    children: preprodChildren,
    deprecatedRouteProps: true,
  };

  const feedbackV2Children: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/feedback/feedbackListPage')),
    },
    traceView,
  ];
  const feedbackv2Routes: SentryRouteObject = {
    path: '/feedback/',
    component: make(() => import('sentry/views/feedback/index')),
    withOrgPath: true,
    children: feedbackV2Children,
    deprecatedRouteProps: true,
  };

  const issueTabs: SentryRouteObject[] = [
    {
      index: true,
      component: make(
        () => import('sentry/views/issueDetails/groupEventDetails/groupEventDetails'),
        <GroupEventDetailsLoading />
      ),
    },
    {
      path: TabPaths[Tab.REPLAYS],
      component: make(() => import('sentry/views/issueDetails/groupReplays')),
    },
    {
      path: TabPaths[Tab.ACTIVITY],
      component: make(() => import('sentry/views/issueDetails/groupActivity')),
    },
    {
      path: TabPaths[Tab.EVENTS],
      component: make(() => import('sentry/views/issueDetails/groupEvents')),
    },
    {
      path: TabPaths[Tab.OPEN_PERIODS],
      component: make(() => import('sentry/views/issueDetails/groupOpenPeriods')),
    },
    {
      path: TabPaths[Tab.UPTIME_CHECKS],
      component: make(() => import('sentry/views/issueDetails/groupUptimeChecks')),
    },
    {
      path: TabPaths[Tab.CHECK_INS],
      component: make(() => import('sentry/views/issueDetails/groupCheckIns')),
    },
    {
      path: TabPaths[Tab.DISTRIBUTIONS],
      component: make(() => import('sentry/views/issueDetails/groupTags/groupTagsTab')),
    },
    {
      path: `${TabPaths[Tab.DISTRIBUTIONS]}:tagKey/`,
      component: make(() => import('sentry/views/issueDetails/groupTags/groupTagValues')),
    },
    {
      path: TabPaths[Tab.USER_FEEDBACK],
      component: make(() => import('sentry/views/issueDetails/groupUserFeedback')),
    },
    {
      path: TabPaths[Tab.ATTACHMENTS],
      component: make(() => import('sentry/views/issueDetails/groupEventAttachments')),
    },
    {
      path: TabPaths[Tab.SIMILAR_ISSUES],
      component: make(
        () => import('sentry/views/issueDetails/groupSimilarIssues/groupSimilarIssuesTab')
      ),
    },
    {
      path: TabPaths[Tab.MERGED],
      component: make(
        () => import('sentry/views/issueDetails/groupMerged/groupMergedTab')
      ),
    },
  ];

  const issueChildren: SentryRouteObject[] = [
    {
      index: true,
      component: errorHandler(OverviewWrapper),
      deprecatedRouteProps: true,
    },
    {
      path: `${IssueTaxonomy.ERRORS_AND_OUTAGES}/`,
      component: make(() => import('sentry/views/issueList/pages/errorsOutages')),
      deprecatedRouteProps: true,
    },
    {
      path: `${IssueTaxonomy.BREACHED_METRICS}/`,
      component: make(() => import('sentry/views/issueList/pages/breachedMetrics')),
      deprecatedRouteProps: true,
    },
    {
      path: `${IssueTaxonomy.WARNINGS}/`,
      component: make(() => import('sentry/views/issueList/pages/warnings')),
      deprecatedRouteProps: true,
    },
    {
      path: 'views/',
      component: make(
        () => import('sentry/views/issueList/issueViews/issueViewsList/issueViewsList')
      ),
      deprecatedRouteProps: true,
    },
    {
      path: 'views/:viewId/',
      component: errorHandler(OverviewWrapper),
      deprecatedRouteProps: true,
    },
    {
      path: 'searches/:searchId/',
      component: errorHandler(OverviewWrapper),
      deprecatedRouteProps: true,
    },
    // Redirects for legacy tags route.
    {
      path: ':groupId/tags/',
      redirectTo: `/issues/:groupId/${TabPaths[Tab.DISTRIBUTIONS]}`,
    },
    {
      path: ':groupId/tags/:tagKey/',
      redirectTo: `/issues/:groupId/${TabPaths[Tab.DISTRIBUTIONS]}:tagKey/`,
    },
    {
      path: `:groupId/${TabPaths[Tab.EVENTS]}:eventId/tags/`,
      redirectTo: `/issues/:groupId/${TabPaths[Tab.EVENTS]}:eventId/${TabPaths[Tab.DISTRIBUTIONS]}`,
    },
    {
      path: `:groupId/${TabPaths[Tab.EVENTS]}:eventId/tags/:tagKey/`,
      redirectTo: `/issues/:groupId/${TabPaths[Tab.EVENTS]}:eventId/${TabPaths[Tab.DISTRIBUTIONS]}:tagKey/`,
    },
    {
      path: ':groupId/',
      component: make(() => import('sentry/views/issueDetails/groupDetails')),
      children: [
        ...issueTabs,
        {
          path: `${TabPaths[Tab.EVENTS]}:eventId/`,
          children: issueTabs,
        },
      ],
    },
    {
      path: 'feedback/',
      component: make(() => import('sentry/views/feedback/index')),
      children: feedbackV2Children,
      deprecatedRouteProps: true,
    },
    {
      path: 'alerts/',
      component: make(() => import('sentry/views/alerts')),
      children: alertChildRoutes(true),
      deprecatedRouteProps: true,
    },
    traceView,
    automationRoutes,
    detectorRoutes,
  ];
  const issueRoutes: SentryRouteObject = {
    path: '/issues/',
    withOrgPath: true,
    children: issueChildren,
  };

  const adminManageChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/admin/adminOverview')),
      deprecatedRouteProps: true,
    },
    {
      path: 'buffer/',
      component: make(() => import('sentry/views/admin/adminBuffer')),
      deprecatedRouteProps: true,
    },
    {
      path: 'relays/',
      component: make(() => import('sentry/views/admin/adminRelays')),
      deprecatedRouteProps: true,
    },
    {
      path: 'organizations/',
      component: make(() => import('sentry/views/admin/adminOrganizations')),
      deprecatedRouteProps: true,
    },
    {
      path: 'projects/',
      component: make(() => import('sentry/views/admin/adminProjects')),
      deprecatedRouteProps: true,
    },
    {
      path: 'queue/',
      component: make(() => import('sentry/views/admin/adminQueue')),
      deprecatedRouteProps: true,
    },
    {
      path: 'quotas/',
      component: make(() => import('sentry/views/admin/adminQuotas')),
      deprecatedRouteProps: true,
    },
    {
      path: 'settings/',
      component: make(() => import('sentry/views/admin/adminSettings')),
      deprecatedRouteProps: true,
    },
    {
      path: 'users/',
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/admin/adminUsers')),
          deprecatedRouteProps: true,
        },
        {
          path: ':id',
          component: make(() => import('sentry/views/admin/adminUserEdit')),
          deprecatedRouteProps: true,
        },
      ],
    },
    {
      path: 'status/mail/',
      component: make(() => import('sentry/views/admin/adminMail')),
      deprecatedRouteProps: true,
    },
    {
      path: 'status/environment/',
      component: make(() => import('sentry/views/admin/adminEnvironment')),
      deprecatedRouteProps: true,
    },
    {
      path: 'status/packages/',
      component: make(() => import('sentry/views/admin/adminPackages')),
      deprecatedRouteProps: true,
    },
    {
      path: 'status/warnings/',
      component: make(() => import('sentry/views/admin/adminWarnings')),
      deprecatedRouteProps: true,
    },
  ];

  // These are the "manage" pages. For sentry.io, these are _different_ from
  // the SaaS admin routes in getsentry.
  const adminManageRoutes: SentryRouteObject = {
    path: '/manage/',
    component: make(() => import('sentry/views/admin/adminLayout')),
    children: adminManageChildren,
    deprecatedRouteProps: true,
  };

  const legacyOrganizationRootChildren: SentryRouteObject[] = [
    {
      path: '/organizations/:orgId/teams/new/',
      redirectTo: '/settings/:orgId/teams/',
    },
    {
      path: '/organizations/:orgId/',
      children: [
        routeHook('routes:legacy-organization-redirects'),
        {
          index: true,
          redirectTo: 'issues/',
        },
        {
          path: 'teams/',
          redirectTo: '/settings/:orgId/teams/',
        },
        {
          path: 'teams/your-teams/',
          redirectTo: '/settings/:orgId/teams/',
        },
        {
          path: 'teams/all-teams/',
          redirectTo: '/settings/:orgId/teams/',
        },
        {
          path: 'teams/:teamId/',
          redirectTo: '/settings/:orgId/teams/:teamId/',
        },
        {
          path: 'teams/:teamId/members/',
          redirectTo: '/settings/:orgId/teams/:teamId/members/',
        },
        {
          path: 'teams/:teamId/projects/',
          redirectTo: '/settings/:orgId/teams/:teamId/projects/',
        },
        {
          path: 'teams/:teamId/settings/',
          redirectTo: '/settings/:orgId/teams/:teamId/settings/',
        },
        {
          path: 'settings/',
          redirectTo: '/settings/:orgId/',
        },
        {
          path: 'api-keys/',
          redirectTo: '/settings/:orgId/api-keys/',
        },
        {
          path: 'api-keys/:apiKey/',
          redirectTo: '/settings/:orgId/api-keys/:apiKey/',
        },
        {
          path: 'members/',
          redirectTo: '/settings/:orgId/members/',
        },
        {
          path: 'members/:memberId/',
          redirectTo: '/settings/:orgId/members/:memberId/',
        },
        {
          path: 'rate-limits/',
          redirectTo: '/settings/:orgId/rate-limits/',
        },
        {
          path: 'repos/',
          redirectTo: '/settings/:orgId/repos/',
        },
        {
          path: 'user-feedback/',
          redirectTo: '/organizations/:orgId/feedback/',
        },
      ],
    },
  ];
  const legacyOrganizationRootRoutes: SentryRouteObject = {
    children: legacyOrganizationRootChildren,
  };

  const gettingStartedChildren: SentryRouteObject[] = [
    {
      path: '/getting-started/:projectId/',
      redirectTo: '/projects/:projectId/getting-started/',
      customerDomainOnlyRoute: true,
    },
    {
      path: '/getting-started/:projectId/:platform/',
      redirectTo: '/projects/:projectId/getting-started/',
      customerDomainOnlyRoute: true,
    },
    {
      path: '/:orgId/:projectId/getting-started/',
      redirectTo: '/organizations/:orgId/projects/:projectId/getting-started/',
    },
    {
      path: '/:orgId/:projectId/getting-started/:platform/',
      redirectTo: '/organizations/:orgId/projects/:projectId/getting-started/',
    },
  ];
  const gettingStartedRoutes: SentryRouteObject = {
    children: gettingStartedChildren,
  };

  // Support for deprecated URLs (pre-Sentry 10). We just redirect users to new
  // canonical URLs.
  //
  // XXX(epurkhiser): Can these be moved over to the legacyOrgRedirects routes,
  // or do these need to be nested into the OrganizationLayout tree?
  const legacyOrgRedirectChildren: SentryRouteObject[] = [
    {
      index: true,
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId}) => `/organizations/${orgId}/issues/?project=${projectId}`
        )
      ),
      deprecatedRouteProps: true,
    },
    {
      path: 'issues/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId}) => `/organizations/${orgId}/issues/?project=${projectId}`
        )
      ),
      deprecatedRouteProps: true,
    },
    {
      path: 'dashboard/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId}) =>
            `/organizations/${orgId}/dashboards/?project=${projectId}`
        )
      ),
      deprecatedRouteProps: true,
    },
    {
      path: 'user-feedback/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId}) => `/organizations/${orgId}/feedback/?project=${projectId}`
        )
      ),
      deprecatedRouteProps: true,
    },
    {
      path: 'releases/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId}) => `/organizations/${orgId}/releases/?project=${projectId}`
        )
      ),
      deprecatedRouteProps: true,
    },
    {
      path: 'releases/:version/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId, router}) =>
            `/organizations/${orgId}/releases/${router.params.version}/?project=${projectId}`
        )
      ),
      deprecatedRouteProps: true,
    },
    {
      path: 'releases/:version/new-events/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId, router}) =>
            `/organizations/${orgId}/releases/${router.params.version}/new-events/?project=${projectId}`
        )
      ),
      deprecatedRouteProps: true,
    },
    {
      path: 'releases/:version/all-events/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId, router}) =>
            `/organizations/${orgId}/releases/${router.params.version}/all-events/?project=${projectId}`
        )
      ),
      deprecatedRouteProps: true,
    },
    {
      path: 'releases/:version/commits/',
      component: errorHandler(
        redirectDeprecatedProjectRoute(
          ({orgId, projectId, router}) =>
            `/organizations/${orgId}/releases/${router.params.version}/commits/?project=${projectId}`
        )
      ),
      deprecatedRouteProps: true,
    },
  ];
  const legacyOrgRedirects: SentryRouteObject = {
    path: '/:orgId/:projectId/',
    children: legacyOrgRedirectChildren,
  };

  const organizationRoutes: SentryRouteObject = {
    component: errorHandler(OrganizationLayout),
    children: [
      settingsRoutes,
      projectsRoutes,
      dashboardRoutes,
      feedbackv2Routes,
      issueRoutes,
      alertRoutes,
      codecovRoutes,
      preprodRoutes,
      replayRoutes,
      releasesRoutes,
      statsRoutes,
      discoverRoutes,
      performanceRoutes,
      domainViewRoutes,
      tracesRoutes,
      exploreRoutes,
      llmMonitoringRedirects,
      profilingRoutes,
      gettingStartedRoutes,
      adminManageRoutes,
      legacyOrganizationRootRoutes,
      legacyOrgRedirects,
    ],
    deprecatedRouteProps: true,
  };

  const legacyRedirectRoutes: SentryRouteObject = {
    path: '/:orgId/',
    children: [
      {
        index: true,
        redirectTo: '/organizations/:orgId/',
      },
      {
        path: ':projectId/settings/',
        children: [
          {
            path: 'teams/',
            redirectTo: '/settings/:orgId/projects/:projectId/teams/',
          },
          {
            path: 'alerts/',
            redirectTo: '/settings/:orgId/projects/:projectId/alerts/',
          },
          {
            path: 'alerts/rules/',
            redirectTo: '/settings/:orgId/projects/:projectId/alerts/rules/',
          },
          {
            path: 'alerts/rules/new/',
            redirectTo: '/settings/:orgId/projects/:projectId/alerts/rules/new/',
          },
          {
            path: 'alerts/rules/:ruleId/',
            redirectTo: '/settings/:orgId/projects/:projectId/alerts/rules/:ruleId/',
          },
          {
            path: 'environments/',
            redirectTo: '/settings/:orgId/projects/:projectId/environments/',
          },
          {
            path: 'environments/hidden/',
            redirectTo: '/settings/:orgId/projects/:projectId/environments/hidden/',
          },
          {
            path: 'tags/',
            redirectTo: '/settings/projects/:orgId/projects/:projectId/tags/',
          },
          {
            path: 'issue-tracking/',
            redirectTo: '/settings/:orgId/projects/:projectId/issue-tracking/',
          },
          {
            path: 'release-tracking/',
            redirectTo: '/settings/:orgId/projects/:projectId/release-tracking/',
          },
          {
            path: 'ownership/',
            redirectTo: '/settings/:orgId/projects/:projectId/ownership/',
          },
          {
            path: 'data-forwarding/',
            redirectTo: '/settings/:orgId/projects/:projectId/data-forwarding/',
          },
          {
            path: 'debug-symbols/',
            redirectTo: '/settings/:orgId/projects/:projectId/debug-symbols/',
          },
          {
            path: 'filters/',
            redirectTo: '/settings/:orgId/projects/:projectId/filters/',
          },
          {
            path: 'hooks/',
            redirectTo: '/settings/:orgId/projects/:projectId/hooks/',
          },
          {
            path: 'keys/',
            redirectTo: '/settings/:orgId/projects/:projectId/keys/',
          },
          {
            path: 'keys/:keyId/',
            redirectTo: '/settings/:orgId/projects/:projectId/keys/:keyId/',
          },
          {
            path: 'user-feedback/',
            redirectTo: '/settings/:orgId/projects/:projectId/user-feedback/',
          },
          {
            path: 'security-headers/',
            redirectTo: '/settings/:orgId/projects/:projectId/security-headers/',
          },
          {
            path: 'security-headers/csp/',
            redirectTo: '/settings/:orgId/projects/:projectId/security-headers/csp/',
          },
          {
            path: 'security-headers/expect-ct/',
            redirectTo:
              '/settings/:orgId/projects/:projectId/security-headers/expect-ct/',
          },
          {
            path: 'security-headers/hpkp/',
            redirectTo: '/settings/:orgId/projects/:projectId/security-headers/hpkp/',
          },
          {
            path: 'plugins/',
            redirectTo: '/settings/:orgId/projects/:projectId/plugins/',
          },
          {
            path: 'plugins/:pluginId/',
            redirectTo: '/settings/:orgId/projects/:projectId/plugins/:pluginId/',
          },
          {
            path: 'integrations/:providerKey/',
            redirectTo: '/settings/:orgId/projects/:projectId/integrations/:providerKey/',
          },
        ],
      },
      {
        path: ':projectId/group/:groupId/',
        redirectTo: 'issues/:groupId/',
      },
      {
        path: ':projectId/issues/:groupId/',
        redirectTo: '/organizations/:orgId/issues/:groupId/',
      },
      {
        path: ':projectId/issues/:groupId/events/',
        redirectTo: '/organizations/:orgId/issues/:groupId/events/',
      },
      {
        path: ':projectId/issues/:groupId/events/:eventId/',
        redirectTo: '/organizations/:orgId/issues/:groupId/events/:eventId/',
      },
      {
        path: ':projectId/issues/:groupId/tags/',
        redirectTo: '/organizations/:orgId/issues/:groupId/tags/',
      },
      {
        path: ':projectId/issues/:groupId/tags/:tagKey/',
        redirectTo: '/organizations/:orgId/issues/:groupId/tags/:tagKey/',
      },
      {
        path: ':projectId/issues/:groupId/feedback/',
        redirectTo: '/organizations/:orgId/issues/:groupId/feedback/',
      },
      {
        path: ':projectId/issues/:groupId/similar/',
        redirectTo: '/organizations/:orgId/issues/:groupId/similar/',
      },
      {
        path: ':projectId/issues/:groupId/merged/',
        redirectTo: '/organizations/:orgId/issues/:groupId/merged/',
      },
      {
        path: ':projectId/events/:eventId/',
        component: errorHandler(ProjectEventRedirect),
        deprecatedRouteProps: true,
      },
    ],
  };

  const appRoutes: SentryRouteObject = {
    component: ProvideAriaRouter,
    deprecatedRouteProps: true,
    children: [
      experimentalSpaRoutes,
      {
        path: '/',
        component: errorHandler(App),
        deprecatedRouteProps: true,
        children: [
          rootRoutes,
          authV2Routes,
          organizationRoutes,
          legacyRedirectRoutes,
          {path: '*', component: errorHandler(RouteNotFound), deprecatedRouteProps: true},
        ],
      },
    ],
  };

  return [translateSentryRoute(appRoutes)];
}

// We load routes both when initializing the SDK (for routing integrations) and
// when the app renders Main. Memoize to avoid rebuilding the route tree.
export const routes = memoize(buildRoutes);

// Exported for use in tests.
export {buildRoutes};

function NoOp({children}: {children: React.JSX.Element}) {
  return children;
}
