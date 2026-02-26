import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export function PlatformizedToolsOverview() {
  return <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.AI_AGENTS_TOOLS} />;
}
