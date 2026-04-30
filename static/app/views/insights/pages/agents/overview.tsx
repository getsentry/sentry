import {DataCategory} from 'sentry/types/core';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {DomainOverviewPageProviders} from 'sentry/views/insights/pages/domainOverviewPageProviders';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {useOverviewPageTrackPageload} from 'sentry/views/insights/pages/useOverviewPageTrackAnalytics';

function AgentsOverviewPage() {
  const {view} = useDomainViewFilters();
  useOverviewPageTrackPageload();

  return (
    <PrebuiltDashboardRenderer
      prebuiltId={PrebuiltDashboardId.AI_AGENTS_OVERVIEW}
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
      <AgentsOverviewPage />
    </DomainOverviewPageProviders>
  );
}

export default PageWithProviders;
