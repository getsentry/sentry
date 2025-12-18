import {Fragment} from 'react';
import {Link} from 'react-router-dom';

import {tct} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

import useSubscription from 'getsentry/hooks/useSubscription';

interface UseDashboardsLimitResult {
  dashboardsLimit: number;
  hasReachedDashboardLimit: boolean;
  isLoading: boolean;
  limitMessage?: React.ReactNode;
}

const UNLIMITED_DASHBOARDS_LIMIT = -1;

export function useDashboardsLimit(): UseDashboardsLimitResult {
  const organization = useOrganization();
  const subscription = useSubscription();

  // If there is no subscription, block dashboard creation
  const dashboardsLimit = subscription?.planDetails?.dashboardLimit ?? 0;

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
        enabled: !isUnlimitedPlan && dashboardsLimit !== 0,
      }
    );

  // Add 1 to dashboardsLimit to account for the General dashboard
  const hasReachedDashboardLimit =
    ((dashboardsTotalCount?.length ?? 0) >= dashboardsLimit + 1 &&
      dashboardsLimit !== UNLIMITED_DASHBOARDS_LIMIT) ||
    dashboardsLimit === 0;
  const limitMessage = hasReachedDashboardLimit
    ? tct(
        'You have reached the maximum number of Dashboards available on your plan. To add more, [link:upgrade your plan]',
        {
          link: <Link to="/checkout/?referrer=dashboards-limit-upsell" />,
        }
      )
    : null;

  return {
    hasReachedDashboardLimit,
    dashboardsLimit,
    isLoading: isLoadingDashboardsTotalCount,
    limitMessage,
  };
}

type DashboardsLimitProviderProps = {
  children: ((data: UseDashboardsLimitResult & any) => React.ReactNode) | React.ReactNode;
};

export function DashboardsLimitProvider({
  children,
  ...props
}: DashboardsLimitProviderProps & any) {
  const dashboardLimitData = useDashboardsLimit();

  return (
    <Fragment>
      {typeof children === 'function'
        ? children({...props, ...dashboardLimitData})
        : children}
    </Fragment>
  );
}
