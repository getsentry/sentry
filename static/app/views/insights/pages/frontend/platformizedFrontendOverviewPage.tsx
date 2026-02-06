import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export function PlatformizedFrontendOverviewPage() {
  return <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.FRONTEND_OVERVIEW} />;
}
