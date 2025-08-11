import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {SentryRouteObject} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';

export const automationRoutes: SentryRouteObject = {
  path: 'alerts/',
  children: [
    {
      index: true,
      component: make(() => import('sentry/views/automations/list')),
      // BROKEN: Results in empty page
      // component: RedirectToRuleList,
      // deprecatedRouteProps: true,
      // children: [
      //   {index: true, component: make(() => import('sentry/views/automations/list'))},
      // ],
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
      component: RedirectToRuleDetails,
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
  const user = useUser();
  const organization = useOrganization();
  const navigate = useNavigate();

  const shouldRedirect =
    !user.isStaff && !organization.features.includes('workflow-engine-ui');

  if (shouldRedirect) {
    navigate(
      makeAlertsPathname({
        path: '/rules/',
        organization,
      }),
      {
        replace: true,
      }
    );
  }

  return children;
}

export function RedirectToNewRule({children}: {children: React.ReactNode}) {
  const user = useUser();
  const organization = useOrganization();
  const navigate = useNavigate();

  const shouldRedirect =
    !user.isStaff && !organization.features.includes('workflow-engine-ui');

  if (shouldRedirect) {
    navigate(
      makeAlertsPathname({
        path: '/new/',
        organization,
      }),
      {
        replace: true,
      }
    );
  }

  return children;
}

interface AlertRuleWorkflow {
  workflowId: string;
  alertRuleId?: string;
  ruleId?: string;
}

export function RedirectToRuleDetails({children}: {children: React.ReactNode}) {
  const user = useUser();
  const organization = useOrganization();
  const navigate = useNavigate();

  const params = useParams<{automationId: string}>();

  const shouldRedirect =
    !user.isStaff && !organization.features.includes('workflow-engine-ui');

  const {data} = useApiQuery<AlertRuleWorkflow>(
    [
      `/organizations/${organization.slug}/alert-rule-workflows/`,
      {
        query: {workflowId: params.automationId},
      },
    ],
    {staleTime: Infinity, retry: false, enabled: shouldRedirect}
  );

  if (shouldRedirect) {
    if (!data) {
      return <LoadingIndicator />;
    }
    navigate(
      makeAlertsPathname({
        path: data.ruleId
          ? `/rules/details/${data.ruleId}/`
          : `/rules/details/${data.alertRuleId}/`,
        organization,
      }),
      {
        replace: true,
      }
    );
  }

  return children;
}
