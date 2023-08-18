import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import DatePageFilter from 'sentry/components/datePageFilter';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';
import {ModuleName, SpanMetricsFields} from 'sentry/views/starfish/types';
import {ActionSelector} from 'sentry/views/starfish/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';
import SpansTable from 'sentry/views/starfish/views/spans/spansTable';
import {SpanTimeCharts} from 'sentry/views/starfish/views/spans/spanTimeCharts';
import {useModuleFilters} from 'sentry/views/starfish/views/spans/useModuleFilters';
import {useModuleSort} from 'sentry/views/starfish/views/spans/useModuleSort';

function DatabaseLandingPage() {
  const organization = useOrganization();
  const moduleName = ModuleName.DB;

  const moduleFilters = useModuleFilters();
  const sort = useModuleSort();

  return (
    <ModulePageProviders title={[t('Performance'), t('Database')].join(' — ')}>
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
                label: 'Database',
              },
            ]}
          />

          <Layout.Title>
            {t('Database')}
            <FeatureBadge type="alpha" />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <PaddedContainer>
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <DatePageFilter alignDropdown="left" />
            </PageFilterBar>
          </PaddedContainer>

          <SpanTimeCharts moduleName={moduleName} appliedFilters={moduleFilters} />

          <FilterOptionsContainer>
            <ActionSelector
              moduleName={moduleName}
              value={moduleFilters[SpanMetricsFields.SPAN_ACTION] || ''}
            />

            <DomainSelector
              moduleName={moduleName}
              value={moduleFilters[SpanMetricsFields.SPAN_DOMAIN] || ''}
            />
          </FilterOptionsContainer>

          <SpansTable moduleName={moduleName} sort={sort} limit={LIMIT} />
        </Layout.Main>
      </Layout.Body>
    </ModulePageProviders>
  );
}

const PaddedContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const FilterOptionsContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  max-width: 800px;
`;

const LIMIT: number = 25;

export default DatabaseLandingPage;
