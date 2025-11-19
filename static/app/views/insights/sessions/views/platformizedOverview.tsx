import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';

export function PlatformizedSessionsOverview() {
  return (
    <ModulePageProviders moduleName="sessions">
      <PrebuiltDashboardRenderer
        prebuiltId={PrebuiltDashboardId.FRONTEND_SESSION_HEALTH}
      />
    </ModulePageProviders>
  );
}
