import type {ReactNode} from 'react';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {OVERVIEW_PAGE_TITLE} from 'sentry/views/insights/pages/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

interface DomainOverviewPageProvidersProps {
  children: ReactNode;
  maxPickableDays: DatePageFilterProps['maxPickableDays'];
}

export function DomainOverviewPageProviders({
  children,
  maxPickableDays,
}: DomainOverviewPageProvidersProps) {
  const organization = useOrganization();
  const location = useLocation();
  const {view} = useDomainViewFilters();

  return (
    <NoProjectMessage organization={organization}>
      <PageFiltersContainer maxPickableDays={maxPickableDays} storageNamespace={view}>
        <SentryDocumentTitle title={OVERVIEW_PAGE_TITLE} orgSlug={organization.slug}>
          <MEPSettingProvider location={location}>{children}</MEPSettingProvider>
        </SentryDocumentTitle>
      </PageFiltersContainer>
    </NoProjectMessage>
  );
}
