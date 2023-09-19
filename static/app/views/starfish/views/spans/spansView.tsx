import {Fragment} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {ActionSelector} from 'sentry/views/starfish/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';
import {SpanOperationSelector} from 'sentry/views/starfish/views/spans/selectors/spanOperationSelector';
import {SpanTimeCharts} from 'sentry/views/starfish/views/spans/spanTimeCharts';
import {useModuleFilters} from 'sentry/views/starfish/views/spans/useModuleFilters';
import {useModuleSort} from 'sentry/views/starfish/views/spans/useModuleSort';

import SpansTable from './spansTable';

const {SPAN_ACTION, SPAN_DOMAIN, SPAN_OP} = SpanMetricsField;

const LIMIT: number = 25;

type Props = {
  moduleName?: ModuleName;
  spanCategory?: string;
};

export default function SpansView(props: Props) {
  const moduleName = props.moduleName ?? ModuleName.ALL;

  const moduleFilters = useModuleFilters();
  const sort = useModuleSort(QueryParameterNames.SPANS_SORT);

  return (
    <Fragment>
      <SpanTimeCharts
        moduleName={moduleName}
        appliedFilters={moduleFilters}
        spanCategory={props.spanCategory}
      />

      <FilterOptionsContainer>
        {/* Specific modules like Database and API only show _one_ kind of span
        op based on how we group them. So, the operation selector is pointless
        there. */}
        {[ModuleName.ALL, ModuleName.OTHER].includes(moduleName) && (
          <SpanOperationSelector
            moduleName={moduleName}
            value={moduleFilters[SPAN_OP] || ''}
            spanCategory={props.spanCategory}
          />
        )}

        <ActionSelector
          moduleName={moduleName}
          value={moduleFilters[SPAN_ACTION] || ''}
          spanCategory={props.spanCategory}
        />

        <DomainSelector
          moduleName={moduleName}
          value={moduleFilters[SPAN_DOMAIN] || ''}
          spanCategory={props.spanCategory}
        />
      </FilterOptionsContainer>

      <SpansTable
        moduleName={moduleName}
        spanCategory={props.spanCategory}
        sort={sort}
        limit={LIMIT}
      />
    </Fragment>
  );
}

const FilterOptionsContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  max-width: 800px;
`;
