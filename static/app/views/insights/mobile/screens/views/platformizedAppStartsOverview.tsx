import {DataCategory} from 'sentry/types/core';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {useTransactionGlobalFilters} from 'sentry/views/insights/mobile/screens/utils/useTransactionDashboardFilters';
import {ModuleName} from 'sentry/views/insights/types';

export function PlatformizedAppStartsOverview() {
  const additionalGlobalFilters = useTransactionGlobalFilters();
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  return (
    <ModulePageProviders
      moduleName={ModuleName.MOBILE_VITALS}
      maxPickableDays={maxPickableDays.maxPickableDays}
    >
      <PrebuiltDashboardRenderer
        prebuiltId={PrebuiltDashboardId.MOBILE_VITALS_APP_STARTS}
        additionalGlobalFilters={additionalGlobalFilters}
      />
    </ModulePageProviders>
  );
}
