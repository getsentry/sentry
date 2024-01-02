import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {RateUnits} from 'sentry/utils/discover/fields';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import ResourceView, {
  DEFAULT_RESOURCE_TYPES,
  FilterOptionsContainer,
} from 'sentry/views/performance/browser/resources/resourceView';
import {
  BrowserStarfishFields,
  useResourceModuleFilters,
} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {DEFAULT_RESOURCE_FILTERS} from 'sentry/views/performance/browser/resources/utils/useResourcesQuery';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';

const {SPAN_OP, SPAN_DOMAIN} = BrowserStarfishFields;

export const RESOURCE_THROUGHPUT_UNIT = RateUnits.PER_MINUTE;

function ResourcesLandingPage() {
  const organization = useOrganization();
  const filters = useResourceModuleFilters();

  return (
    <ModulePageProviders
      title={[t('Performance'), t('Resources')].join(' — ')}
      baseURL="/performance/browser/resources"
    >
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: 'Performance',
                  to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                  preservePageFilters: true,
                },
                {
                  label: 'Resources',
                },
              ]}
            />

            <Layout.Title>{t('Resources')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <FloatingFeedbackWidget />
            <PageErrorAlert />
            <FilterOptionsContainer columnCount={2}>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
              <DomainSelector
                emptyOptionLocation="top"
                value={filters[SPAN_DOMAIN] || ''}
                additionalQuery={[
                  ...DEFAULT_RESOURCE_FILTERS,
                  `${SPAN_OP}:[${DEFAULT_RESOURCE_TYPES.join(',')}]`,
                ]}
              />
            </FilterOptionsContainer>
            <ResourceView />
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </ModulePageProviders>
  );
}

export const PaddedContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

export default ResourcesLandingPage;
