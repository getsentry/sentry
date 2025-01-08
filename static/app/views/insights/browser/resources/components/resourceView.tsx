import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {getResourceTypeFilter} from 'sentry/views/insights/browser/common/queries/useResourcesQuery';
import RenderBlockingSelector from 'sentry/views/insights/browser/resources/components/renderBlockingSelector';
import ResourceTable from 'sentry/views/insights/browser/resources/components/tables/resourceTable';
import {
  FONT_FILE_EXTENSIONS,
  IMAGE_FILE_EXTENSIONS,
} from 'sentry/views/insights/browser/resources/constants';
import {DEFAULT_RESOURCE_TYPES} from 'sentry/views/insights/browser/resources/settings';
import {ResourceSpanOps} from 'sentry/views/insights/browser/resources/types';
import {
  BrowserStarfishFields,
  useResourceModuleFilters,
} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {useResourceSort} from 'sentry/views/insights/browser/resources/utils/useResourceSort';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {TransactionSelector} from 'sentry/views/insights/common/views/spans/selectors/transactionSelector';
import type {ModuleFilters} from 'sentry/views/insights/common/views/spans/useModuleFilters';

import {ResourceLandingPageCharts} from './charts/resourceLandingPageCharts';

const {
  SPAN_OP: RESOURCE_TYPE,
  SPAN_DOMAIN,
  TRANSACTION,
  RESOURCE_RENDER_BLOCKING_STATUS,
  USER_GEO_SUBREGION,
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

  const extraQuery = [
    ...getResourceTypeFilter(undefined, DEFAULT_RESOURCE_TYPES),
    ...(filters[USER_GEO_SUBREGION]
      ? [`user.geo.subregion:[${filters[USER_GEO_SUBREGION].join(',')}]`]
      : []),
  ];

  return (
    <Fragment>
      <SpanTimeChartsContainer>
        <ResourceLandingPageCharts
          appliedFilters={spanTimeChartsFilters}
          extraQuery={extraQuery}
        />
      </SpanTimeChartsContainer>

      <DropdownContainer>
        <ResourceTypeSelector value={filters[RESOURCE_TYPE] || ''} />
        <TransactionSelector
          value={filters[TRANSACTION] || ''}
          defaultResourceTypes={DEFAULT_RESOURCE_TYPES}
        />
        <RenderBlockingSelector value={filters[RESOURCE_RENDER_BLOCKING_STATUS] || ''} />
      </DropdownContainer>
      <ResourceTable sort={sort} defaultResourceTypes={DEFAULT_RESOURCE_TYPES} />
    </Fragment>
  );
}

function ResourceTypeSelector({value}: {value?: string}) {
  const navigate = useNavigate();
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
    <CompactSelect
      style={{maxWidth: '200px'}}
      triggerProps={{prefix: `${t('Type')}`}}
      options={options}
      value={value ?? ''}
      onChange={newValue => {
        trackAnalytics('insight.asset.filter_by_type', {
          organization,
          filter: newValue?.value,
        });
        navigate({
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

export const SpanTimeChartsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const DropdownContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  flex-wrap: wrap;
`;

export default ResourceView;
