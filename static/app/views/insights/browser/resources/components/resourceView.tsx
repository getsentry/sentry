import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getResourceTypeFilter} from 'sentry/views/insights/browser/common/queries/useResourcesQuery';
import RenderBlockingSelector from 'sentry/views/insights/browser/resources/components/renderBlockingSelector';
import SelectControlWithProps from 'sentry/views/insights/browser/resources/components/selectControlWithProps';
import ResourceTable from 'sentry/views/insights/browser/resources/components/tables/resourceTable';
import {
  FONT_FILE_EXTENSIONS,
  IMAGE_FILE_EXTENSIONS,
} from 'sentry/views/insights/browser/resources/constants';
import {useResourcePagesQuery} from 'sentry/views/insights/browser/resources/queries/useResourcePagesQuery';
import {Referrer} from 'sentry/views/insights/browser/resources/referrer';
import {
  DEFAULT_RESOURCE_TYPES,
  RESOURCE_THROUGHPUT_UNIT,
} from 'sentry/views/insights/browser/resources/settings';
import {ResourceSpanOps} from 'sentry/views/insights/browser/resources/types';
import {
  BrowserStarfishFields,
  useResourceModuleFilters,
} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {useResourceSort} from 'sentry/views/insights/browser/resources/utils/useResourceSort';
import {useHasDataTrackAnalytics} from 'sentry/views/insights/common/utils/useHasDataTrackAnalytics';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {SpanTimeCharts} from 'sentry/views/insights/common/views/spans/spanTimeCharts';
import type {ModuleFilters} from 'sentry/views/insights/common/views/spans/useModuleFilters';
import {ModuleName} from 'sentry/views/insights/types';

const {
  SPAN_OP: RESOURCE_TYPE,
  SPAN_DOMAIN,
  TRANSACTION,
  RESOURCE_RENDER_BLOCKING_STATUS,
} = BrowserStarfishFields;

type Option = {
  label: string | React.ReactElement;
  value: string;
};

function ResourceView() {
  const filters = useResourceModuleFilters();
  const sort = useResourceSort();

  const spanTimeChartsFilters: ModuleFilters = {
    'span.op': `[${DEFAULT_RESOURCE_TYPES.join(',')}]`,
    ...(filters[SPAN_DOMAIN] ? {[SPAN_DOMAIN]: filters[SPAN_DOMAIN]} : {}),
  };

  const extraQuery = getResourceTypeFilter(undefined, DEFAULT_RESOURCE_TYPES);

  useHasDataTrackAnalytics(
    MutableSearch.fromQueryObject({
      'span.op': `[${DEFAULT_RESOURCE_TYPES.join(',')}]`,
    }),
    Referrer.RESOURCE_LANDING,
    'insight.page_loads.assets'
  );

  return (
    <Fragment>
      <SpanTimeChartsContainer>
        <SpanTimeCharts
          moduleName={ModuleName.RESOURCE}
          appliedFilters={spanTimeChartsFilters}
          throughputUnit={RESOURCE_THROUGHPUT_UNIT}
          extraQuery={extraQuery}
        />
      </SpanTimeChartsContainer>

      <FilterOptionsContainer columnCount={3}>
        <ResourceTypeSelector value={filters[RESOURCE_TYPE] || ''} />
        <TransactionSelector
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
  const organization = useOrganization();
  const hasImageView = organization.features.includes('insights-initial-modules');

  const options: Option[] = [
    {value: '', label: 'All'},
    {value: 'resource.script', label: `${t('JavaScript')} (.js)`},
    {value: 'resource.css', label: `${t('Stylesheet')} (.css)`},
    {
      value: 'resource.font',
      label: `${t('Font')} (${FONT_FILE_EXTENSIONS.map(e => `.${e}`).join(', ')})`,
    },
    ...(hasImageView
      ? [
          {
            value: ResourceSpanOps.IMAGE,
            label: `${t('Image')} (${IMAGE_FILE_EXTENSIONS.map(e => `.${e}`).join(', ')})`,
          },
        ]
      : []),
  ];

  return (
    <SelectControlWithProps
      inFieldLabel={`${t('Type')}:`}
      options={options}
      value={value}
      onChange={newValue => {
        trackAnalytics('insight.asset.filter_by_type', {
          organization,
          filter: newValue?.value,
        });
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [RESOURCE_TYPE]: newValue?.value,
            [QueryParameterNames.SPANS_CURSOR]: undefined,
          },
        });
      }}
    />
  );
}

export function TransactionSelector({
  value,
  defaultResourceTypes,
}: {
  defaultResourceTypes?: string[];
  value?: string;
}) {
  const [state, setState] = useState({
    search: '',
    inputChanged: false,
    shouldRequeryOnInputChange: false,
  });
  const location = useLocation();
  const organization = useOrganization();

  const {data: pages, isLoading} = useResourcePagesQuery(
    defaultResourceTypes,
    state.search
  );

  // If the maximum number of pages is returned, we need to requery on input change to get full results
  if (!state.shouldRequeryOnInputChange && pages && pages.length >= 100) {
    setState({...state, shouldRequeryOnInputChange: true});
  }

  // Everytime loading is complete, reset the inputChanged state
  useEffect(() => {
    if (!isLoading && state.inputChanged) {
      setState({...state, inputChanged: false});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const optionsReady = !isLoading && !state.inputChanged;

  const options: Option[] = optionsReady
    ? [{value: '', label: 'All'}, ...pages.map(page => ({value: page, label: page}))]
    : [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceUpdateSearch = useCallback(
    debounce((search, currentState) => {
      setState({...currentState, search});
    }, 500),
    []
  );

  return (
    <SelectControlWithProps
      inFieldLabel={`${t('Page')}:`}
      options={options}
      value={value}
      onInputChange={input => {
        if (state.shouldRequeryOnInputChange) {
          setState({...state, inputChanged: true});
          debounceUpdateSearch(input, state);
        }
      }}
      noOptionsMessage={() => (optionsReady ? undefined : t('Loading...'))}
      onChange={newValue => {
        trackAnalytics('insight.asset.filter_by_page', {
          organization,
        });
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [TRANSACTION]: newValue?.value,
            [QueryParameterNames.SPANS_CURSOR]: undefined,
          },
        });
      }}
    />
  );
}

export const SpanTimeChartsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

export const FilterOptionsContainer = styled('div')<{columnCount: number}>`
  display: grid;
  grid-template-columns: repeat(${props => props.columnCount}, 1fr);
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  max-width: 800px;
`;

export default ResourceView;
