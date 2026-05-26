import {DataCategory} from 'sentry/types/core';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {ModuleName} from 'sentry/views/insights/types';

function McpToolsLandingPage() {
  const {view} = useDomainViewFilters();

  return (
    <PrebuiltDashboardRenderer
      prebuiltId={PrebuiltDashboardId.MCP_TOOLS}
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
      moduleName={ModuleName.MCP_TOOLS}
      analyticEventName="insight.page_loads.mcp_tools"
      maxPickableDays={datePageFilterProps.maxPickableDays}
    >
      <McpToolsLandingPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
