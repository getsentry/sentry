import HookOrDefault from 'sentry/components/hookOrDefault';

export const MetricsSubscriptionAlert = HookOrDefault({
  hookName: 'component:metrics-subscription-alert',
  defaultComponent: () => null,
});

export const MetricsOnboardingPanelPrimaryAction = HookOrDefault({
  hookName: 'component:metrics-onboarding-panel-primary-action',
  defaultComponent: ({children}) => children,
});
