import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import DatePageFilter from 'sentry/components/datePageFilter';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {useSpanList} from 'sentry/views/starfish/queries/useSpanList';
import {ModuleName} from 'sentry/views/starfish/types';
import {ActionSelector} from 'sentry/views/starfish/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';
import {SpanOperationSelector} from 'sentry/views/starfish/views/spans/selectors/spanOperationSelector';
import {SpanTimeCharts} from 'sentry/views/starfish/views/spans/spanTimeCharts';

import SpansTable from './spansTable';

const LIMIT: number = 25;

type Props = {
  moduleName?: ModuleName;
};

type State = {
  orderBy: string;
};

type Query = {
  action: string;
  domain: string;
  group_id: string;
  span_operation: string;
};

export default function SpansView(props: Props) {
  const location = useLocation<Query>();
  const appliedFilters = location.query;
  const [state, setState] = useState<State>({orderBy: 'total_exclusive_time'});

  const {orderBy} = state;

  const {isLoading: areSpansLoading, data: spansData} = useSpanList(
    props.moduleName ?? ModuleName.ALL,
    undefined,
    orderBy,
    LIMIT
  );

  return (
    <Fragment>
      <FilterOptionsContainer>
        <DatePageFilter alignDropdown="left" />

        <SpanOperationSelector
          moduleName={props.moduleName}
          value={appliedFilters.span_operation || ''}
        />

        <DomainSelector
          moduleName={props.moduleName}
          value={appliedFilters.domain || ''}
        />

        <ActionSelector
          moduleName={props.moduleName}
          value={appliedFilters.action || ''}
        />
      </FilterOptionsContainer>

      <PaddedContainer>
        <SpanTimeCharts
          moduleName={props.moduleName || ModuleName.ALL}
          appliedFilters={appliedFilters}
        />
      </PaddedContainer>

      <PaddedContainer>
        <SpansTable
          moduleName={props.moduleName || ModuleName.ALL}
          isLoading={areSpansLoading}
          spansData={spansData}
          orderBy={orderBy}
          onSetOrderBy={newOrderBy => setState({orderBy: newOrderBy})}
        />
      </PaddedContainer>
    </Fragment>
  );
}

const PaddedContainer = styled('div')`
  margin: ${space(2)};
`;

const FilterOptionsContainer = styled(PaddedContainer)`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;

const SPAN_FILTER_KEYS = ['span_operation', 'domain', 'action'];

export const buildQueryConditions = (moduleName: ModuleName, location: Location) => {
  const {query} = location;
  const result = Object.keys(query)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    .filter(key => Boolean(query[key]))
    .map(key => {
      return `${key} = '${query[key]}'`;
    });

  if (moduleName !== ModuleName.ALL) {
    result.push(`module = '${moduleName}'`);
  }

  return result;
};
