import {tct} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

// A minimal version of the Subscription type that we need for this hook
interface Subscription {
  planDetails: {
    dashboardLimit: number;
  };
}

interface UseDashboardsLimitResult {
  dashboardsLimit: number;
  hasReachedDashboardLimit: boolean;
  isLoading: boolean;
  limitMessage?: React.ReactNode;
}

const UNLIMITED_DASHBOARDS_LIMIT = -1;

export function useDashboardsLimit(): UseDashboardsLimitResult {
  const organization = useOrganization();
  const {data: subscription, isLoading: isLoadingSubscription} =
    useApiQuery<Subscription>([`/subscriptions/${organization.slug}/`], {
      staleTime: Infinity,
      enabled: organization.features.includes('dashboards-plan-limits'),
    });

  // If there is no subscription, the user can create unlimited dashboards
  const dashboardsLimit =
    subscription?.planDetails?.dashboardLimit ?? UNLIMITED_DASHBOARDS_LIMIT;

  const isUnlimitedPlan = dashboardsLimit === UNLIMITED_DASHBOARDS_LIMIT;

  // Request up to the limited # of dashboards to get an idea of whether a user
  // has reached the dashboard limit
  const {data: dashboardsTotalCount, isLoading: isLoadingDashboardsTotalCount} =
    useApiQuery<DashboardListItem[]>(
      [
        `/organizations/${organization.slug}/dashboards/`,
        {
          query: {
            // We only need to know there are at most the limited # of dashboards.
            per_page: dashboardsLimit + 1, // +1 to account for the General dashboard
          },
        },
      ],
      {
        staleTime: 0,
        enabled:
          organization.features.includes('dashboards-plan-limits') &&
          !isLoadingSubscription &&
          !isUnlimitedPlan,
      }
    );

  if (!organization.features.includes('dashboards-plan-limits')) {
    return {
      hasReachedDashboardLimit: false,
      dashboardsLimit: 0,
      isLoading: false,
      limitMessage: null,
    };
  }

  if (isLoadingSubscription) {
    return {
      hasReachedDashboardLimit: false,
      dashboardsLimit: 0,
      isLoading: true,
      limitMessage: null,
    };
  }

  // Add 1 to dashboardsLimit to account for the General dashboard
  const hasReachedDashboardLimit =
    (dashboardsTotalCount?.length ?? 0) >= dashboardsLimit + 1 &&
    dashboardsLimit !== UNLIMITED_DASHBOARDS_LIMIT;
  const limitMessage = hasReachedDashboardLimit
    ? tct(
        'You have reached the dashboard limit ([dashboardsLimit]) for your plan. Upgrade to create more dashboards.',
        {dashboardsLimit}
      )
    : null;

  return {
    hasReachedDashboardLimit,
    dashboardsLimit,
    isLoading: isLoadingDashboardsTotalCount,
    limitMessage,
  };
}
