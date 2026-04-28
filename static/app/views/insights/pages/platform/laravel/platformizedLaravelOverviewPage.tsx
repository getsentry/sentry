import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export function PlatformizedLaravelOverviewPage() {
  return <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.LARAVEL_OVERVIEW} />;
}
