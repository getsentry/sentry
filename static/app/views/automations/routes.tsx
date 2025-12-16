import Redirect from 'sentry/components/redirect';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';

export const automationRoutes: SentryRouteObject = {
  path: 'alerts/',
  children: [
    {
      component: RedirectToRuleList,
      deprecatedRouteProps: true,
      children: [
        {index: true, component: make(() => import('sentry/views/automations/list'))},
      ],
    },
    {
      path: 'new',
      component: RedirectToNewRule,
      deprecatedRouteProps: true,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/automations/new')),
        },
      ],
    },
    {
      path: ':automationId/',
      component: RedirectToRuleList,
      deprecatedRouteProps: true,
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/automations/detail')),
        },
        {
          path: 'edit/',
          component: make(() => import('sentry/views/automations/edit')),
        },
      ],
    },
  ],
};

function RedirectToRuleList({children}: {children: React.ReactNode}) {
  const organization = useOrganization();

  const hasRedirectOptOut = organization.features.includes(
    'workflow-engine-redirect-opt-out'
  );
  const shouldRedirect =
    !hasRedirectOptOut && !organization.features.includes('workflow-engine-ui');

  if (shouldRedirect) {
    return (
      <Redirect
        to={makeAlertsPathname({
          path: '/rules/',
          organization,
        })}
      />
    );
  }

  return children;
}

function RedirectToNewRule({children}: {children: React.ReactNode}) {
  const organization = useOrganization();

  const hasRedirectOptOut = organization.features.includes(
    'workflow-engine-redirect-opt-out'
  );
  const shouldRedirect =
    !hasRedirectOptOut && !organization.features.includes('workflow-engine-ui');

  if (shouldRedirect) {
    return (
      <Redirect
        to={makeAlertsPathname({
          path: '/new/',
          organization,
        })}
      />
    );
  }

  return children;
}
