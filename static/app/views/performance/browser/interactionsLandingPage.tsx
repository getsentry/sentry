import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import DatePageFilter from 'sentry/components/datePageFilter';
import FeatureBadge from 'sentry/components/featureBadge';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import InteractionsTable from 'sentry/views/performance/browser/interactionTable';
import {
  BrowserStarfishFields,
  useBrowserModuleFilters,
} from 'sentry/views/performance/browser/useBrowserFilters';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';

const {COMPONENT, PAGE, SPAN_ACTION} = BrowserStarfishFields;

type Option = {
  label: string;
  value: string;
};

function InteractionsLandingPage() {
  const organization = useOrganization();
  const filters = useBrowserModuleFilters();

  return (
    <ModulePageProviders title={[t('Performance'), t('Interactions')].join(' — ')}>
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
                label: 'Interactions',
              },
            ]}
          />

          <Layout.Title>
            {t('Interactions')}
            <FeatureBadge type="alpha" />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth />

        <PaddedContainer>
          <PageFilterBar condensed>
            <ProjectPageFilter />
            <DatePageFilter alignDropdown="left" />
          </PageFilterBar>
        </PaddedContainer>

        <div />

        <FilterOptionsContainer>
          <ComponentSelector value={filters[COMPONENT] || ''} />
          <ActionSelector value={filters[SPAN_ACTION] || ''} />
          <PageSelector value={filters[PAGE] || ''} />
        </FilterOptionsContainer>

        <div />

        <InteractionsTable />
      </Layout.Body>
    </ModulePageProviders>
  );
}

function ComponentSelector({value}: {value?: string}) {
  const location = useLocation();

  const options: Option[] = [
    {value: '', label: 'All'},
    {value: 'downloadButton', label: '<DownloadButton/>'},
    {value: 'closeButton', label: '<CloseButton/>'},
  ];
  return (
    <SelectControl
      inFieldLabel={`${t('Component')}:`}
      options={options}
      value={value}
      onChange={(newValue: Option) => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [COMPONENT]: newValue.value,
          },
        });
      }}
    />
  );
}

function ActionSelector({value}: {value?: string}) {
  const location = useLocation();

  const options: Option[] = [
    {value: '', label: 'All'},
    {value: 'click', label: 'Click'},
    {value: 'change', label: 'Change'},
  ];
  return (
    <SelectControl
      inFieldLabel={`${t('Action')}:`}
      options={options}
      value={value}
      onChange={(newValue: Option) => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [SPAN_ACTION]: newValue.value,
          },
        });
      }}
    />
  );
}

function PageSelector({value}: {value?: string}) {
  const location = useLocation();

  const options: Option[] = [
    {value: '', label: 'All'},
    {value: '/performance', label: 'page1'},
    {value: '/page2', label: 'page2'},
  ];
  return (
    <SelectControl
      inFieldLabel={`${t('Page')}:`}
      options={options}
      value={value}
      onChange={(newValue: Option) => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [PAGE]: newValue.value,
          },
        });
      }}
    />
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

export default InteractionsLandingPage;
