import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export function PlatformizedNextjsFrontendOverviewPage() {
  return (
    <PrebuiltDashboardRenderer
      prebuiltId={PrebuiltDashboardId.NEXTJS_FRONTEND_OVERVIEW}
    />
  );
}
