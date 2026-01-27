import {DataCategory} from 'sentry/types/core';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';

export default function PlatformizedAgentsOverview() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  return (
    <ModulePageProviders
      moduleName="agents-landing"
      maxPickableDays={maxPickableDays.maxPickableDays}
      analyticEventName="insight.page_loads.vital"
    >
      <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.AGENTS_LANDING} />
    </ModulePageProviders>
  );
}
