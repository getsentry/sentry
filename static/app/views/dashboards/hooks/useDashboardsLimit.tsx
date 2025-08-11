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

  const isUnlimitedPlan =
    subscription?.planDetails?.dashboardLimit === UNLIMITED_DASHBOARDS_LIMIT;

  // Request up to 20 dashboards to get an idea of whether a user has reached the dashboard limit
  const {data: dashboardsTotalCount, isLoading: isLoadingDashboardsTotalCount} =
    useApiQuery<DashboardListItem[]>(
      [
        `/organizations/${organization.slug}/dashboards/`,
        {
          query: {
            // We only need to know at most 20 dashboards because that is the max limit we apply
            per_page: 20,
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

  // If there is no subscription, the user can create unlimited dashboards
  const dashboardsLimit =
    subscription?.planDetails?.dashboardLimit ?? UNLIMITED_DASHBOARDS_LIMIT;
  const hasReachedDashboardLimit =
    (dashboardsTotalCount?.length ?? 0) >= dashboardsLimit &&
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
