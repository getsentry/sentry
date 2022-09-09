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
import OrganizationContextContainer from 'sentry/views/organizationContextContainer';
import OrganizationDetails from 'sentry/views/organizationDetails';
import {Tab} from 'sentry/views/organizationGroupDetails/types';
import OrganizationRoot from 'sentry/views/organizationRoot';
import ProjectEventRedirect from 'sentry/views/projectEventRedirect';
import redirectDeprecatedProjectRoute from 'sentry/views/projects/redirectDeprecatedProjectRoute';
import RouteNotFound from 'sentry/views/routeNotFound';
import SettingsWrapper from 'sentry/views/settings/components/settingsWrapper';

type CustomProps = {
  name?: string;
};

/**
 * We add some additional props to our routes
 */

const Route = BaseRoute as React.ComponentClass<RouteProps & CustomProps>;
const IndexRoute = BaseIndexRoute as React.ComponentClass<IndexRouteProps & CustomProps>;

const hook = (name: HookName) => HookStore.get(name).map(cb => cb());

const SafeLazyLoad = errorHandler(LazyLoad);

type PromisedImport<C> = Promise<{default: C}>;
type ComponentType = React.ComponentType<any>;

// NOTE: makeLazyloadComponent is exported for use in the sentry.io (getsentry)
// pirvate routing tree.

/**
 * Factory function to produce a component that will render the SafeLazyLoad
 * _with_ the required props.
 */
export function makeLazyloadComponent<C extends ComponentType>(
  resolve: () => PromisedImport<C>
) {
  // XXX: Assign the component to a variable so it has a displayname
  const RouteLazyLoad: React.FC<React.ComponentProps<C>> = props => {
    return <SafeLazyLoad {...props} component={resolve} />;
  };

  return RouteLazyLoad;
}

// Shorthand to avoid extra line wrapping
const make = makeLazyloadComponent;

const _ = [
  '/',
  '/accept/:memberId/:token/',
  '/accept-transfer/',
  '/extensions/external-install/:integrationSlug/:installationId',
  '/extensions/:integrationSlug/link/',
  '/sentry-apps/:sentryAppSlug/external-install/',
  '/share/issue/:shareId/',
  '/organizations/new/',
  '/organizations/:orgId/data-export/:dataExportId',
  '/organizations/:orgId/disabled-member/',
  '/join-request/:orgId/',
  '/onboarding/:orgId/',
  '/onboarding/:orgId/:step/',
  '/settings/',
  '/settings/account/',
  '/settings/account/details/',
  '/settings/account/notifications/',
  '/settings/account/notifications/:fineTuneType/',
  '/settings/account/emails/',
  '/settings/account/authorizations/',
  '/settings/account/security/',
  '/settings/account/security/session-history/',
  '/settings/account/security/mfa/:authId/',
  '/settings/account/security/mfa/:authId/enroll/',
  '/settings/account/subscriptions/',
  '/settings/account/identities/',
  '/settings/account/api/',
  '/settings/account/api/auth-tokens/',
  '/settings/account/api/auth-tokens/new-token/',
  '/settings/account/api/applications/',
  '/settings/account/api/applications/:appId/',
  '/settings/account/api/mobile-app/',
  '/settings/account/close-account/',
  '/settings/:orgId/',
  '/settings/:orgId/billing/',
  '/settings/:orgId/billing/checkout/',
  '/settings/:orgId/billing/cancel/',
  '/settings/:orgId/billing/overview/',
  '/settings/:orgId/billing/usage/',
  '/settings/:orgId/billing/receipts/',
  '/settings/:orgId/billing/details/',
  '/settings/:orgId/billing/usage-log/',
  '/settings/:orgId/billing/receipts/:invoiceGuid/',
  '/settings/:orgId/subscription/',
  '/settings/:orgId/subscription/quota-management/',
  '/settings/:orgId/subscription/quota-management/new/',
  '/settings/:orgId/subscription/quota-management/:projectSlug/edit',
  '/settings/:orgId/subscription/spend-visibility',
  '/settings/:orgId/subscription/redeem-code/',
  '/settings/:orgId/legal/',
  '/settings/:orgId/support/',
  '/settings/:orgId/projects/',
  '/settings/:orgId/api-keys/',
  '/settings/:orgId/api-keys/:apiKey/',
  '/settings/:orgId/audit-log/',
  '/settings/:orgId/auth/',
  '/settings/:orgId/members/',
  '/settings/:orgId/members/:memberId/',
  '/settings/:orgId/rate-limits/',
  '/settings/:orgId/relay/',
  '/settings/:orgId/repos/',
  '/settings/:orgId/settings/',
  '/settings/:orgId/security-and-privacy/',
  '/settings/:orgId/teams/',
  '/settings/:orgId/teams/:teamId/',
  '/settings/:orgId/teams/:teamId/members/',
  '/settings/:orgId/teams/:teamId/notifications/',
  '/settings/:orgId/teams/:teamId/projects/',
  '/settings/:orgId/teams/:teamId/settings/',
  '/settings/:orgId/plugins/',
  '/settings/:orgId/plugins/:integrationSlug/',
  '/settings/:orgId/sentry-apps/',
  '/settings/:orgId/sentry-apps/:integrationSlug',
  '/settings/:orgId/document-integrations/',
  '/settings/:orgId/document-integrations/:integrationSlug',
  '/settings/:orgId/integrations/',
  '/settings/:orgId/integrations/:integrationSlug',
  '/settings/:orgId/integrations/:providerKey/:integrationId/',
  '/settings/:orgId/developer-settings/',
  '/settings/:orgId/developer-settings/new-public/',
  '/settings/:orgId/developer-settings/new-internal/',
  '/settings/:orgId/developer-settings/:appSlug/',
  '/settings/:orgId/developer-settings/:appSlug/dashboard/',
  '/settings/:orgId/developer-settings/sentry-functions/',
  '/settings/:orgId/developer-settings/sentry-functions/new/',
  '/settings/:orgId/developer-settings/sentry-functions/:functionSlug/',
  '/settings/:orgId/projects/:projectId/',
  '/settings/:orgId/projects/:projectId/teams/',
  '/settings/:orgId/projects/:projectId/alerts/',
  '/settings/:orgId/projects/:projectId/environments/',
  '/settings/:orgId/projects/:projectId/environments/hidden/',
  '/settings/:orgId/projects/:projectId/tags/',
  '/settings/:orgId/projects/:projectId/release-tracking/',
  '/settings/:orgId/projects/:projectId/ownership/',
  '/settings/:orgId/projects/:projectId/data-forwarding/',
  '/settings/:orgId/projects/:projectId/security-and-privacy/',
  '/settings/:orgId/projects/:projectId/debug-symbols/',
  '/settings/:orgId/projects/:projectId/proguard/',
  '/settings/:orgId/projects/:projectId/performance/',
  '/settings/:orgId/projects/:projectId/source-maps/',
  '/settings/:orgId/projects/:projectId/source-maps/:name/',
  '/settings/:orgId/projects/:projectId/processing-issues/',
  '/settings/:orgId/projects/:projectId/filters/',
  '/settings/:orgId/projects/:projectId/filters/:filterType/',
  '/settings/:orgId/projects/:projectId/server-side-sampling/',
  '/settings/:orgId/projects/:projectId/issue-grouping/',
  '/settings/:orgId/projects/:projectId/hooks/',
  '/settings/:orgId/projects/:projectId/hooks/new/',
  '/settings/:orgId/projects/:projectId/hooks/:hookId/',
  '/settings/:orgId/projects/:projectId/keys/',
  '/settings/:orgId/projects/:projectId/keys/:keyId/',
  '/settings/:orgId/projects/:projectId/user-feedback/',
  '/settings/:orgId/projects/:projectId/security-headers/',
  '/settings/:orgId/projects/:projectId/security-headers/csp/',
  '/settings/:orgId/projects/:projectId/security-headers/expect-ct/',
  '/settings/:orgId/projects/:projectId/security-headers/hpkp/',
  '/settings/:orgId/projects/:projectId/plugins/',
  '/settings/:orgId/projects/:projectId/plugins/:pluginId/',
  '/settings/:orgId/projects/:projectId/install/',
  '/settings/:orgId/projects/:projectId/install/:platform/',
  '/organizations/:orgId/projects/',
  '/organizations/:orgId/projects/new/',
  '/organizations/:orgId/projects/:projectId/getting-started/',
  '/organizations/:orgId/projects/:projectId/getting-started/:platform/',
  '/organizations/:orgId/projects/:projectId/',
  '/organizations/:orgId/projects/:projectId/events/:eventId/',
  '/organizations/:orgId/dashboards/',
  '/organizations/:orgId/dashboards/new/',
  '/organizations/:orgId/dashboards/new/widget/:widgetIndex/edit/',
  '/organizations/:orgId/dashboards/new/widget/new/',
  '/organizations/:orgId/dashboards/new/:templateId',
  '/organizations/:orgId/dashboards/new/:templateId/widget/:widgetId/',
  '/organizations/:orgId/dashboard/:dashboardId/',
  '/organizations/:orgId/dashboard/:dashboardId/widget/:widgetIndex/edit/',
  '/organizations/:orgId/dashboard/:dashboardId/widget/new/',
  '/organizations/:orgId/dashboard/:dashboardId/widget/:widgetId/',
  '/organizations/:orgId/user-feedback/',
  '/organizations/:orgId/issues/',
  '/organizations/:orgId/issues/searches/:searchId/',
  '/organizations/:orgId/issues/:groupId/',
  '/organizations/:orgId/issues/:groupId/replays/',
  '/organizations/:orgId/issues/:groupId/activity/',
  '/organizations/:orgId/issues/:groupId/events/',
  '/organizations/:orgId/issues/:groupId/tags/',
  '/organizations/:orgId/issues/:groupId/tags/:tagKey/',
  '/organizations/:orgId/issues/:groupId/feedback/',
  '/organizations/:orgId/issues/:groupId/attachments/',
  '/organizations/:orgId/issues/:groupId/similar/',
  '/organizations/:orgId/issues/:groupId/merged/',
  '/organizations/:orgId/issues/:groupId/grouping/',
  '/organizations/:orgId/issues/:groupId/events/:eventId/',
  '/organizations/:orgId/issues/:groupId/events/:eventId/replays/',
  '/organizations/:orgId/issues/:groupId/events/:eventId/activity/',
  '/organizations/:orgId/issues/:groupId/events/:eventId/events/',
  '/organizations/:orgId/issues/:groupId/events/:eventId/similar/',
  '/organizations/:orgId/issues/:groupId/events/:eventId/tags/',
  '/organizations/:orgId/issues/:groupId/events/:eventId/tags/:tagKey/',
  '/organizations/:orgId/issues/:groupId/events/:eventId/feedback/',
  '/organizations/:orgId/issues/:groupId/events/:eventId/attachments/',
  '/organizations/:orgId/issues/:groupId/events/:eventId/merged/',
  '/organizations/:orgId/issues/:groupId/events/:eventId/grouping/',
  '/organizations/:orgId/alerts/',
  '/organizations/:orgId/alerts/rules/',
  '/organizations/:orgId/alerts/rules/details/:ruleId/',
  '/organizations/:orgId/alerts/rules/:projectId/',
  '/organizations/:orgId/alerts/rules/:projectId/:ruleId/',
  '/organizations/:orgId/alerts/rules/:projectId/:ruleId/details/',
  '/organizations/:orgId/alerts/metric-rules/',
  '/organizations/:orgId/alerts/metric-rules/:projectId/',
  '/organizations/:orgId/alerts/metric-rules/:projectId/:ruleId/',
  '/organizations/:orgId/alerts/wizard/',
  '/organizations/:orgId/alerts/new/',
  '/organizations/:orgId/alerts/new/:alertType/',
  '/organizations/:orgId/alerts/:alertId/',
  '/organizations/:orgId/alerts/:projectId/',
  '/organizations/:orgId/alerts/:projectId/new/',
  '/organizations/:orgId/alerts/:projectId/wizard/',
  '/organizations/:orgId/monitors/',
  '/organizations/:orgId/monitors/organizations/:orgId/monitors/create/',
  '/organizations/:orgId/monitors/organizations/:orgId/monitors/:monitorId/',
  '/organizations/:orgId/monitors/organizations/:orgId/monitors/:monitorId/edit/',
  '/organizations/:orgId/replays/',
  '/organizations/:orgId/replays/:replaySlug/',
  '/organizations/:orgId/releases/',
  '/organizations/:orgId/releases/:release/',
  '/organizations/:orgId/releases/:release/commits/',
  '/organizations/:orgId/releases/:release/files-changed/',
  '/organizations/:orgId/activity/',
  '/organizations/:orgId/stats/',
  '/organizations/:orgId/stats/issues/',
  '/organizations/:orgId/stats/health/',
  '/organizations/:orgId/discover/',
  '/organizations/:orgId/discover/queries/',
  '/organizations/:orgId/discover/results/',
  '/organizations/:orgId/discover/:eventSlug/',
  '/organizations/:orgId/performance/',
  '/organizations/:orgId/performance/trends/',
  '/organizations/:orgId/performance/organizations/:orgId/performance/summary/',
  '/organizations/:orgId/performance/organizations/:orgId/performance/summary/replays/',
  '/organizations/:orgId/performance/organizations/:orgId/performance/summary/vitals/',
  '/organizations/:orgId/performance/organizations/:orgId/performance/summary/tags/',
  '/organizations/:orgId/performance/organizations/:orgId/performance/summary/events/',
  '/organizations/:orgId/performance/organizations/:orgId/performance/summary/anomalies/',
  '/organizations/:orgId/performance/organizations/:orgId/performance/summary/spans/',
  '/organizations/:orgId/performance/organizations/:orgId/performance/summary/spans/:spanSlug/',
  '/organizations/:orgId/performance/vitaldetail/',
  '/organizations/:orgId/performance/trace/:traceSlug/',
  '/organizations/:orgId/performance/:eventSlug/',
  '/organizations/:orgId/profiling/',
  '/organizations/:orgId/profiling/summary/:projectId/',
  '/organizations/:orgId/profiling/profile/:projectId/:eventId',
  '/organizations/:orgId/profiling/profile/:projectId/:eventId/details/',
  '/organizations/:orgId/profiling/profile/:projectId/:eventId/flamechart/',
  '/manage/',
  '/manage/buffer/',
  '/manage/relays/',
  '/manage/organizations/',
  '/manage/projects/',
  '/manage/queue/',
  '/manage/quotas/',
  '/manage/settings/',
  '/manage/users/',
  '/manage/users/:id',
  '/manage/status/mail/',
  '/manage/status/environment/',
  '/manage/status/packages/',
  '/manage/status/warnings/',
  '/organizations/:orgId/',
  '/organizations/:orgId/billing/',
  '/organizations/:orgId/billing/checkout/',
  '/organizations/:orgId/billing/cancel/',
  '/organizations/:orgId/billing/overview/',
  '/organizations/:orgId/billing/usage/',
  '/organizations/:orgId/billing/receipts/',
  '/organizations/:orgId/billing/details/',
  '/organizations/:orgId/billing/usage-log/',
  '/organizations/:orgId/billing/receipts/:invoiceGuid/',
  '/organizations/:orgId/subscription/',
  '/organizations/:orgId/subscription/quota-management/',
  '/organizations/:orgId/subscription/quota-management/new/',
  '/organizations/:orgId/subscription/quota-management/:projectSlug/edit',
  '/organizations/:orgId/subscription/spend-visibility',
  '/organizations/:orgId/subscription/redeem-code/',
  '/organizations/:orgId/legal/',
  '/organizations/:orgId/support/',
  '/:orgId/:projectId/getting-started/',
  '/:orgId/:projectId/getting-started/:platform/',
  '/:orgId/:projectId/',
  '/:orgId/:projectId/issues/',
  '/:orgId/:projectId/dashboard/',
  '/:orgId/:projectId/user-feedback/',
  '/:orgId/:projectId/releases/',
  '/:orgId/:projectId/releases/:version/',
  '/:orgId/:projectId/releases/:version/new-events/',
  '/:orgId/:projectId/releases/:version/all-events/',
  '/:orgId/:projectId/releases/:version/commits/',
  '/:orgId/',
  '/:orgId/:projectId/settings/',
  '/:orgId/:projectId/events/:eventId/',
  '/*',
];

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
      <IndexRoute component={make(() => import('sentry/views/auth/login'))} />
    </Route>
  ) : null;

  /*
    This component mounts existing routes with a lower precedence than the new
    custom domain routes. It will also redirect to the new routes if the
    custom domains feature flag is turned on for this organization. Replacements look like:

    sentry.io/organizations/{slug}/issues/ -> {slug}.sentry.io/issues/
    sentry.io/settings/{slug}/ -> {slug}.sentry.io/settings/
    sentry.io/onboarding/{slug}/{step} -> {slug}.sentry.io/onboarding/{step}
    sentry.io/settings/{slug}/projects/{projectslug}/ -> {slug}.sentry.io/settings/projects/{project.slug}/
  */

  type HostRedirectComponentProps = RouteComponentProps<{orgId: string}, {}> & {
    children: React.ReactNode;
  };

  // This builds a list of redirects based on nested path components for all components in the subtree
  // and renders the routes with updated paths along with the redirects
  const orgScopedCustomDomainRouteHelper = (parentPath, route, redirectList) => {
    if (Array.isArray(route)) {
      return route.map(r =>
        orgScopedCustomDomainRouteHelper(parentPath, r, redirectList)
      );
    }
    const originalPath = route.props.path || '';
    let fullOriginalPath = originalPath;
    if (originalPath && originalPath[0] != '/') {
      fullOriginalPath = parentPath + originalPath;
    }
    let newPath = null;
    let newChildren = null;
    if (originalPath) {
      newPath = route.props.path
        .replace(/organizations\/:orgId\/?/, '')
        .replace(/:orgId\/?/, '');

      if (originalPath !== newPath) {
        redirectList.push(<Redirect from={fullOriginalPath} to={newPath} />);
      }
    }

    if (Array.isArray(route.props.children)) {
      newChildren = [];
      for (const child in route.props.children) {
        const newChild = orgScopedCustomDomainRouteHelper(
          fullOriginalPath,
          route.props.children[child],
          redirectList
        );
        newChildren.push(newChild);
      }
    } else {
      // There are elements where this property is not an array
      newChildren = route.props.children;
    }

    return React.cloneElement(route, {
      path: newPath,
      children: newChildren,
    });
  };

  const orgScopedCustomDomainRoutes = originalRoute => {
    const config = window.__initialData;
    const {regionUrl, organizationUrl} = config.links;

    // TODO: Typing seems wrong on config.features. Needs a cast?
    const shouldUseLegacyRoute =
      !regionUrl || !config.features.includes('organizations:customer-domains');

    const newPath = originalRoute.props.path
      .replace(/organizations\/:orgId\/?/, '')
      .replace(/:orgId\/?/, '');

    if (!shouldUseLegacyRoute && window.location.host != new URL(organizationUrl).host) {
      window.location = organizationUrl + newPath + window.location.search;
    }

    const redirectList = [];
    const newRoute = orgScopedCustomDomainRouteHelper('', originalRoute, redirectList);
    redirectList.forEach(r => {
      console.log(r.props.from + ' -> ' + r.props.to);
    });
    return (
      <Fragment>
        {redirectList}
        {newRoute}
      </Fragment>
    );
  };

  const rootRoutes = (
    <Fragment>
      <IndexRoute component={make(() => import('sentry/views/app/root'))} />
      <Route
        path="/accept/:memberId/:token/"
        component={make(() => import('sentry/views/acceptOrganizationInvite'))}
      />
      <Route
        path="/accept-transfer/"
        component={make(() => import('sentry/views/acceptProjectTransfer'))}
      />
      <Route
        path="/extensions/external-install/:integrationSlug/:installationId"
        component={make(() => import('sentry/views/integrationOrganizationLink'))}
      />
      <Route
        path="/extensions/:integrationSlug/link/"
        component={make(() => import('sentry/views/integrationOrganizationLink'))}
      />
      <Route
        path="/sentry-apps/:sentryAppSlug/external-install/"
        component={make(() => import('sentry/views/sentryAppExternalInstallation'))}
      />
      <Redirect from="/account/" to="/settings/account/details/" />
      <Redirect from="/share/group/:shareId/" to="/share/issue/:shareId/" />
      <Route
        path="/share/issue/:shareId/"
        component={make(() => import('sentry/views/sharedGroupDetails'))}
      />
      <Route
        path="/organizations/new/"
        component={make(() => import('sentry/views/organizationCreate'))}
      />
      <Route
        path="/organizations/:orgId/data-export/:dataExportId"
        component={make(() => import('sentry/views/dataExport/dataDownload'))}
      />
      <Route
        path="/organizations/:orgId/disabled-member/"
        component={make(() => import('sentry/views/disabledMember'))}
      />
      <Route
        path="/join-request/:orgId/"
        component={make(() => import('sentry/views/organizationJoinRequest'))}
      />
      <Route
        path="/onboarding/:orgId/"
        component={errorHandler(OrganizationContextContainer)}
      >
        <IndexRedirect to="welcome/" />
        <Route
          path=":step/"
          component={make(
            () => import('sentry/views/onboarding/targetedOnboarding/onboarding')
          )}
        />
      </Route>
    </Fragment>
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
              import('sentry/views/settings/account/notifications/notificationSettings')
          )}
        />
        <Route
          path=":fineTuneType/"
          name={t('Fine Tune Alerts')}
          component={make(
            () => import('sentry/views/settings/account/accountNotificationFineTuning')
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
      <Route name={t('Security')} path="security/">
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
        <Route path="auth-tokens/" name={t('Auth Tokens')}>
          <IndexRoute
            component={make(() => import('sentry/views/settings/account/apiTokens'))}
          />
          <Route
            path="new-token/"
            name={t('Create New Token')}
            component={make(() => import('sentry/views/settings/account/apiNewToken'))}
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
        {hook('routes:api')}
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
        name={t('Tags')}
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
        name={t('Issue Owners')}
        component={make(() => import('sentry/views/settings/project/projectOwnership'))}
      />
      <Route
        path="data-forwarding/"
        name={t('Data Forwarding')}
        component={make(() => import('sentry/views/settings/projectDataForwarding'))}
      />
      <Route
        path="security-and-privacy/"
        name={t('Security & Privacy')}
        component={make(() => import('sentry/views/settings/projectSecurityAndPrivacy'))}
      />
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
        path="source-maps/"
        name={t('Source Maps')}
        component={make(() => import('sentry/views/settings/projectSourceMaps'))}
      >
        <IndexRoute
          component={make(() => import('sentry/views/settings/projectSourceMaps/list'))}
        />
        <Route
          path=":name/"
          name={t('Archive')}
          component={make(() => import('sentry/views/settings/projectSourceMaps/detail'))}
        />
      </Route>
      <Route
        path="processing-issues/"
        name={t('Processing Issues')}
        component={make(
          () => import('sentry/views/settings/project/projectProcessingIssues')
        )}
      />
      <Route
        path="filters/"
        name={t('Inbound Filters')}
        component={make(() => import('sentry/views/settings/project/projectFilters'))}
      >
        <IndexRedirect to="data-filters/" />
        <Route path=":filterType/" />
      </Route>
      <Route
        path="server-side-sampling/"
        name={t('Server-Side Sampling')}
        component={make(
          () => import('sentry/views/settings/project/server-side-sampling')
        )}
      />
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
        path="user-feedback/"
        name={t('User Feedback')}
        component={make(
          () => import('sentry/views/settings/project/projectUserFeedback')
        )}
      />
      <Redirect from="csp/" to="security-headers/" />
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
      <Route path="install/" name={t('Configuration')}>
        <IndexRoute
          component={make(() => import('sentry/views/projectInstall/overview'))}
        />
        <Route
          path=":platform/"
          name={t('Docs')}
          component={make(
            () => import('sentry/views/projectInstall/platformOrIntegration')
          )}
        />
      </Route>
    </Route>
  );

  const orgSettingsRoutes = (
    <Route
      component={make(
        () => import('sentry/views/settings/organization/organizationSettingsLayout')
      )}
    >
      {hook('routes:organization')}
      <IndexRoute
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
      <Redirect from="members/requests" to="members/" />
      <Route path="members/" name={t('Members')}>
        <Route
          component={make(
            () =>
              import(
                'sentry/views/settings/organizationMembers/organizationMembersWrapper'
              )
          )}
        >
          <IndexRoute
            component={make(
              () =>
                import(
                  'sentry/views/settings/organizationMembers/organizationMembersList'
                )
            )}
          />
        </Route>
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
      <Route
        path="security-and-privacy/"
        name={t('Security & Privacy')}
        component={make(
          () => import('sentry/views/settings/organizationSecurityAndPrivacy')
        )}
      />
      <Route name={t('Teams')} path="teams/">
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
      <Route name={t('Integrations')} path="plugins/">
        <Route
          path=":integrationSlug/"
          name={t('Integration Details')}
          component={make(
            () => import('sentry/views/organizationIntegrations/pluginDetailedView')
          )}
        />
      </Route>
      <Redirect from="sentry-apps/" to="integrations/" />
      <Route name={t('Integrations')} path="sentry-apps/">
        <Route
          path=":integrationSlug"
          name={t('Details')}
          component={make(
            () => import('sentry/views/organizationIntegrations/sentryAppDetailedView')
          )}
        />
      </Route>
      <Redirect from="document-integrations/" to="integrations/" />
      <Route name={t('Integrations')} path="document-integrations/">
        <Route
          path=":integrationSlug"
          name={t('Details')}
          component={make(
            () =>
              import('sentry/views/organizationIntegrations/docIntegrationDetailedView')
          )}
        />
      </Route>
      <Route name={t('Integrations')} path="integrations/">
        <IndexRoute
          component={make(
            () => import('sentry/views/organizationIntegrations/integrationListDirectory')
          )}
        />
        <Route
          path=":integrationSlug"
          name={t('Integration Details')}
          component={make(
            () => import('sentry/views/organizationIntegrations/integrationDetailedView')
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

      <Redirect from="developer-settings/sentry-functions/" to="developer-settings/" />
      <Route name={t('Developer Settings')} path="developer-settings/">
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
        <Route path="sentry-functions/" name={t('Sentry Functions')}>
          <Route
            path="new/"
            name={t('Create Sentry Function')}
            component={make(
              () =>
                import(
                  'sentry/views/settings/organizationDeveloperSettings/sentryFunctionDetails'
                )
            )}
          />
          <Route
            path=":functionSlug/"
            name={t('Edit Sentry Function')}
            component={make(
              () =>
                import(
                  'sentry/views/settings/organizationDeveloperSettings/sentryFunctionDetails'
                )
            )}
          />
        </Route>
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
      <Route name={t('Organization')} path=":orgId/">
        {orgSettingsRoutes}
        {projectSettingsRoutes}
        {legacySettingsRedirects}
      </Route>
    </Route>
  );

  const projectsRoutes = (
    <Route path="/organizations/:orgId/projects/">
      <IndexRoute component={make(() => import('sentry/views/projectsDashboard'))} />
      <Route
        path="new/"
        component={make(() => import('sentry/views/projectInstall/newProject'))}
      />
      <Route
        path=":projectId/getting-started/"
        component={make(() => import('sentry/views/projectInstall/gettingStarted'))}
      >
        <IndexRoute
          component={make(() => import('sentry/views/projectInstall/overview'))}
        />
        <Route
          path=":platform/"
          component={make(
            () => import('sentry/views/projectInstall/platformOrIntegration')
          )}
        />
      </Route>
      <Route
        path=":projectId/"
        component={make(() => import('sentry/views/projectDetail'))}
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
        component={make(() => import('sentry/views/dashboardsV2'))}
      >
        <IndexRoute component={make(() => import('sentry/views/dashboardsV2/manage'))} />
      </Route>
      <Route
        path="/organizations/:orgId/dashboards/new/"
        component={make(() => import('sentry/views/dashboardsV2/create'))}
      >
        <Route
          path="widget/:widgetIndex/edit/"
          component={make(() => import('sentry/views/dashboardsV2/widgetBuilder'))}
        />
        <Route
          path="widget/new/"
          component={make(() => import('sentry/views/dashboardsV2/widgetBuilder'))}
        />
      </Route>
      <Route
        path="/organizations/:orgId/dashboards/new/:templateId"
        component={make(() => import('sentry/views/dashboardsV2/create'))}
      >
        <Route
          path="widget/:widgetId/"
          component={make(() => import('sentry/views/dashboardsV2/create'))}
        />
      </Route>
      <Redirect
        from="/organizations/:orgId/dashboards/:dashboardId/"
        to="/organizations/:orgId/dashboard/:dashboardId/"
      />
      <Route
        path="/organizations/:orgId/dashboard/:dashboardId/"
        component={make(() => import('sentry/views/dashboardsV2/view'))}
      >
        <Route
          path="widget/:widgetIndex/edit/"
          component={make(() => import('sentry/views/dashboardsV2/widgetBuilder'))}
        />
        <Route
          path="widget/new/"
          component={make(() => import('sentry/views/dashboardsV2/widgetBuilder'))}
        />
        <Route
          path="widget/:widgetId/"
          component={make(() => import('sentry/views/dashboardsV2/view'))}
        />
      </Route>
    </Fragment>
  );

  const alertRoutes = (
    <Route
      path="/organizations/:orgId/alerts/"
      component={make(() => import('sentry/views/alerts'))}
    >
      <IndexRoute component={make(() => import('sentry/views/alerts/list/incidents'))} />
      <Route path="rules/">
        <IndexRoute component={make(() => import('sentry/views/alerts/list/rules'))} />
        <Route
          path="details/:ruleId/"
          component={make(() => import('sentry/views/alerts/rules/metric/details'))}
        />
        <Route
          path=":projectId/"
          component={make(() => import('sentry/views/alerts/builder/projectProvider'))}
        >
          <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
          <Route
            path=":ruleId/"
            component={make(() => import('sentry/views/alerts/edit'))}
          />
        </Route>
        <Route
          path=":projectId/:ruleId/details/"
          component={make(() => import('sentry/views/alerts/rules/issue/details'))}
        >
          <IndexRoute
            component={make(
              () => import('sentry/views/alerts/rules/issue/details/ruleDetails')
            )}
          />
        </Route>
      </Route>
      <Route path="metric-rules/">
        <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
        <Route
          path=":projectId/"
          component={make(() => import('sentry/views/alerts/builder/projectProvider'))}
        >
          <IndexRedirect to="/organizations/:orgId/alerts/rules/" />
          <Route
            path=":ruleId/"
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
        <IndexRedirect to="/organizations/:orgId/alerts/wizard/" />
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
        <Route path="new/" component={make(() => import('sentry/views/alerts/create'))} />
        <Route
          path="wizard/"
          component={make(() => import('sentry/views/alerts/wizard'))}
        />
      </Route>
    </Route>
  );

  const monitorsRoutes = (
    <Route
      path="/organizations/:orgId/monitors/"
      component={make(() => import('sentry/views/monitors'))}
    >
      <IndexRoute component={make(() => import('sentry/views/monitors/monitors'))} />
      <Route
        path="/organizations/:orgId/monitors/create/"
        component={make(() => import('sentry/views/monitors/create'))}
      />
      <Route
        path="/organizations/:orgId/monitors/:monitorId/"
        component={make(() => import('sentry/views/monitors/details'))}
      />
      <Route
        path="/organizations/:orgId/monitors/:monitorId/edit/"
        component={make(() => import('sentry/views/monitors/edit'))}
      />
    </Route>
  );

  const replayRoutes = (
    <Route
      path="/organizations/:orgId/replays/"
      component={make(() => import('sentry/views/replays'))}
    >
      <IndexRoute component={make(() => import('sentry/views/replays/replays'))} />
      <Route
        path=":replaySlug/"
        component={make(() => import('sentry/views/replays/details'))}
      />
    </Route>
  );

  const releasesRoutes = (
    <Route path="/organizations/:orgId/releases/">
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
        <Redirect from="new-events/" to="/organizations/:orgId/releases/:release/" />
        <Redirect from="all-events/" to="/organizations/:orgId/releases/:release/" />
      </Route>
    </Route>
  );

  const activityRoutes = (
    <Route
      path="/organizations/:orgId/activity/"
      component={make(() => import('sentry/views/organizationActivity'))}
    />
  );

  const statsRoutes = (
    <Route path="/organizations/:orgId/stats/">
      <IndexRoute component={make(() => import('sentry/views/organizationStats'))} />
      <Route
        path="issues/"
        component={make(() => import('sentry/views/organizationStats/teamInsights'))}
      >
        <IndexRoute
          component={make(
            () => import('sentry/views/organizationStats/teamInsights/issues')
          )}
        />
      </Route>
      <Route
        path="health/"
        component={make(() => import('sentry/views/organizationStats/teamInsights'))}
      >
        <IndexRoute
          component={make(
            () => import('sentry/views/organizationStats/teamInsights/health')
          )}
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
      component={make(() => import('sentry/views/eventsV2'))}
    >
      <IndexRedirect to="queries/" />
      <Route
        path="queries/"
        component={make(() => import('sentry/views/eventsV2/landing'))}
      />
      <Route
        path="results/"
        component={make(() => import('sentry/views/eventsV2/results'))}
      />
      <Route
        path=":eventSlug/"
        component={make(() => import('sentry/views/eventsV2/eventDetails'))}
      />
    </Route>
  );

  const performanceRoutes = (
    <Route
      path="/organizations/:orgId/performance/"
      component={make(() => import('sentry/views/performance'))}
    >
      <IndexRoute component={make(() => import('sentry/views/performance/content'))} />
      <Route
        path="trends/"
        component={make(() => import('sentry/views/performance/trends'))}
      />
      <Route path="/organizations/:orgId/performance/summary/">
        <IndexRoute
          component={make(
            () =>
              import('sentry/views/performance/transactionSummary/transactionOverview')
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
          path="anomalies/"
          component={make(
            () =>
              import('sentry/views/performance/transactionSummary/transactionAnomalies')
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
      <Route
        path="vitaldetail/"
        component={make(() => import('sentry/views/performance/vitalDetail'))}
      />
      <Route
        path="trace/:traceSlug/"
        component={make(() => import('sentry/views/performance/traceDetails'))}
      />
      <Route
        path=":eventSlug/"
        component={make(() => import('sentry/views/performance/transactionDetails'))}
      />
    </Route>
  );

  const userFeedbackRoutes = (
    <Route
      path="/organizations/:orgId/user-feedback/"
      component={make(() => import('sentry/views/userFeedback'))}
    />
  );

  const issueListRoutes = (
    <Route
      path="/organizations/:orgId/issues/"
      component={errorHandler(IssueListContainer)}
    >
      {/* <Redirect from="/" to="/issues/" /> */}
      <Redirect from="/organizations/:orgId/" to="/organizations/:orgId/issues/" />
      <IndexRoute component={errorHandler(IssueListOverview)} />
      <Route path="searches/:searchId/" component={errorHandler(IssueListOverview)} />
    </Route>
  );

  // Once org issues is complete, these routes can be nested under
  // /organizations/:orgId/issues
  const issueDetailsRoutes = (
    <Route
      path="/organizations/:orgId/issues/:groupId/"
      component={make(() => import('sentry/views/organizationGroupDetails'))}
    >
      <IndexRoute
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupEventDetails')
        )}
        props={{
          currentTab: Tab.DETAILS,
          isEventRoute: false,
        }}
      />
      <Route
        path="replays/"
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupReplays')
        )}
        props={{
          currentTab: Tab.REPLAYS,
          isEventRoute: false,
        }}
      />
      <Route
        path="activity/"
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupActivity')
        )}
        props={{
          currentTab: Tab.ACTIVITY,
          isEventRoute: false,
        }}
      />
      <Route
        path="events/"
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupEvents')
        )}
        props={{
          currentTab: Tab.EVENTS,
          isEventRoute: false,
        }}
      />
      <Route
        path="tags/"
        component={make(() => import('sentry/views/organizationGroupDetails/groupTags'))}
        props={{
          currentTab: Tab.TAGS,
          isEventRoute: false,
        }}
      />
      <Route
        path="tags/:tagKey/"
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupTagValues')
        )}
        props={{
          currentTab: Tab.TAGS,
          isEventRoute: false,
        }}
      />
      <Route
        path="feedback/"
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupUserFeedback')
        )}
        props={{
          currentTab: Tab.USER_FEEDBACK,
          isEventRoute: false,
        }}
      />
      <Route
        path="attachments/"
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupEventAttachments')
        )}
        props={{
          currentTab: Tab.ATTACHMENTS,
          isEventRoute: false,
        }}
      />
      <Route
        path="similar/"
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupSimilarIssues')
        )}
        props={{
          currentTab: Tab.SIMILAR_ISSUES,
          isEventRoute: false,
        }}
      />
      <Route
        path="merged/"
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupMerged')
        )}
        props={{
          currentTab: Tab.MERGED,
          isEventRoute: false,
        }}
      />
      <Route
        path="grouping/"
        component={make(() => import('sentry/views/organizationGroupDetails/grouping'))}
        props={{
          currentTab: Tab.GROUPING,
          isEventRoute: false,
        }}
      />
      <Route path="events/:eventId/">
        <IndexRoute
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupEventDetails')
          )}
          props={{
            currentTab: Tab.DETAILS,
            isEventRoute: true,
          }}
        />
        <Route
          path="replays/"
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupReplays')
          )}
          props={{
            currentTab: Tab.REPLAYS,
            isEventRoute: true,
          }}
        />
        <Route
          path="activity/"
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupActivity')
          )}
          props={{
            currentTab: Tab.ACTIVITY,
            isEventRoute: true,
          }}
        />
        <Route
          path="events/"
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupEvents')
          )}
          props={{
            currentTab: Tab.EVENTS,
            isEventRoute: true,
          }}
        />
        <Route
          path="similar/"
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupSimilarIssues')
          )}
          props={{
            currentTab: Tab.SIMILAR_ISSUES,
            isEventRoute: true,
          }}
        />
        <Route
          path="tags/"
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupTags')
          )}
          props={{
            currentTab: Tab.TAGS,
            isEventRoute: true,
          }}
        />
        <Route
          path="tags/:tagKey/"
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupTagValues')
          )}
          props={{
            currentTab: Tab.TAGS,
            isEventRoute: true,
          }}
        />
        <Route
          path="feedback/"
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupUserFeedback')
          )}
          props={{
            currentTab: Tab.USER_FEEDBACK,
            isEventRoute: true,
          }}
        />
        <Route
          path="attachments/"
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupEventAttachments')
          )}
          props={{
            currentTab: Tab.ATTACHMENTS,
            isEventRoute: true,
          }}
        />
        <Route
          path="merged/"
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupMerged')
          )}
          props={{
            currentTab: Tab.MERGED,
            isEventRoute: true,
          }}
        />
        <Route
          path="grouping/"
          component={make(() => import('sentry/views/organizationGroupDetails/grouping'))}
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
      {hook('routes:admin')}
    </Route>
  );

  // XXX(epurkhiser): This should probably go away. It's not totally clear to
  // me why we need the OrganizationRoot root container.
  const legacyOrganizationRootRoutes = (
    <Route component={errorHandler(OrganizationRoot)}>
      <Redirect from="/organizations/:orgId/teams/new/" to="/settings/:orgId/teams/" />
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
    // TODO: needs orgScopedCustomDomainRoute?
    <Route
      path="/:orgId/:projectId/getting-started/"
      component={make(() => import('sentry/views/projectInstall/gettingStarted'))}
    >
      <IndexRoute
        component={make(() => import('sentry/views/projectInstall/overview'))}
      />
      <Route
        path=":platform/"
        component={make(
          () => import('sentry/views/projectInstall/platformOrIntegration')
        )}
      />
    </Route>
  );

  // Support for deprecated URLs (pre-Sentry 10). We just redirect users to new
  // canonical URLs.
  //
  // XXX(epurkhiser): Can these be moved over to the legacyOrgRedirects routes,
  // or do these need to be nested into the OrganizationDetails tree?
  const legacyOrgRedirects = (
    // TODO: needs orgScopedCustomDomainRoute?
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

  const profilingRoutes = (
    <Route
      path="/organizations/:orgId/profiling/"
      component={make(() => import('sentry/views/profiling'))}
    >
      <IndexRoute component={make(() => import('sentry/views/profiling/content'))} />
      <Route
        path="summary/:projectId/"
        component={make(() => import('sentry/views/profiling/profileSummary'))}
      />
      <Route
        path="profile/:projectId/:eventId"
        component={make(() => import('sentry/views/profiling/profileGroupProvider'))}
      >
        <Route
          path="details/"
          component={make(() => import('sentry/views/profiling/profileDetails'))}
        />
        <Route
          path="flamechart/"
          component={make(() => import('sentry/views/profiling/profileFlamechart'))}
        />
      </Route>
    </Route>
  );

  const organizationRoutes = (
    <Route component={errorHandler(OrganizationDetails)}>
      {settingsRoutes}
      {projectsRoutes}
      {dashboardRoutes}
      {userFeedbackRoutes}
      {issueListRoutes}
      {issueDetailsRoutes}
      {alertRoutes}
      {monitorsRoutes}
      {replayRoutes}
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
    // TODO: needs orgScopedCustomDomainRoute?
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
      {orgScopedCustomDomainRoutes(
        <Route path="/" component={errorHandler(App)}>
          {rootRoutes}
          {organizationRoutes}
          {legacyRedirectRoutes}
          {hook('routes')}
          <Route path="*" component={errorHandler(RouteNotFound)} />
        </Route>
      )}
    </Route>
  );

  let paths = [];
  if (Array.isArray(appRoutes)) {
    appRoutes.forEach(r => {
      paths = paths.concat(extractRoute(r, ''));
    });
  } else {
    paths = paths.concat(extractRoute(appRoutes));
  }
  console.log(paths);

  return appRoutes;
}

function extractChildRoutes(route, prefix) {
  let paths = [];
  const childRoutes =
    route.props && route.props.children ? route.props.children : route.childRoutes;
  if (childRoutes) {
    if (Array.isArray(childRoutes)) {
      childRoutes.forEach(r => {
        if (r === null) {
          return;
        }
        paths = paths.concat(extractRoute(r, prefix));
      });
    } else {
      paths = paths.concat(extractRoute(childRoutes, prefix));
    }
  }
  return paths;
}

function extractRoute(route, prefix) {
  const path = route.props && route.props.path ? route.props.path : route.path;
  let paths = [];

  if (!path) {
    if (Array.isArray(route)) {
      route.forEach(r => {
        if (r === null) {
          return;
        }
        paths = paths.concat(extractRoute(r, prefix));
      });

      return paths;
    }
    return extractChildRoutes(route, prefix);
  }
  const currentPath = `${prefix || ''}${path}`.replace(/\/+/g, '/');

  // if (!/:|\*/.test(currentPath)) {
  paths.push(`${currentPath.startsWith('/') ? '' : '/'}${currentPath}`);
  paths = paths.concat(extractChildRoutes(route, `${currentPath}/`));
  // }
  return paths;
}

// We load routes both when initlaizing the SDK (for routing integrations) and
// when the app renders Main. Memoize to avoid rebuilding the route tree.
export const routes = memoize(buildRoutes);
