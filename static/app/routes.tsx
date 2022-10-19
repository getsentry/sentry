import React, {Fragment} from 'react';
import {
  IndexRedirect,
  IndexRoute as BaseIndexRoute,
  IndexRouteProps,
  Redirect,
  Route as BaseRoute,
  RouteProps,
} from 'react-router';
import memoize from 'lodash/memoize';
import trimEnd from 'lodash/trimEnd';
import trimStart from 'lodash/trimStart';

import LazyLoad from 'sentry/components/lazyLoad';
import {EXPERIMENTAL_SPA, usingCustomerDomain} from 'sentry/constants';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import {HookName} from 'sentry/types/hooks';
import errorHandler from 'sentry/utils/errorHandler';
import withDomainRedirect from 'sentry/utils/withDomainRedirect';
import withDomainRequired from 'sentry/utils/withDomainRequired';
import App from 'sentry/views/app';
import AuthLayout from 'sentry/views/auth/layout';
import IssueListContainer from 'sentry/views/issueList/container';
import IssueListOverview from 'sentry/views/issueList/overview';
import OrganizationContextContainer from 'sentry/views/organizationContextContainer';
import OrganizationDetails from 'sentry/views/organizationDetails';
import {Tab, TabPaths} from 'sentry/views/organizationGroupDetails/types';
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

// NOTE: makeLazyloadComponent is exported for use in the sentry.io (getsentry)
// pirvate routing tree.

/**
 * Factory function to produce a component that will render the SafeLazyLoad
 * _with_ the required props.
 */
export function makeLazyloadComponent<C extends React.ComponentType<any>>(
  resolve: () => Promise<{default: C}>
) {
  // XXX: Assign the component to a variable so it has a displayname
  const RouteLazyLoad: React.FC<React.ComponentProps<C>> = props => {
    // we can use this hook to set the organization as it's
    // a child of the organization context
    return <SafeLazyLoad {...props} component={resolve} />;
  };

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
      <Route path=":orgId/" component={make(() => import('sentry/views/auth/login'))} />
    </Route>
  ) : null;

  const originalPaths: string[] = [];
  const keysSeen = new Set();

  function introspectRoute(
    parentPath: string,
    currentRoute: JSX.Element | JSX.Element[]
  ) {
    if (!currentRoute) {
      return currentRoute;
    }

    if (Array.isArray(currentRoute)) {
      return currentRoute.map(route => {
        return introspectRoute(parentPath, route);
      });
    }

    const originalPath: string = currentRoute.props.path || '';
    let fullOriginalPath: string = originalPath;

    if (!originalPath.startsWith('/')) {
      // Unless originalPath is an absolute path (i.e. begins with `/`), then we append it to parentPath.
      fullOriginalPath = `${trimEnd(parentPath, '/')}/${trimStart(originalPath, '/')}`;
    }

    let children: JSX.Element | JSX.Element[] = currentRoute.props.children ?? null;

    if (Array.isArray(children)) {
      children = currentRoute.props.children.map((child: JSX.Element) => {
        return introspectRoute(fullOriginalPath, child);
      });
    } else if (children) {
      children = introspectRoute(fullOriginalPath, children);
    }

    if (!['IndexRedirect', 'Redirect'].includes(currentRoute.type.displayName)) {
      // console.log(fullOriginalPath, currentRoute.type.displayName);
      if (originalPath.toLowerCase().includes(':orgid')) {
        originalPaths.push(originalPath);
        // console.log({originalPath, fullOriginalPath, currentRoute});
        const key = currentRoute.key;

        // Determine if all routes are accounted for.
        if (!(typeof key === 'string' && key.startsWith('cd-'))) {
          // console.log(originalPath, currentRoute.key);
        }

        if (keysSeen.has(key)) {
          // console.log('duplicated key', key);
        } else {
          keysSeen.add(key);
        }
      }
    }

    return React.cloneElement(currentRoute, {
      children,
    });
  }

  function walkRoutesTree(rootRoute) {
    introspectRoute('', rootRoute);

    // console.log(originalPaths, rootRoute);

    return rootRoute;
  }

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
      {usingCustomerDomain ? (
        <Route
          path="/data-export/:dataExportId"
          component={withDomainRequired(
            make(() => import('sentry/views/dataExport/dataDownload'))
          )}
          key="orgless-data-export-route"
        />
      ) : null}
      <Route
        path="/organizations/:orgId/data-export/:dataExportId"
        component={withDomainRedirect(
          make(() => import('sentry/views/dataExport/dataDownload'))
        )}
        key="org-data-export"
      />
      {usingCustomerDomain ? (
        <Route
          path="/disabled-member/"
          component={withDomainRequired(
            make(() => import('sentry/views/disabledMember'))
          )}
          key="orgless-disabled-member-route"
        />
      ) : null}
      <Route
        path="/organizations/:orgId/disabled-member/"
        component={withDomainRedirect(make(() => import('sentry/views/disabledMember')))}
        key="org-disabled-member"
      />
      {usingCustomerDomain ? (
        <Route
          path="/join-request/"
          component={withDomainRequired(
            make(() => import('sentry/views/organizationJoinRequest'))
          )}
          key="orgless-join-request"
        />
      ) : null}
      <Route
        path="/join-request/:orgId/"
        component={withDomainRedirect(
          make(() => import('sentry/views/organizationJoinRequest'))
        )}
        key="org-join-request"
      />
      {usingCustomerDomain ? (
        <Route
          path="/onboarding/"
          component={errorHandler(withDomainRequired(OrganizationContextContainer))}
          key="orgless-onboarding"
        >
          <Route
            path=":step/"
            component={make(() => import('sentry/views/onboarding/onboarding'))}
          />
        </Route>
      ) : null}
      <Route
        path="/onboarding/:orgId/"
        component={withDomainRedirect(errorHandler(OrganizationContextContainer))}
        key="org-onboarding"
      >
        <IndexRedirect to="welcome/" />
        <Route
          path=":step/"
          component={make(() => import('sentry/views/onboarding/onboarding'))}
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
      <Route path="dynamic-sampling/" name={t('Dynamic Sampling')}>
        <IndexRoute
          component={make(() => import('sentry/views/settings/project/dynamicSampling'))}
        />
        <Route
          path="rules/:rule/"
          component={make(() => import('sentry/views/settings/project/dynamicSampling'))}
        />
      </Route>
      <Redirect from="server-side-sampling/" to="dynamic-sampling/" />
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
      {usingCustomerDomain ? null : (
        <IndexRoute
          name={t('General')}
          component={make(
            () => import('sentry/views/settings/organizationGeneralSettings')
          )}
        />
      )}
      {usingCustomerDomain ? (
        <Route
          path="/settings/organization/"
          name={t('General')}
          component={make(
            () => import('sentry/views/settings/organizationGeneralSettings')
          )}
        />
      ) : null}
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
            () => import('sentry/views/organizationIntegrations/pluginDetailedView')
          )}
        />
      </Route>
      <Redirect from="sentry-apps/" to="integrations/" />
      <Route path="sentry-apps/" name={t('Integrations')}>
        <Route
          path=":integrationSlug"
          name={t('Details')}
          component={make(
            () => import('sentry/views/organizationIntegrations/sentryAppDetailedView')
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
              import('sentry/views/organizationIntegrations/docIntegrationDetailedView')
          )}
        />
      </Route>
      <Route path="integrations/" name={t('Integrations')}>
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
      <Route path="developer-settings/" name={t('Developer Settings')}>
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
      <Fragment>
        {usingCustomerDomain ? (
          <Route
            name={t('Organization')}
            component={withDomainRequired(NoOp)}
            key="orgless-settings-route"
          >
            {orgSettingsRoutes}
            {projectSettingsRoutes}
          </Route>
        ) : null}
        <Route
          path=":orgId/"
          name={t('Organization')}
          component={withDomainRedirect(NoOp, {
            redirect: [
              {
                // If /settings/:orgId/ is encountered, then redirect to /settings/organization/ rather than redirecting
                // to /settings/.
                from: '/settings/:orgId/',
                to: '/settings/organization/',
              },
            ],
          })}
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
    </Fragment>
  );

  const projectsRoutes = (
    <Fragment>
      {usingCustomerDomain ? (
        <Route
          path="/projects/"
          component={withDomainRequired(NoOp)}
          key="orgless-projects-route"
        >
          {projectsChildRoutes}
        </Route>
      ) : null}
      <Route
        path="/organizations/:orgId/projects/"
        component={withDomainRedirect(NoOp)}
        key="org-projects"
      >
        {projectsChildRoutes}
      </Route>
    </Fragment>
  );

  const dashboardWidgetRoutes = (
    <Fragment>
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
    </Fragment>
  );

  const dashboardRoutes = (
    <Fragment>
      <Fragment>
        {usingCustomerDomain ? (
          <Route
            path="/dashboards/"
            component={withDomainRequired(
              make(() => import('sentry/views/dashboardsV2'))
            )}
            key="orgless-dashboards-route"
          >
            <IndexRoute
              component={make(() => import('sentry/views/dashboardsV2/manage'))}
            />
          </Route>
        ) : null}
        <Route
          path="/organizations/:orgId/dashboards/"
          component={withDomainRedirect(make(() => import('sentry/views/dashboardsV2')))}
          key="org-dashboards"
        >
          <IndexRoute
            component={make(() => import('sentry/views/dashboardsV2/manage'))}
          />
        </Route>
      </Fragment>
      <Fragment>
        {usingCustomerDomain ? (
          <Route
            path="/dashboards/new/"
            component={withDomainRequired(
              make(() => import('sentry/views/dashboardsV2/create'))
            )}
            key="orgless-dashboards-new-route"
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
        ) : null}
        <Route
          path="/organizations/:orgId/dashboards/new/"
          component={withDomainRedirect(
            make(() => import('sentry/views/dashboardsV2/create'))
          )}
          key="org-dashboards-new"
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
      </Fragment>
      <Fragment>
        {usingCustomerDomain ? (
          <Route
            path="/dashboards/new/:templateId"
            component={withDomainRequired(
              make(() => import('sentry/views/dashboardsV2/create'))
            )}
            key="orgless-dashboards-new-template-route"
          >
            <Route
              path="widget/:widgetId/"
              component={make(() => import('sentry/views/dashboardsV2/create'))}
            />
          </Route>
        ) : null}
        <Route
          path="/organizations/:orgId/dashboards/new/:templateId"
          component={withDomainRedirect(
            make(() => import('sentry/views/dashboardsV2/create'))
          )}
          key="org-dashboards-new-template"
        >
          <Route
            path="widget/:widgetId/"
            component={make(() => import('sentry/views/dashboardsV2/create'))}
          />
        </Route>
      </Fragment>
      <Redirect
        from="/organizations/:orgId/dashboards/:dashboardId/"
        to="/organizations/:orgId/dashboard/:dashboardId/"
      />
      {usingCustomerDomain ? (
        <Redirect from="/dashboards/:dashboardId/" to="/dashboard/:dashboardId/" />
      ) : null}
      <Fragment>
        {usingCustomerDomain ? (
          <Route
            path="/dashboard/:dashboardId/"
            component={withDomainRequired(
              make(() => import('sentry/views/dashboardsV2/view'))
            )}
            key="orgless-dashboards-dashboard-id-route"
          >
            {dashboardWidgetRoutes}
          </Route>
        ) : null}
        <Route
          path="/organizations/:orgId/dashboard/:dashboardId/"
          component={withDomainRedirect(
            make(() => import('sentry/views/dashboardsV2/view'))
          )}
          key="org-dashboards-dashboard-id"
        >
          {dashboardWidgetRoutes}
        </Route>
      </Fragment>
    </Fragment>
  );

  const alertChildRoutes = ({forCustomerDomain}: {forCustomerDomain: boolean}) => {
    return (
      <Fragment>
        <IndexRoute
          component={make(() => import('sentry/views/alerts/list/incidents'))}
        />
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

  const alertRoutes = (
    <Fragment>
      {usingCustomerDomain ? (
        <Route
          path="/alerts/"
          component={withDomainRequired(make(() => import('sentry/views/alerts')))}
          key="orgless-alerts-route"
        >
          {alertChildRoutes({forCustomerDomain: true})}
        </Route>
      ) : null}
      <Route
        path="/organizations/:orgId/alerts/"
        component={withDomainRedirect(make(() => import('sentry/views/alerts')))}
        key="org-alerts"
      >
        {alertChildRoutes({forCustomerDomain: false})}
      </Route>
    </Fragment>
  );

  const monitorsChildRoutes = ({forCustomerDomain}: {forCustomerDomain: boolean}) => {
    return (
      <Fragment>
        <IndexRoute component={make(() => import('sentry/views/monitors/monitors'))} />
        <Route
          path={
            forCustomerDomain
              ? '/monitors/create/'
              : '/organizations/:orgId/monitors/create/'
          }
          component={make(() => import('sentry/views/monitors/create'))}
          key={forCustomerDomain ? 'orgless-monitors-create' : 'org-monitors-create'}
        />
        <Route
          path={
            forCustomerDomain
              ? '/monitors/:monitorId/'
              : '/organizations/:orgId/monitors/:monitorId/'
          }
          component={make(() => import('sentry/views/monitors/details'))}
          key={
            forCustomerDomain ? 'orgless-monitors-monitor-id' : 'org-monitors-monitor-id'
          }
        />
        <Route
          path={
            forCustomerDomain
              ? '/monitors/:monitorId/edit/'
              : '/organizations/:orgId/monitors/:monitorId/edit/'
          }
          component={make(() => import('sentry/views/monitors/edit'))}
          key={forCustomerDomain ? 'orgless-monitors-edit' : 'org-monitors-edit'}
        />
      </Fragment>
    );
  };

  const monitorsRoutes = (
    <Fragment>
      {usingCustomerDomain ? (
        <Route
          path="/monitors/"
          component={withDomainRequired(make(() => import('sentry/views/monitors')))}
          key="orgless-monitors-route"
        >
          {monitorsChildRoutes({forCustomerDomain: true})}
        </Route>
      ) : null}
      <Route
        path="/organizations/:orgId/monitors/"
        component={withDomainRedirect(make(() => import('sentry/views/monitors')))}
        key="org-monitors"
      >
        {monitorsChildRoutes({forCustomerDomain: false})}
      </Route>
    </Fragment>
  );

  const replayChildRoutes = (
    <Fragment>
      <IndexRoute component={make(() => import('sentry/views/replays/replays'))} />
      <Route
        path=":replaySlug/"
        component={make(() => import('sentry/views/replays/details'))}
      />
    </Fragment>
  );

  const replayRoutes = (
    <Fragment>
      {usingCustomerDomain ? (
        <Route
          path="/replays/"
          component={withDomainRequired(make(() => import('sentry/views/replays')))}
          key="orgless-replays-route"
        >
          {replayChildRoutes}
        </Route>
      ) : null}
      <Route
        path="/organizations/:orgId/replays/"
        component={withDomainRedirect(make(() => import('sentry/views/replays')))}
        key="org-replays"
      >
        {replayChildRoutes}
      </Route>
    </Fragment>
  );

  const releasesChildRoutes = ({forCustomerDomain}: {forCustomerDomain: boolean}) => {
    return (
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
          {forCustomerDomain ? null : (
            <Fragment>
              <Redirect
                from="new-events/"
                to="/organizations/:orgId/releases/:release/"
              />
              <Redirect
                from="all-events/"
                to="/organizations/:orgId/releases/:release/"
              />
            </Fragment>
          )}
        </Route>
      </Fragment>
    );
  };

  const releasesRoutes = (
    <Fragment>
      {usingCustomerDomain ? (
        <Route
          path="/releases/"
          component={withDomainRequired(NoOp)}
          key="orgless-releases-route"
        >
          {releasesChildRoutes({forCustomerDomain: true})}
        </Route>
      ) : null}
      <Route
        path="/organizations/:orgId/releases/"
        component={withDomainRedirect(NoOp)}
        key="org-releases"
      >
        {releasesChildRoutes({forCustomerDomain: false})}
      </Route>
    </Fragment>
  );

  const activityRoutes = (
    <Fragment>
      {usingCustomerDomain ? (
        <Route
          path="/activity/"
          component={withDomainRequired(
            make(() => import('sentry/views/organizationActivity'))
          )}
          key="orgless-activity-route"
        />
      ) : null}
      <Route
        path="/organizations/:orgId/activity/"
        component={withDomainRedirect(
          make(() => import('sentry/views/organizationActivity'))
        )}
        key="org-activity"
      />
    </Fragment>
  );

  const statsChildRoutes = ({forCustomerDomain}: {forCustomerDomain: boolean}) => {
    return (
      <Fragment>
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
        {forCustomerDomain ? null : (
          <Redirect from="team/" to="/organizations/:orgId/stats/issues/" />
        )}
      </Fragment>
    );
  };

  const statsRoutes = (
    <Fragment>
      {usingCustomerDomain ? (
        <Route
          path="/stats/"
          component={withDomainRequired(NoOp)}
          key="orgless-stats-route"
        >
          {statsChildRoutes({forCustomerDomain: true})}
        </Route>
      ) : null}
      <Route
        path="/organizations/:orgId/stats/"
        component={withDomainRedirect(NoOp)}
        key="org-stats"
      >
        {statsChildRoutes({forCustomerDomain: false})}
      </Route>
    </Fragment>
  );

  // TODO(mark) Long term this /queries route should go away and /discover
  // should be the canonical route for discover2. We have a redirect right now
  // as /discover was for discover 1 and most of the application is linking to
  // /discover/queries and not /discover
  const discoverChildRoutes = (
    <Fragment>
      <IndexRedirect to="queries/" />
      <Route
        path="homepage/"
        component={make(() => import('sentry/views/eventsV2/homepage'))}
      />
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
    </Fragment>
  );
  const discoverRoutes = (
    <Fragment>
      {usingCustomerDomain ? (
        <Route
          path="/discover/"
          component={withDomainRequired(make(() => import('sentry/views/eventsV2')))}
          key="orgless-discover-route"
        >
          {discoverChildRoutes}
        </Route>
      ) : null}
      <Route
        path="/organizations/:orgId/discover/"
        component={withDomainRedirect(make(() => import('sentry/views/eventsV2')))}
        key="org-discover-route"
      >
        {discoverChildRoutes}
      </Route>
    </Fragment>
  );

  const performanceChildRoutes = (
    <Fragment>
      <IndexRoute component={make(() => import('sentry/views/performance/content'))} />
      <Route
        path="trends/"
        component={make(() => import('sentry/views/performance/trends'))}
      />
      <Route path="summary/">
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
    </Fragment>
  );

  const performanceRoutes = (
    <Fragment>
      {usingCustomerDomain ? (
        <Route
          path="/performance/"
          component={withDomainRequired(make(() => import('sentry/views/performance')))}
          key="orgless-performance-route"
        >
          {performanceChildRoutes}
        </Route>
      ) : null}
      <Route
        path="/organizations/:orgId/performance/"
        component={withDomainRedirect(make(() => import('sentry/views/performance')))}
        key="org-performance"
      >
        {performanceChildRoutes}
      </Route>
    </Fragment>
  );

  const userFeedbackRoutes = (
    <Fragment>
      {usingCustomerDomain ? (
        <Route
          path="/user-feedback/"
          component={withDomainRequired(make(() => import('sentry/views/userFeedback')))}
          key="orgless-user-feedback-route"
        />
      ) : null}
      <Route
        path="/organizations/:orgId/user-feedback/"
        component={withDomainRedirect(make(() => import('sentry/views/userFeedback')))}
        key="org-user-feedback"
      />
    </Fragment>
  );

  const issueListRoutes = (
    <Fragment>
      {usingCustomerDomain ? (
        <Route
          path="/issues/(searches/:searchId/)"
          component={withDomainRequired(errorHandler(IssueListContainer))}
          key="orgless-issues-route"
        >
          <IndexRoute component={errorHandler(IssueListOverview)} />
        </Route>
      ) : null}
      <Route
        path="/organizations/:orgId/issues/(searches/:searchId/)"
        component={withDomainRedirect(errorHandler(IssueListContainer))}
        key="org-issues"
      >
        <Redirect from="/organizations/:orgId/" to="/organizations/:orgId/issues/" />
        <IndexRoute component={errorHandler(IssueListOverview)} />
      </Route>
    </Fragment>
  );

  // Once org issues is complete, these routes can be nested under
  // /organizations/:orgId/issues
  const issueDetailsChildRoutes = (
    <Fragment>
      <IndexRoute
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupEventDetails')
        )}
      />
      <Route
        path={TabPaths[Tab.REPLAYS]}
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupReplays')
        )}
      />
      <Route
        path={TabPaths[Tab.ACTIVITY]}
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupActivity')
        )}
      />
      <Route
        path={TabPaths[Tab.EVENTS]}
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupEvents')
        )}
      />
      <Route
        path={TabPaths[Tab.TAGS]}
        component={make(() => import('sentry/views/organizationGroupDetails/groupTags'))}
      />
      <Route
        path={`${TabPaths[Tab.TAGS]}:tagKey/`}
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupTagValues')
        )}
      />
      <Route
        path={TabPaths[Tab.USER_FEEDBACK]}
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupUserFeedback')
        )}
      />
      <Route
        path={TabPaths[Tab.ATTACHMENTS]}
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupEventAttachments')
        )}
      />
      <Route
        path={TabPaths[Tab.SIMILAR_ISSUES]}
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupSimilarIssues')
        )}
      />
      <Route
        path={TabPaths[Tab.MERGED]}
        component={make(
          () => import('sentry/views/organizationGroupDetails/groupMerged')
        )}
      />
      <Route
        path={TabPaths[Tab.GROUPING]}
        component={make(() => import('sentry/views/organizationGroupDetails/grouping'))}
      />
      <Route path={`${TabPaths[Tab.EVENTS]}:eventId/`}>
        <IndexRoute
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupEventDetails')
          )}
        />
        <Route
          path={TabPaths[Tab.REPLAYS]}
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupReplays')
          )}
        />
        <Route
          path={TabPaths[Tab.ACTIVITY]}
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupActivity')
          )}
        />
        <Route
          path={TabPaths[Tab.EVENTS]}
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupEvents')
          )}
        />
        <Route
          path={TabPaths[Tab.SIMILAR_ISSUES]}
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupSimilarIssues')
          )}
        />
        <Route
          path={TabPaths[Tab.TAGS]}
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupTags')
          )}
        />
        <Route
          path={`${TabPaths[Tab.TAGS]}:tagKey/`}
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupTagValues')
          )}
        />
        <Route
          path={TabPaths[Tab.USER_FEEDBACK]}
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupUserFeedback')
          )}
        />
        <Route
          path={TabPaths[Tab.ATTACHMENTS]}
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupEventAttachments')
          )}
        />
        <Route
          path={TabPaths[Tab.MERGED]}
          component={make(
            () => import('sentry/views/organizationGroupDetails/groupMerged')
          )}
        />
        <Route
          path={TabPaths[Tab.GROUPING]}
          component={make(() => import('sentry/views/organizationGroupDetails/grouping'))}
        />
      </Route>
    </Fragment>
  );
  const issueDetailsRoutes = (
    <Fragment>
      <Route
        path="/organizations/:orgId/issues/:groupId/"
        component={withDomainRedirect(
          make(() => import('sentry/views/organizationGroupDetails'))
        )}
        key="org-issues-group-id"
      >
        {issueDetailsChildRoutes}
      </Route>
      {usingCustomerDomain ? (
        <Route
          path="/issues/:groupId/"
          component={withDomainRequired(
            make(() => import('sentry/views/organizationGroupDetails'))
          )}
          key="orgless-issues-group-id-route"
        >
          {issueDetailsChildRoutes}
        </Route>
      ) : null}
    </Fragment>
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
      <Route path="/organizations/:orgId/" key="cd-legacy-org-routes">
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

  const gettingStartedChildRoutes = (
    <Fragment>
      <IndexRoute
        component={make(() => import('sentry/views/projectInstall/overview'))}
      />
      <Route
        path=":platform/"
        component={make(
          () => import('sentry/views/projectInstall/platformOrIntegration')
        )}
      />
    </Fragment>
  );

  const gettingStartedRoutes = (
    <Fragment>
      {usingCustomerDomain ? (
        <Route
          path="/getting-started/:projectId/"
          component={withDomainRequired(
            make(() => import('sentry/views/projectInstall/gettingStarted'))
          )}
          key="orgless-getting-started-route"
        >
          {gettingStartedChildRoutes}
        </Route>
      ) : null}
      <Route
        path="/:orgId/:projectId/getting-started/"
        component={withDomainRedirect(
          make(() => import('sentry/views/projectInstall/gettingStarted')),
          {
            redirect: [
              {
                // If /:orgId/:projectId/getting-started/* is encountered, then redirect to /getting-started/:projectId/*
                from: '/:orgId/:projectId/getting-started/',
                to: '/getting-started/:projectId/',
              },
            ],
          }
        )}
        key="org-getting-started"
      >
        {gettingStartedChildRoutes}
      </Route>
    </Fragment>
  );

  // Support for deprecated URLs (pre-Sentry 10). We just redirect users to new
  // canonical URLs.
  //
  // XXX(epurkhiser): Can these be moved over to the legacyOrgRedirects routes,
  // or do these need to be nested into the OrganizationDetails tree?
  const legacyOrgRedirects = (
    <Route path="/:orgId/:projectId/" key="cd-legacy-org-redirects">
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

  const profilingChildRoutes = (
    <Fragment>
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
    </Fragment>
  );

  const profilingRoutes = (
    <Fragment>
      {usingCustomerDomain ? (
        <Route
          path="/profiling/"
          component={withDomainRequired(make(() => import('sentry/views/profiling')))}
          key="orgless-profiling-route"
        >
          {profilingChildRoutes}
        </Route>
      ) : null}
      <Route
        path="/organizations/:orgId/profiling/"
        component={withDomainRedirect(make(() => import('sentry/views/profiling')))}
        key="org-profiling"
      >
        {profilingChildRoutes}
      </Route>
    </Fragment>
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
      {gettingStartedRoutes}
      {legacyOrganizationRootRoutes}
      {legacyOrgRedirects}
    </Route>
  );

  const legacyRedirectRoutes = (
    <Route path="/:orgId/" key="cd-legacy-redirect-routes">
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
      {walkRoutesTree(
        <Route path="/" component={errorHandler(App)}>
          {rootRoutes}
          {organizationRoutes}
          {legacyRedirectRoutes}
          <Route path="*" component={errorHandler(RouteNotFound)} />
        </Route>
      )}
    </Route>
  );

  return appRoutes;
}

// We load routes both when initlaizing the SDK (for routing integrations) and
// when the app renders Main. Memoize to avoid rebuilding the route tree.
export const routes = memoize(buildRoutes);

function NoOp(props) {
  return <Fragment>{props.children}</Fragment>;
}
