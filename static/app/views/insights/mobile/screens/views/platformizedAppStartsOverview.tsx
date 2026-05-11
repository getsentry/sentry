import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {useTransactionGlobalFilters} from 'sentry/views/insights/mobile/screens/utils/useTransactionDashboardFilters';

export function PlatformizedAppStartsOverview() {
  const additionalGlobalFilters = useTransactionGlobalFilters();

  return (
    <PrebuiltDashboardRenderer
      prebuiltId={PrebuiltDashboardId.MOBILE_VITALS_APP_STARTS}
      additionalGlobalFilters={additionalGlobalFilters}
    />
  );
}
