import HookOrDefault from 'sentry/components/hookOrDefault';
import usePageFilters from 'sentry/utils/usePageFilters';

const QuotaExceededAlertHook = HookOrDefault({
  hookName: 'component:explore-quota-exceeded-alert',
  defaultComponent: null,
});

export function QuotaExceededAlert() {
  const {selection} = usePageFilters();

  return <QuotaExceededAlertHook projectIds={selection.projects} />;
}
