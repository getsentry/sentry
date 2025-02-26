import HookOrDefault from 'sentry/components/hookOrDefault';

export const QuotaExceededAlert = HookOrDefault({
  hookName: 'component:performance-quota-exceeded-alert',
  defaultComponent: null,
});
