import {DataCategory} from 'sentry/types/core';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {ModuleName} from 'sentry/views/insights/types';

function McpResourcesLandingPage() {
  const {view} = useDomainViewFilters();

  return (
    <PrebuiltDashboardRenderer
      prebuiltId={PrebuiltDashboardId.MCP_RESOURCES}
      storageNamespace={view}
    />
  );
}

function PageWithProviders() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <ModulePageProviders
      moduleName={ModuleName.MCP_RESOURCES}
      analyticEventName="insight.page_loads.mcp_resources"
      maxPickableDays={datePageFilterProps.maxPickableDays}
    >
      <McpResourcesLandingPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
