import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import type {InsightEventKey} from 'sentry/utils/analytics/insightAnalyticEvents';
import useOrganization from 'sentry/utils/useOrganization';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {useHasDataTrackAnalytics} from 'sentry/views/insights/common/utils/useHasDataTrackAnalytics';
import {useModuleTitles} from 'sentry/views/insights/common/utils/useModuleTitle';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {
  INSIGHTS_TITLE,
  OLD_QUERY_DATE_RANGE_LIMIT,
  QUERY_DATE_RANGE_LIMIT,
} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';

type ModuleNameStrings = `${ModuleName}`;
export type TitleableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

interface Props {
  children: React.ReactNode;
  moduleName: TitleableModuleNames;
  analyticEventName?: InsightEventKey;
  pageTitle?: string;
}

export function ModulePageProviders({
  moduleName,
  pageTitle,
  children,
  analyticEventName,
}: Props) {
  const organization = useOrganization();
  const moduleTitles = useModuleTitles();
  const {view} = useDomainViewFilters();

  const hasDateRangeQueryLimit = organization.features.includes(
    'insights-query-date-range-limit'
  );
  const shouldIncreaseDefaultDateRange = organization.features.includes(
    'dashboards-plan-limits'
  );
  const defaultPickableDays = shouldIncreaseDefaultDateRange
    ? QUERY_DATE_RANGE_LIMIT
    : OLD_QUERY_DATE_RANGE_LIMIT;

  useHasDataTrackAnalytics(moduleName as ModuleName, analyticEventName);

  const moduleTitle = moduleTitles[moduleName];

  const fullPageTitle = [pageTitle, moduleTitle, INSIGHTS_TITLE]
    .filter(Boolean)
    .join(' — ');

  return (
    <PageFiltersContainer
      maxPickableDays={hasDateRangeQueryLimit ? defaultPickableDays : undefined}
      storageNamespace={view}
    >
      <Layout.Page title={{title: fullPageTitle, orgSlug: organization.slug}}>
        <NoProjectMessage organization={organization}>
          <WidgetSyncContextProvider>{children}</WidgetSyncContextProvider>
        </NoProjectMessage>
      </Layout.Page>
    </PageFiltersContainer>
  );
}
