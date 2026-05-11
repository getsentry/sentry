import {DataCategory} from 'sentry/types/core';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleName} from 'sentry/views/insights/types';

export function PlatformizedMobileVitalsOverview() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  return (
    <ModulePageProviders
      moduleName={ModuleName.MOBILE_VITALS}
      maxPickableDays={maxPickableDays.maxPickableDays}
    >
      <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.MOBILE_VITALS} />
    </ModulePageProviders>
  );
}
