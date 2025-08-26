import HookOrDefault from 'sentry/components/hookOrDefault';

export const DashboardCreateLimitWrapper = HookOrDefault({
  hookName: 'component:dashboards-limit-hovercard',
  defaultComponent: ({children}) =>
    typeof children === 'function'
      ? children({
          hasReachedDashboardLimit: false,
          isLoading: false,
          limitMessage: null,
        })
      : children,
});
