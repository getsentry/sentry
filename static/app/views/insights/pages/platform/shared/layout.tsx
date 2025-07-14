import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoAccess} from 'sentry/components/noAccess';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import TransactionNameSearchBar from 'sentry/components/performance/searchBar';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {BACKEND_LANDING_TITLE} from 'sentry/views/insights/pages/backend/settings';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {FRONTEND_LANDING_TITLE} from 'sentry/views/insights/pages/frontend/settings';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {LegacyOnboarding} from 'sentry/views/performance/onboarding';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';

function getFreeTextFromQuery(query: string) {
  const conditions = new MutableSearch(query);
  const transactionValues = conditions.getFilterValues('transaction');
  if (transactionValues.length) {
    return transactionValues[0];
  }
  if (conditions.freeText.length > 0) {
    // raw text query will be wrapped in wildcards in generatePerformanceEventView
    // so no need to wrap it here
    return conditions.freeText.join(' ');
  }
  return '';
}

export function PlatformLandingPageLayout({
  children,
  performanceType,
}: {
  children: React.ReactNode;
  performanceType: 'backend' | 'frontend';
}) {
  const location = useLocation();
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();

  const showOnboarding = onboardingProject !== undefined;

  const {query, eventView, handleSearch} = useTransactionNameQuery();
  const searchBarQuery = getTransactionSearchQuery(location, eventView.query);

  return (
    <Feature
      features="performance-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      {performanceType === 'backend' ? (
        <BackendHeader headerTitle={BACKEND_LANDING_TITLE} />
      ) : (
        <FrontendHeader headerTitle={FRONTEND_LANDING_TITLE} />
      )}
      <Layout.Body>
        <Layout.Main fullWidth>
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <ToolRibbon>
                <PageFilterBar condensed>
                  <InsightsProjectSelector />
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </PageFilterBar>
                {!showOnboarding && (
                  <StyledTransactionNameSearchBar
                    // Force the search bar to re-render when the derivedQuery changes
                    // The seach bar component holds internal state that is not updated when the query prop changes
                    key={query}
                    organization={organization}
                    eventView={eventView}
                    onSearch={handleSearch}
                    query={getFreeTextFromQuery(searchBarQuery)!}
                  />
                )}
              </ToolRibbon>
            </ModuleLayout.Full>
            <ModuleLayout.Full>
              {!showOnboarding && children}
              {showOnboarding && (
                <LegacyOnboarding
                  project={onboardingProject}
                  organization={organization}
                />
              )}
            </ModuleLayout.Full>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </Feature>
  );
}

const StyledTransactionNameSearchBar = styled(TransactionNameSearchBar)`
  flex: 2;
`;
