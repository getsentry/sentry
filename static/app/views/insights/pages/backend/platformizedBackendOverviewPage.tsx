import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export function PlatformizedBackendOverviewPage() {
  return <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.BACKEND_OVERVIEW} />;
}
