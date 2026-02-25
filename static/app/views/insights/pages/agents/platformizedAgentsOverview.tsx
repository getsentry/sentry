import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export function PlatformizedAgentsOverview() {
  return (
    <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.AI_AGENTS_OVERVIEW} />
  );
}
