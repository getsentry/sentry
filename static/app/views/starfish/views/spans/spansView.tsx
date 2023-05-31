import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import _orderBy from 'lodash/orderBy';

import DatePageFilter from 'sentry/components/datePageFilter';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ModuleName} from 'sentry/views/starfish/types';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {ActionSelector} from 'sentry/views/starfish/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';
import {SpanOperationSelector} from 'sentry/views/starfish/views/spans/selectors/spanOperationSelector';
import {SpanTimeCharts} from 'sentry/views/starfish/views/spans/spanTimeCharts';

import {getSpanListQuery, getSpansTrendsQuery} from './queries';
import type {SpanDataRow, SpanTrendDataRow} from './spansTable';
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
  const pageFilter = usePageFilters();
  const [state, setState] = useState<State>({orderBy: 'total_exclusive_time'});

  const {orderBy} = state;

  const queryConditions = buildQueryConditions(
    props.moduleName || ModuleName.ALL,
    location
  );
  const query = getSpanListQuery(
    pageFilter.selection.datetime,
    queryConditions,
    orderBy,
    LIMIT
  );

  const {isLoading: areSpansLoading, data: spansData} = useQuery<SpanDataRow[]>({
    queryKey: ['spans', query],
    queryFn: () => fetch(`${HOST}/?query=${query}&format=sql`).then(res => res.json()),
    retry: false,
    refetchOnWindowFocus: false,
    initialData: [],
  });

  const groupIDs = spansData.map(({group_id}) => group_id);

  const {isLoading: areSpansTrendsLoading, data: spansTrendsData} = useQuery<
    SpanTrendDataRow[]
  >({
    queryKey: ['spansTrends'],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getSpansTrendsQuery(pageFilter.selection.datetime, groupIDs)}`
      ).then(res => res.json()),
    retry: false,
    refetchOnWindowFocus: false,
    initialData: [],
    enabled: groupIDs.length > 0,
  });

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
          isLoading={areSpansLoading || areSpansTrendsLoading}
          spansData={spansData}
          orderBy={orderBy}
          onSetOrderBy={newOrderBy => setState({orderBy: newOrderBy})}
          spansTrendsData={spansTrendsData}
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
