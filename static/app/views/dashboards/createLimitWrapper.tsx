import HookOrDefault from 'sentry/components/hookOrDefault';

export const DashboardCreateLimitWrapper = HookOrDefault({
  hookName: 'component:dashboards-limit-provider',
  defaultComponent: ({children}) =>
    typeof children === 'function'
      ? children({
          hasReachedDashboardLimit: false,
          dashboardsLimit: 0,
          isLoading: false,
          limitMessage: null,
        })
      : children,
});
