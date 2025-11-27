import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';

export function PlatformizedQuerySummaryPage() {
  return (
    <ModulePageProviders moduleName="db">
      <PrebuiltDashboardRenderer
        prebuiltId={PrebuiltDashboardId.BACKEND_QUERIES_SUMMARY}
      />
    </ModulePageProviders>
  );
}
