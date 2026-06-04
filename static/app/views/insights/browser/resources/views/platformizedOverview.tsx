import {DataCategory} from 'sentry/types/core';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';

export function PlatformizedAssetsOverview() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  return (
    <ModulePageProviders
      moduleName="resource"
      maxPickableDays={maxPickableDays.maxPickableDays}
      analyticEventName="insight.page_loads.assets"
    >
      <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.FRONTEND_ASSETS} />
    </ModulePageProviders>
  );
}
