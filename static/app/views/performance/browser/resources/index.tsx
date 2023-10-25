import {MouseEventHandler} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import FeatureBadge from 'sentry/components/featureBadge';
import SelectControl, {
  ControlProps,
} from 'sentry/components/forms/controls/selectControl';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SwitchButton from 'sentry/components/switchButton';
import {TabList, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {ResourceSidebar} from 'sentry/views/performance/browser/resources/resourceSidebar';
import ResourceTable from 'sentry/views/performance/browser/resources/resourceTable';
import {useResourceDomainsQuery} from 'sentry/views/performance/browser/resources/utils/useResourceDomansQuery';
import {
  BrowserStarfishFields,
  useResourceModuleFilters,
} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {useResourcePagesQuery} from 'sentry/views/performance/browser/resources/utils/useResourcePagesQuery';
import {useResourceSort} from 'sentry/views/performance/browser/resources/utils/useResourceSort';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';

const {
  RESOURCE_TYPE,
  SPAN_DOMAIN,
  TRANSACTION,
  DESCRIPTION,
  RESOURCE_RENDER_BLOCKING_STATUS,
} = BrowserStarfishFields;

type Option = {
  label: string;
  value: string;
};

function ResourcesLandingPage() {
  const organization = useOrganization();
  const filters = useResourceModuleFilters();
  const sort = useResourceSort();
  const location = useLocation();

  const handleBlockingToggle: MouseEventHandler = () => {
    const hasBlocking = filters[RESOURCE_RENDER_BLOCKING_STATUS] === 'blocking';
    const newBlocking = hasBlocking ? undefined : 'blocking';
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        [RESOURCE_RENDER_BLOCKING_STATUS]: newBlocking,
      },
    });
  };

  return (
    <ModulePageProviders title={[t('Performance'), t('Resources')].join(' — ')}>
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

          <Layout.Title>
            {t('Resources')}
            <FeatureBadge type="alpha" />
          </Layout.Title>
        </Layout.HeaderContent>
        <StyledTabs>
          <TabList hideBorder>
            <TabList.Item key="resource.css/script">
              {t('JavaScript/Style sheets')}
            </TabList.Item>
            <TabList.Item key="resource.img">{t('Images')}</TabList.Item>
          </TabList>
        </StyledTabs>
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
            <DomainSelector value={filters[SPAN_DOMAIN] || ''} />
            <ResourceTypeSelector value={filters[RESOURCE_TYPE] || ''} />
            <PageSelector value={filters[TRANSACTION] || ''} />
            <SwitchContainer>
              <SwitchButton
                isActive={filters[RESOURCE_RENDER_BLOCKING_STATUS] === 'blocking'}
                toggle={handleBlockingToggle}
              />
              {t('Render Blocking')}
            </SwitchContainer>
          </FilterOptionsContainer>
          <ResourceTable sort={sort} />
          <ResourceSidebar groupId={filters[DESCRIPTION]} />
        </Layout.Main>
      </Layout.Body>
    </ModulePageProviders>
  );
}

function DomainSelector({value}: {value?: string}) {
  const location = useLocation();
  const {data} = useResourceDomainsQuery();

  const options: Option[] = [
    {value: '', label: 'All'},
    ...data.map(domain => ({
      value: domain,
      label: domain,
    })),
  ];

  return (
    <SelectControlWithProps
      inFieldLabel={`${t('Domain')}:`}
      options={options}
      value={value}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [SPAN_DOMAIN]: newValue?.value,
          },
        });
      }}
    />
  );
}

function ResourceTypeSelector({value}: {value?: string}) {
  const location = useLocation();

  const options: Option[] = [
    {value: '', label: 'All'},
    {value: 'resource.script', label: `${t('JavaScript')} (.js)`},
    {value: 'resource.css', label: `${t('Stylesheet')} (.css)`},
  ];
  return (
    <SelectControlWithProps
      inFieldLabel={`${t('Type')}:`}
      options={options}
      value={value}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [RESOURCE_TYPE]: newValue?.value,
          },
        });
      }}
    />
  );
}

function PageSelector({value}: {value?: string}) {
  const location = useLocation();
  const {data: pages} = useResourcePagesQuery();

  const options: Option[] = [
    {value: '', label: 'All'},
    ...pages.map(page => ({value: page, label: page})),
  ];

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
            [TRANSACTION]: newValue?.value,
          },
        });
      }}
    />
  );
}

const SwitchContainer = styled('div')`
  display: flex;
  align-items: center;
  column-gap: ${space(1)};
`;

function SelectControlWithProps(props: ControlProps & {options: Option[]}) {
  return <SelectControl {...props} />;
}

export const PaddedContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledTabs = styled(Tabs)`
  grid-column: 1/-1;
`;

const FilterOptionsContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  max-width: 800px;
`;

export default ResourcesLandingPage;
