import type {ReactNode} from 'react';

import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';

type DashboardCreateLimitWrapperResult = {
  dashboardsLimit: number;
  hasReachedDashboardLimit: boolean;
  isLoading: boolean;
  limitMessage: ReactNode | null;
};

export const DashboardCreateLimitWrapper = OverrideOrDefault({
  overrideName: 'component:dashboards-limit-provider',
  defaultComponent: ({children}) =>
    typeof children === 'function'
      ? children({
          hasReachedDashboardLimit: false,
          dashboardsLimit: 0,
          isLoading: false,
          limitMessage: null,
        } satisfies DashboardCreateLimitWrapperResult)
      : children,
});
