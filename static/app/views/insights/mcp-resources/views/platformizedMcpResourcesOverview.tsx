import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export function PlatformizedMcpResourcesOverview() {
  return <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.MCP_RESOURCES} />;
}
