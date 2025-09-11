import HookOrDefault from 'sentry/components/hookOrDefault';

export const ProfilingBetaAlertBanner = HookOrDefault({
  hookName: 'component:profiling-billing-banner',
});

export const ContinuousProfilingBetaAlertBanner = HookOrDefault({
  hookName: 'component:continuous-profiling-beta-banner',
});

export const ContinuousProfilingBetaSDKAlertBanner = HookOrDefault({
  hookName: 'component:continuous-profiling-beta-sdk-banner',
});

export const ContinuousProfilingBillingRequirementBanner = HookOrDefault({
  hookName: 'component:continuous-profiling-billing-requirement-banner',
});
