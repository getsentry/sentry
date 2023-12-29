import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FeatureBadge from 'sentry/components/featureBadge';
import SelectControl, {
  ControlProps,
} from 'sentry/components/forms/controls/selectControl';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
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
import {useBrowserSort} from 'sentry/views/performance/browser/useBrowserSort';
import {useInteractionElementQuery} from 'sentry/views/performance/browser/useInteractionElementQuery';
import {usePagesQuery} from 'sentry/views/performance/browser/usePageQuery';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';

const {COMPONENT, PAGE, TRANSACTION_OP} = BrowserStarfishFields;

type Option = {
  label: string;
  value: string;
};

function InteractionsLandingPage() {
  const organization = useOrganization();
  const filters = useBrowserModuleFilters();
  const sort = useBrowserSort();

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
        <Layout.Main fullWidth>
          <PaddedContainer>
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <DatePageFilter />
            </PageFilterBar>
          </PaddedContainer>

          <FilterOptionsContainer>
            <ComponentSelector value={filters[COMPONENT] || ''} />
            <ActionSelector value={filters[TRANSACTION_OP] || ''} />
            <PageSelector value={filters[PAGE] || ''} />
          </FilterOptionsContainer>

          <InteractionsTable sort={sort} />
        </Layout.Main>
      </Layout.Body>
    </ModulePageProviders>
  );
}

function ComponentSelector({value}: {value?: string}) {
  const location = useLocation();

  const {data, isLoading} = useInteractionElementQuery();

  const options: Option[] =
    !isLoading && data.length
      ? [
          {label: 'All', value: ''},
          ...data.map(element => ({
            label: element,
            value: element,
          })),
        ]
      : [];

  return (
    <SelectControlWithProps
      inFieldLabel={`${t('Component')}:`}
      options={options}
      value={value}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [COMPONENT]: newValue?.value,
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
    {value: 'ui.action.click', label: 'Click'},
    {value: 'ui.action.right.click', label: 'Right Click'},
  ];
  return (
    <SelectControlWithProps
      inFieldLabel={`${t('Action')}:`}
      options={options}
      value={value}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [TRANSACTION_OP]: newValue?.value,
          },
        });
      }}
    />
  );
}

function PageSelector({value}: {value?: string}) {
  const location = useLocation();

  const {data: pages, isLoading} = usePagesQuery();

  const options: Option[] =
    !isLoading && pages.length
      ? [
          {label: 'All', value: ''},
          ...pages.map(page => ({
            value: page,
            label: page,
          })),
        ]
      : [];

  return (
    <SelectControlWithProps
      inFieldLabel={`${t('Page')}:`}
      options={options}
      value={value}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [PAGE]: newValue?.value,
          },
        });
      }}
    />
  );
}

function SelectControlWithProps(props: ControlProps & {options: Option[]}) {
  return <SelectControl {...props} />;
}

export const PaddedContainer = styled('div')`
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
