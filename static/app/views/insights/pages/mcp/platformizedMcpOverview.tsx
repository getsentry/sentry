import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export function PlatformizedMcpOverview() {
  return <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.MCP_OVERVIEW} />;
}
