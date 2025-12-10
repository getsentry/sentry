import {DataCategory} from 'sentry/types/core';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';

export function PlatformizedHttpOverview() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  return (
    <ModulePageProviders
      moduleName="http"
      maxPickableDays={maxPickableDays.maxPickableDays}
    >
      <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.HTTP} />
    </ModulePageProviders>
  );
}
