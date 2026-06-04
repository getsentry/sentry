import {useEffect} from 'react';

import {DataCategory} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useOrganization} from 'sentry/utils/useOrganization';
import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {useShowMCPOnboarding} from 'sentry/views/insights/pages/mcp/hooks/useShowMCPOnboarding';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';

function McpOverviewPage() {
  const organization = useOrganization();
  const {view} = useDomainViewFilters();
  const showOnboarding = useShowMCPOnboarding();

  useOverviewPageTrackPageload();

  useEffect(() => {
    trackAnalytics('mcp-monitoring.page-view', {
      organization,
      isOnboarding: showOnboarding,
    });
  }, [organization, showOnboarding]);

  return (
    <PrebuiltDashboardRenderer
      prebuiltId={PrebuiltDashboardId.MCP_OVERVIEW}
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
    <DomainOverviewPageProviders maxPickableDays={datePageFilterProps.maxPickableDays}>
      <McpOverviewPage />
    </DomainOverviewPageProviders>
  );
}

export default PageWithProviders;
