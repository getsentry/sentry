import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {RESOURCE_THROUGHPUT_UNIT} from 'sentry/views/performance/browser/resources';
import ResourceTable from 'sentry/views/performance/browser/resources/jsCssView/resourceTable';
import RenderBlockingSelector from 'sentry/views/performance/browser/resources/shared/renderBlockingSelector';
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

  const spanTimeChartsFilters: ModuleFilters = {
    'span.op': `[${DEFAULT_RESOURCE_TYPES.join(',')}]`,
    ...(filters[SPAN_DOMAIN] ? {[SPAN_DOMAIN]: filters[SPAN_DOMAIN]} : {}),
  };

  return (
    <Fragment>
      <SpanTimeCharts
        moduleName={ModuleName.OTHER}
        appliedFilters={spanTimeChartsFilters}
        throughputUnit={RESOURCE_THROUGHPUT_UNIT}
      />

      <FilterOptionsContainer>
        <ResourceTypeSelector value={filters[RESOURCE_TYPE] || ''} />
        <PageSelector
          value={filters[TRANSACTION] || ''}
          defaultResourceTypes={DEFAULT_RESOURCE_TYPES}
        />
        <RenderBlockingSelector value={filters[RESOURCE_RENDER_BLOCKING_STATUS] || ''} />
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

export const FilterOptionsContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  max-width: 800px;
`;

export default JSCSSView;
