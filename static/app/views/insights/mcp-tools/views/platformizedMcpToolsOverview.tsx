import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export function PlatformizedMcpToolsOverview() {
  return <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.MCP_TOOLS} />;
}
