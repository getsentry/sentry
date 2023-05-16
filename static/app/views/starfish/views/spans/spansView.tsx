import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import _orderBy from 'lodash/orderBy';

import DatePageFilter from 'sentry/components/datePageFilter';
import SearchBar from 'sentry/components/searchBar';
import {space} from 'sentry/styles/space';
import usePageFilters from 'sentry/utils/usePageFilters';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {SpanTimeCharts} from 'sentry/views/starfish/views/spans/spanTimeCharts';

import {getSpanListQuery, getSpansTrendsQuery} from './queries';
import type {SpanDataRow, SpanTrendDataRow} from './spansTable';
import SpansTable from './spansTable';

const LIMIT: number = 25;

type Props = {
  location: Location;
  onSelect: (row: SpanDataRow) => void;
};

type State = {
  orderBy: string;
};

export default function SpansView(props: Props) {
  const location = props.location;
  const pageFilter = usePageFilters();
  const [state, setState] = useState<State>({orderBy: 'total_exclusive_time'});

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [didConfirmSearch, setDidConfirmSearch] = useState<boolean>(false);
  const {orderBy} = state;

  const descriptionFilter = didConfirmSearch && searchTerm ? `${searchTerm}` : undefined;
  const queryConditions = buildQueryFilterFromLocation(location);
  const {isLoading: areSpansLoading, data: spansData} = useQuery<SpanDataRow[]>({
    queryKey: ['spans', descriptionFilter, orderBy, pageFilter.selection.datetime],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getSpanListQuery(
          descriptionFilter,
          pageFilter.selection.datetime,
          queryConditions,
          orderBy,
          LIMIT
        )}&format=sql`
      ).then(res => res.json()),
    retry: false,
    refetchOnWindowFocus: false,
    initialData: [],
  });

  const groupIDs = spansData.map(({group_id}) => group_id);

  const {isLoading: areSpansTrendsLoading, data: spansTrendsData} = useQuery<
    SpanTrendDataRow[]
  >({
    queryKey: ['spansTrends', descriptionFilter],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getSpansTrendsQuery(
          descriptionFilter,
          pageFilter.selection.datetime,
          groupIDs
        )}`
      ).then(res => res.json()),
    retry: false,
    refetchOnWindowFocus: false,
    initialData: [],
    enabled: groupIDs.length > 0,
  });

  return (
    <Fragment>
      <div>
        <FilterOptionsContainer>
          <DatePageFilter alignDropdown="left" />
        </FilterOptionsContainer>
      </div>

      <SearchBar
        onChange={value => {
          setSearchTerm(value);
          setDidConfirmSearch(false);
        }}
        placeholder="Search Spans"
        query={searchTerm}
        onSearch={() => {
          setDidConfirmSearch(true);
        }}
      />

      <SpanTimeCharts
        descriptionFilter={descriptionFilter || ''}
        queryConditions={queryConditions}
      />

      <SpansTable
        location={props.location}
        queryConditions={queryConditions}
        isLoading={areSpansLoading || areSpansTrendsLoading}
        spansData={spansData}
        orderBy={orderBy}
        onSetOrderBy={newOrderBy => setState({orderBy: newOrderBy})}
        spansTrendsData={spansTrendsData}
        onSelect={props.onSelect}
      />
    </Fragment>
  );
}

const FilterOptionsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;

const SPAN_FILTER_KEYS = ['action', 'span_operation', 'domain'];

const buildQueryFilterFromLocation = (location: Location) => {
  const {query} = location;
  const result = Object.keys(query)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    .map(key => {
      return `${key} = '${query[key]}'`;
    });
  return result;
};
