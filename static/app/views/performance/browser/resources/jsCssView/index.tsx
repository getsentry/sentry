import {Fragment, MouseEventHandler} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import SelectControl, {
  ControlProps,
} from 'sentry/components/forms/controls/selectControl';
import SwitchButton from 'sentry/components/switchButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import ResourceTable from 'sentry/views/performance/browser/resources/jsCssView/resourceTable';
import {useResourceDomainsQuery} from 'sentry/views/performance/browser/resources/utils/useResourceDomansQuery';
import {
  BrowserStarfishFields,
  useResourceModuleFilters,
} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {useResourcePagesQuery} from 'sentry/views/performance/browser/resources/utils/useResourcePagesQuery';
import {useResourceSort} from 'sentry/views/performance/browser/resources/utils/useResourceSort';

const {RESOURCE_TYPE, SPAN_DOMAIN, TRANSACTION, RESOURCE_RENDER_BLOCKING_STATUS} =
  BrowserStarfishFields;

type Option = {
  label: string;
  value: string;
};

function JSCSSView() {
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
    <Fragment>
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
    </Fragment>
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

function SelectControlWithProps(props: ControlProps & {options: Option[]}) {
  return <SelectControl {...props} />;
}

const SwitchContainer = styled('div')`
  display: flex;
  align-items: center;
  column-gap: ${space(1)};
`;

export const FilterOptionsContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  max-width: 800px;
`;

export default JSCSSView;
