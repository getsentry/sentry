import {Fragment, MouseEventHandler} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import SwitchButton from 'sentry/components/switchButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {RateUnits} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import ResourceTable from 'sentry/views/performance/browser/resources/jsCssView/resourceTable';
import SelectControlWithProps from 'sentry/views/performance/browser/resources/shared/selectControlWithProps';
import {
  BrowserStarfishFields,
  useResourceModuleFilters,
} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {useResourcePagesQuery} from 'sentry/views/performance/browser/resources/utils/useResourcePagesQuery';
import {useResourceSort} from 'sentry/views/performance/browser/resources/utils/useResourceSort';
import {ModuleName} from 'sentry/views/starfish/types';
import {SpanTimeCharts} from 'sentry/views/starfish/views/spans/spanTimeCharts';
import {ModuleFilters} from 'sentry/views/starfish/views/spans/useModuleFilters';

const {
  SPAN_OP: RESOURCE_TYPE,
  SPAN_DOMAIN,
  TRANSACTION,
  RESOURCE_RENDER_BLOCKING_STATUS,
} = BrowserStarfishFields;

export const DEFAULT_RESOURCE_TYPES = ['resource.script', 'resource.css'];

type Option = {
  label: string;
  value: string;
};

function JSCSSView() {
  const filters = useResourceModuleFilters();
  const sort = useResourceSort();
  const location = useLocation();

  const spanTimeChartsFilters: ModuleFilters = {
    'span.op': `[${DEFAULT_RESOURCE_TYPES.join(',')}]`,
    ...(filters[SPAN_DOMAIN] ? {[SPAN_DOMAIN]: filters[SPAN_DOMAIN]} : {}),
  };

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
      <SpanTimeCharts
        moduleName={ModuleName.OTHER}
        appliedFilters={spanTimeChartsFilters}
        throughputUnit={RateUnits.PER_SECOND}
      />

      <FilterOptionsContainer>
        <ResourceTypeSelector value={filters[RESOURCE_TYPE] || ''} />
        <PageSelector
          value={filters[TRANSACTION] || ''}
          defaultResourceTypes={DEFAULT_RESOURCE_TYPES}
        />
        <SwitchContainer>
          <SwitchButton
            isActive={filters[RESOURCE_RENDER_BLOCKING_STATUS] === 'blocking'}
            toggle={handleBlockingToggle}
          />
          {t('Render Blocking')}
        </SwitchContainer>
      </FilterOptionsContainer>
      <ResourceTable sort={sort} defaultResourceTypes={DEFAULT_RESOURCE_TYPES} />
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

function PageSelector({
  value,
  defaultResourceTypes,
}: {
  defaultResourceTypes?: string[];
  value?: string;
}) {
  const location = useLocation();
  const {data: pages} = useResourcePagesQuery(defaultResourceTypes);

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

export const FilterOptionsContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  max-width: 800px;
`;

export default JSCSSView;
