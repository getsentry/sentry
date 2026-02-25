import {DataCategory} from 'sentry/types/core';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleName} from 'sentry/views/insights/types';

export function PlatformizedModelsOverview() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  return (
    <ModulePageProviders
      moduleName={ModuleName.AGENT_MODELS}
      maxPickableDays={maxPickableDays.maxPickableDays}
    >
      <PrebuiltDashboardRenderer prebuiltId={PrebuiltDashboardId.AI_AGENTS_MODELS} />
    </ModulePageProviders>
  );
}
