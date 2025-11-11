import type {RouteObject} from 'react-router-dom';
import memoize from 'lodash/memoize';

import {EXPERIMENTAL_SPA} from 'sentry/constants';
import {t} from 'sentry/locale';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import {ScrapsProviders} from 'sentry/scrapsProviders';
import HookStore from 'sentry/stores/hookStore';
import type {HookName} from 'sentry/types/hooks';
import errorHandler from 'sentry/utils/errorHandler';
import {ProvideAriaRouter} from 'sentry/utils/provideAriaRouter';
import {translateSentryRoute} from 'sentry/utils/reactRouter6Compat/router';
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
import {MCP_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mcp/settings';
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
import TransactionSummaryTab from 'sentry/views/performance/transactionSummary/tabs';
import ProjectEventRedirect from 'sentry/views/projectEventRedirect';
import redirectDeprecatedProjectRoute from 'sentry/views/projects/redirectDeprecatedProjectRoute';
import RouteNotFound from 'sentry/views/routeNotFound';
import SettingsWrapper from 'sentry/views/settings/components/settingsWrapper';

import {type SentryRouteObject} from './types';

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
    },
    {
      path: '/organizations/:orgId/share/issue/:shareId/',
      component: make(() => import('sentry/views/sharedGroupDetails')),
    },
    {
      path: '/unsubscribe/project/:id/',
      component: make(() => import('sentry/views/unsubscribe/project')),
      customerDomainOnlyRoute: true,
    },
    {
      path: '/unsubscribe/:orgId/project/:id/',
      component: make(() => import('sentry/views/unsubscribe/project')),
    },
    {
      path: '/unsubscribe/issue/:id/',
      component: make(() => import('sentry/views/unsubscribe/issue')),
      customerDomainOnlyRoute: true,
    },
    {
      path: '/unsubscribe/:orgId/issue/:id/',
      component: make(() => import('sentry/views/unsubscribe/issue')),
    },
    {
      path: '/organizations/new/',
      component: make(() => import('sentry/views/organizationCreate')),
    },
    {
      path: '/data-export/:dataExportId',
      component: make(() => import('sentry/views/dataExport/dataDownload')),
      withOrgPath: true,
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
    },
    {
      path: '/organizations/:orgId/restore/',
      component: make(() => import('sentry/views/organizationRestore')),
    },
    {
      path: '/join-request/',
      component: withDomainRequired(
        make(() => import('sentry/views/organizationJoinRequest'))
      ),
      customerDomainOnlyRoute: true,
    },
    {
      path: '/join-request/:orgId/',
      component: withDomainRedirect(
        make(() => import('sentry/views/organizationJoinRequest'))
      ),
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
      path: '/debug/notifications/:notificationSource?/',
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
          children: [
            {
              index: true,
              component: make(
                () => import('sentry/views/settings/account/accountSecurity')
              ),
            },
            {
              path: 'session-history/',
              name: t('Session History'),
              component: make(
                () =>
                  import('sentry/views/settings/account/accountSecurity/sessionHistory')
              ),
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
            },
            {
              path: ':appId/',
              name: t('Details'),
              component: make(
                () => import('sentry/views/settings/account/apiApplications/details')
              ),
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
      path: 'tags/',
      name: t('Tags & Context'),
      component: make(() => import('sentry/views/settings/projectTags')),
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
      path: 'toolbar/',
      name: t('Developer Toolbar'),
      component: make(() => import('sentry/views/settings/project/projectToolbar')),
    },
    {
      path: 'filters/',
      name: t('Inbound Filters'),
      component: make(() => import('sentry/views/settings/project/projectFilters')),
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
      path: 'issue-grouping/',
      name: t('Issue Grouping'),
      component: make(() => import('sentry/views/settings/projectIssueGrouping')),
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
          redirectTo: 'source-maps/',
        },
        {
          path: 'source-maps/release-bundles/',
          redirectTo: 'source-maps/',
        },
      ],
    },
    {
      path: 'performance/',
      name: t('Performance'),
      component: make(() => import('sentry/views/settings/projectPerformance')),
    },
    {
      path: 'dynamic-sampling/',
      redirectTo: 'performance/',
    },
    {
      path: 'replays/',
      name: t('Replays'),
      component: make(() => import('sentry/views/settings/project/projectReplays')),
    },
    {
      path: 'playstation/',
      name: t('PlayStation'),
      component: make(() => import('sentry/views/settings/project/tempest')),
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
      path: 'release-tracking/',
      name: t('Release Tracking'),
      component: make(
        () => import('sentry/views/settings/project/projectReleaseTracking')
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
      path: 'csp/',
      redirectTo: '/settings/:orgId/projects/:projectId/security-headers/csp/',
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
    {
      path: 'issue-tracking/',
      redirectTo: '/settings/:orgId/:projectId/plugins/',
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
  ];
  const projectSettingsRoutes: SentryRouteObject = {
    path: 'projects/:projectId/',
    name: t('Project'),
    component: make(() => import('sentry/views/settings/project/projectSettingsLayout')),
    children: projectSettingsChildren,
  };

  const statsChildren: SentryRouteObject[] = [
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
  const statsRoutes: SentryRouteObject = {
    children: [
      {
        path: '/stats/',
        withOrgPath: true,
        component: OrganizationStatsWrapper,
        children: statsChildren,
      },
      {
        path: '/organizations/:orgId/stats/team/',
        redirectTo: '/organizations/:orgId/stats/issues/',
      },
    ],
  };

  const orgSettingsChildren: SentryRouteObject[] = [
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
        },
        {
          path: ':teamId/',
          name: t('Team'),
          component: make(
            () => import('sentry/views/settings/organizationTeams/teamDetails')
          ),
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
            },
            {
              path: 'settings/',
              name: t('Settings'),
              component: make(
                () => import('sentry/views/settings/organizationTeams/teamSettings')
              ),
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
    {
      path: 'data-forwarding/',
      name: t('Data Forwarding'),
      component: make(() => import('sentry/views/settings/organizationDataForwarding')),
    },
  ];
  const orgSettingsRoutes: SentryRouteObject = {
    component: make(
      () => import('sentry/views/settings/organization/organizationSettingsLayout')
    ),
    children: orgSettingsChildren,
    deprecatedRouteProps: true,
  };

  const subscriptionSettingsRoutes = routeHook('routes:subscription-settings');

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
      },
      accountSettingsRoutes,
      {
        name: t('Organization'),
        component: withDomainRequired(NoOp),
        customerDomainOnlyRoute: true,
        children: [orgSettingsRoutes, projectSettingsRoutes, subscriptionSettingsRoutes],
        deprecatedRouteProps: true,
      },
      {
        path: ':orgId/',
        name: t('Organization'),
        component: withDomainRedirect(NoOp),
        children: [
          orgSettingsRoutes,
          projectSettingsRoutes,
          subscriptionSettingsRoutes,
          legacySettingsRedirects,
        ],
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
    component: make(() => import('sentry/views/performance/newTraceDetails/index')),
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
              path: ':projectId/:detectorId/details/',
              component: make(() => import('sentry/views/alerts/rules/uptime/details')),
            },
            {
              path: 'existing-or-create/',
              component: make(
                () => import('sentry/views/alerts/rules/uptime/existingOrCreate')
              ),
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

  const monitorRoutes: SentryRouteObject = {
    path: '/monitors/',
    withOrgPath: true,
    component: make(() => import('sentry/views/detectors/detectorViewContainer')),
    children: [
      ...detectorRoutes.children!,
      automationRoutes,
      {
        path: 'my-monitors/',
        component: make(() => import('sentry/views/detectors/list/myMonitors')),
      },
      {
        path: 'errors/',
        component: make(() => import('sentry/views/detectors/list/error')),
      },
      {
        path: 'metrics/',
        component: make(() => import('sentry/views/detectors/list/metric')),
      },
      {
        path: 'crons/',
        component: make(() => import('sentry/views/detectors/list/cron')),
      },
      {
        path: 'uptime/',
        component: make(() => import('sentry/views/detectors/list/uptime')),
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
      redirectTo: '/replays/',
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
        {
          path: 'builds/',
          component: make(
            () => import('sentry/views/releases/detail/commitsAndFiles/preprodBuilds')
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

  const transactionSummaryRoute: SentryRouteObject = {
    path: 'summary/',
    children: [
      traceView,
      {
        component: make(
          () => import('sentry/views/performance/transactionSummary/layout')
        ),
        children: [
          {
            index: true,
            handle: {tab: TransactionSummaryTab.TRANSACTION_SUMMARY},
            component: make(
              () =>
                import('sentry/views/performance/transactionSummary/transactionOverview')
            ),
          },
          {
            path: 'replays/',
            handle: {tab: TransactionSummaryTab.REPLAYS},
            component: make(
              () =>
                import('sentry/views/performance/transactionSummary/transactionReplays')
            ),
          },
          {
            path: 'vitals/',
            handle: {tab: TransactionSummaryTab.WEB_VITALS},
            component: make(
              () =>
                import('sentry/views/performance/transactionSummary/transactionVitals')
            ),
          },
          {
            path: 'tags/',
            handle: {tab: TransactionSummaryTab.TAGS},
            component: make(
              () => import('sentry/views/performance/transactionSummary/transactionTags')
            ),
          },
          {
            path: 'events/',
            handle: {tab: TransactionSummaryTab.EVENTS},
            component: make(
              () =>
                import('sentry/views/performance/transactionSummary/transactionEvents')
            ),
          },
          {
            path: 'profiles/',
            handle: {tab: TransactionSummaryTab.PROFILING},
            component: make(
              () =>
                import('sentry/views/performance/transactionSummary/transactionProfiles')
            ),
          },
        ],
      },
    ],
  };

  const moduleRoutes: SentryRouteObject[] = [
    {
      path: `${MODULE_BASE_URLS[ModuleName.HTTP]}/`,
      children: [
        {
          index: true,
          handle: {module: ModuleName.HTTP},
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
          handle: {module: ModuleName.VITAL},
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
          handle: {module: ModuleName.RESOURCE},
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
          handle: {module: ModuleName.DB},
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
          handle: {module: ModuleName.CACHE},
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
          handle: {module: ModuleName.QUEUE},
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
          handle: {module: ModuleName.MOBILE_VITALS},
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
          handle: {module: ModuleName.SESSIONS},
          index: true,
          component: make(() => import('sentry/views/insights/sessions/views/overview')),
        },
      ],
    },
  ];

  const domainViewChildRoutes: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/insights/index')),
    },
    transactionSummaryRoute,
    {
      path: `${FRONTEND_LANDING_SUB_PATH}/`,
      component: make(() => import('sentry/views/insights/pages/frontend/layout')),
      children: [
        {
          index: true,
          handle: {module: undefined},
          component: make(
            () => import('sentry/views/insights/pages/frontend/frontendOverviewPage')
          ),
        },
        transactionSummaryRoute,
        traceView,
        ...moduleRoutes,
      ],
    },
    {
      path: `${BACKEND_LANDING_SUB_PATH}/`,
      component: make(() => import('sentry/views/insights/pages/backend/layout')),
      children: [
        {
          index: true,
          handle: {module: undefined},
          component: make(
            () => import('sentry/views/insights/pages/backend/backendOverviewPage')
          ),
        },
        transactionSummaryRoute,
        traceView,
        ...moduleRoutes,
      ],
    },
    {
      path: `${MOBILE_LANDING_SUB_PATH}/`,
      component: make(() => import('sentry/views/insights/pages/mobile/layout')),
      children: [
        {
          index: true,
          handle: {module: undefined},
          component: make(
            () => import('sentry/views/insights/pages/mobile/mobileOverviewPage')
          ),
        },
        transactionSummaryRoute,
        traceView,
        ...moduleRoutes,
      ],
    },
    // Redirect old links to the new mcp landing page
    {
      path: `ai/mcp/`,
      redirectTo: `/${DOMAIN_VIEW_BASE_URL}/${MCP_LANDING_SUB_PATH}/`,
    },
    {
      path: `${MCP_LANDING_SUB_PATH}/`,
      component: make(() => import('sentry/views/insights/pages/mcp/layout')),
      children: [
        {
          index: true,
          handle: {module: undefined},
          component: make(() => import('sentry/views/insights/pages/mcp/overview')),
        },
        transactionSummaryRoute,
        traceView,
        {
          path: `${MODULE_BASE_URLS[ModuleName.MCP_TOOLS]}/`,
          children: [
            {
              index: true,
              handle: {module: ModuleName.MCP_TOOLS},
              component: make(
                () => import('sentry/views/insights/mcp-tools/views/mcpToolsLandingPage')
              ),
            },
          ],
        },
        {
          path: `${MODULE_BASE_URLS[ModuleName.MCP_RESOURCES]}/`,
          children: [
            {
              index: true,
              handle: {module: ModuleName.MCP_RESOURCES},
              component: make(
                () =>
                  import(
                    'sentry/views/insights/mcp-resources/views/mcpResourcesLandingPage'
                  )
              ),
            },
          ],
        },
        {
          path: `${MODULE_BASE_URLS[ModuleName.MCP_PROMPTS]}/`,
          children: [
            {
              index: true,
              handle: {module: ModuleName.MCP_PROMPTS},
              component: make(
                () =>
                  import('sentry/views/insights/mcp-prompts/views/mcpPromptsLandingPage')
              ),
            },
          ],
        },
      ],
    },
    // Redirect old links to the new agents landing page
    {
      path: `ai/*`,
      redirectTo: `/${DOMAIN_VIEW_BASE_URL}/${AGENTS_LANDING_SUB_PATH}/`,
    },
    {
      path: `${AGENTS_LANDING_SUB_PATH}/`,
      component: make(() => import('sentry/views/insights/pages/agents/layout')),
      children: [
        {
          index: true,
          handle: {module: undefined},
          component: make(() => import('sentry/views/insights/pages/agents/overview')),
        },
        transactionSummaryRoute,
        traceView,
        {
          path: `${MODULE_BASE_URLS[ModuleName.AGENT_MODELS]}/`,
          children: [
            {
              index: true,
              handle: {module: ModuleName.AGENT_MODELS},
              component: make(
                () => import('sentry/views/insights/agentModels/views/modelsLandingPage')
              ),
            },
          ],
        },
        {
          path: `${MODULE_BASE_URLS[ModuleName.AGENT_TOOLS]}/`,
          children: [
            {
              index: true,
              handle: {module: ModuleName.AGENT_TOOLS},
              component: make(
                () => import('sentry/views/insights/agentTools/views/toolsLandingPage')
              ),
            },
          ],
        },
        {
          path: `${MODULE_BASE_URLS[ModuleName.AI_GENERATIONS]}/`,
          children: [
            {
              index: true,
              handle: {module: ModuleName.AI_GENERATIONS},
              component: make(
                () => import('sentry/views/insights/aiGenerations/views/overview')
              ),
            },
          ],
        },
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
    transactionSummaryRoute,
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
  ];
  const performanceRoutes: SentryRouteObject = {
    path: '/performance/',
    component: make(() => import('sentry/views/performance')),
    withOrgPath: true,
    children: performanceChildren,
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

  const metricsChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/explore/metrics/content')),
    },
    traceView,
  ];

  const profilingChildren: SentryRouteObject[] = [
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
    traceView,
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
  const profilingRoutes: SentryRouteObject = {
    path: '/profiling/',
    component: make(() => import('sentry/views/profiling')),
    withOrgPath: true,
    children: profilingChildren,
  };

  const exploreChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/explore/indexRedirect')),
    },
    {
      path: 'profiling/',
      component: make(() => import('sentry/views/profiling')),
      children: profilingChildren,
    },
    {
      path: 'traces/',
      component: make(() => import('sentry/views/traces')),
      children: tracesChildren,
    },
    {
      path: 'replays/',
      component: make(() => import('sentry/views/replays/index')),
      children: replayChildren,
    },
    {
      path: 'discover/',
      component: make(() => import('sentry/views/discover')),
      children: discoverChildren,
    },
    {
      path: 'releases/',
      component: make(() => import('sentry/views/releases/index')),
      children: releaseChildren,
    },
    {
      path: 'logs/',
      component: make(() => import('sentry/views/explore/logs')),
      children: logsChildren,
    },
    {
      path: 'metrics/',
      component: make(() => import('sentry/views/explore/metrics')),
      children: metricsChildren,
    },
    {
      path: 'saved-queries/',
      component: make(() => import('sentry/views/explore/savedQueries')),
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
    component: make(() => import('sentry/views/prevent/coverage/commits/commitWrapper')),
    children: [
      {
        index: true,
        component: make(
          () => import('sentry/views/prevent/coverage/commits/commitDetail')
        ),
      },
      {
        path: 'history/',
        component: make(
          () => import('sentry/views/prevent/coverage/commits/commitHistory')
        ),
      },
      {
        path: 'yaml/',
        component: make(() => import('sentry/views/prevent/coverage/commits/commitYaml')),
      },
    ],
  };

  // This is a layout route that will render a header for a pull request
  const codecovPRRoutes: SentryRouteObject = {
    path: 'pulls/:pullId/',
    component: make(() => import('sentry/views/prevent/coverage/pulls/pullWrapper')),
    children: [
      {
        index: true,
        component: make(() => import('sentry/views/prevent/coverage/pulls/pullDetail')),
      },
    ],
  };

  const codecovChildren: SentryRouteObject[] = [
    {
      index: true,
      redirectTo: 'ai-code-review/new/',
    },
    {
      path: 'coverage/',
      children: [
        // This is a layout route that will render a header for coverage
        {
          component: make(() => import('sentry/views/prevent/coverage/coverageWrapper')),
          children: [
            {
              path: 'file-explorer/',
              component: make(() => import('sentry/views/prevent/coverage/coverage')),
            },
            {
              path: 'commits/',
              component: make(() => import('sentry/views/prevent/coverage/commits')),
            },
            {
              path: 'pulls/',
              component: make(() => import('sentry/views/prevent/coverage/pulls')),
            },
            {
              path: 'coverage-trend/',
              component: make(
                () => import('sentry/views/prevent/coverage/coverageTrend')
              ),
            },
          ],
        },
        // Render coverage onboarding without any layout wrapping
        {
          path: 'new/',
          component: make(() => import('sentry/views/prevent/coverage/onboarding')),
        },
        codecovCommitRoutes,
        codecovPRRoutes,
      ],
    },
    {
      path: 'tests/',
      component: make(() => import('sentry/views/prevent/tests/testsWrapper')),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/prevent/tests/tests')),
        },
        {
          path: 'new/',
          component: make(() => import('sentry/views/prevent/tests/onboarding')),
        },
      ],
    },
    {
      path: 'ai-code-review/',
      children: [
        {
          component: make(() => import('sentry/views/prevent/preventAI/wrapper')),
          children: [
            {
              index: true,
              redirectTo: 'new/',
            },
            {
              path: 'new/',
              component: make(() => import('sentry/views/prevent/preventAI/onboarding')),
            },
            {
              path: 'home/',
              component: make(() => import('sentry/views/prevent/preventAI/index')),
            },
          ],
        },
      ],
    },
    {
      path: 'tokens/',
      component: make(() => import('sentry/views/prevent/tokens/tokensWrapper')),
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/prevent/tokens/tokens')),
        },
      ],
    },
  ];
  const preventRoutes: SentryRouteObject = {
    path: '/prevent/',
    withOrgPath: true,
    component: make(() => import('sentry/views/prevent/index')),
    children: codecovChildren,
  };

  const preprodChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/preprod/buildList/buildList')),
    },
    {
      path: ':artifactId/',
      component: make(() => import('sentry/views/preprod/buildDetails/buildDetails')),
    },
    {
      path: ':artifactId/install/',
      component: make(() => import('sentry/views/preprod/install/installPage')),
    },
    {
      path: 'compare/',
      children: [
        {
          path: ':headArtifactId/',
          component: make(
            () => import('sentry/views/preprod/buildComparison/buildComparison')
          ),
        },
        {
          path: ':headArtifactId/:baseArtifactId/',
          component: make(
            () => import('sentry/views/preprod/buildComparison/buildComparison')
          ),
        },
      ],
    },
  ];
  const preprodRoutes: SentryRouteObject = {
    path: '/preprod/:projectId/',
    component: make(() => import('sentry/views/preprod/index')),
    withOrgPath: true,
    children: preprodChildren,
    deprecatedRouteProps: true,
  };

  const pullRequestChildren: SentryRouteObject[] = [
    {
      path: ':repoOrg/:repoName/:prId/',
      component: make(
        () => import('sentry/views/pullRequest/details/pullRequestDetails')
      ),
    },
  ];

  const pullRequestRoutes: SentryRouteObject = {
    path: '/pull/',
    component: make(() => import('sentry/views/pullRequest/index')),
    withOrgPath: true,
    children: pullRequestChildren,
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
    },
    {
      path: `${IssueTaxonomy.ERRORS_AND_OUTAGES}/`,
      component: make(() => import('sentry/views/issueList/pages/errorsOutages')),
    },
    {
      path: `${IssueTaxonomy.BREACHED_METRICS}/`,
      component: make(() => import('sentry/views/issueList/pages/breachedMetrics')),
    },
    {
      path: `${IssueTaxonomy.WARNINGS}/`,
      component: make(() => import('sentry/views/issueList/pages/warnings')),
    },
    {
      path: 'views/',
      component: make(
        () => import('sentry/views/issueList/issueViews/issueViewsList/issueViewsList')
      ),
    },
    {
      path: 'views/:viewId/',
      component: errorHandler(OverviewWrapper),
    },
    {
      path: 'searches/:searchId/',
      component: errorHandler(OverviewWrapper),
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
    },
    {
      path: 'alerts/',
      component: make(() => import('sentry/views/alerts')),
      children: alertChildRoutes(true),
      deprecatedRouteProps: true,
    },
    traceView,
  ];
  const issueRoutes: SentryRouteObject = {
    path: '/issues/',
    withOrgPath: true,
    children: issueChildren,
  };

  const adminManageChildren: SentryRouteObject[] = [
    {
      index: true,
      component: make(() => import('sentry/views/admin/adminEnvironment')),
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
      path: 'settings/',
      component: make(() => import('sentry/views/admin/adminSettings')),
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
      monitorRoutes,
      preventRoutes,
      preprodRoutes,
      pullRequestRoutes,
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
    component: ({children}: {children: React.ReactNode}) => {
      return (
        <ProvideAriaRouter>
          <ScrapsProviders>{children}</ScrapsProviders>
        </ProvideAriaRouter>
      );
    },
    deprecatedRouteProps: true,
    children: [
      experimentalSpaRoutes,
      {
        path: '/',
        component: errorHandler(App),
        children: [
          rootRoutes,
          authV2Routes,
          organizationRoutes,
          legacyRedirectRoutes,
          {
            path: '*',
            component: errorHandler(OrganizationLayout),
            children: [
              {
                path: '*',
                component: errorHandler(RouteNotFound),
              },
            ],
          },
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
