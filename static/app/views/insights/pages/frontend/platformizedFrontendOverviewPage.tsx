import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

export function PlatformizedFrontendOverviewPage() {
  const {view} = useDomainViewFilters();
  return (
    <PrebuiltDashboardRenderer
      prebuiltId={PrebuiltDashboardId.FRONTEND_OVERVIEW}
      storageNamespace={view}
    />
  );
}
