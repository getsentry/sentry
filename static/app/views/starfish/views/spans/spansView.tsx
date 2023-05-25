import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import _orderBy from 'lodash/orderBy';

import DatePageFilter from 'sentry/components/datePageFilter';
import SearchBar from 'sentry/components/searchBar';
import {space} from 'sentry/styles/space';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ModuleName} from 'sentry/views/starfish/types';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {ActionSelector} from 'sentry/views/starfish/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';
import {SpanOperationSelector} from 'sentry/views/starfish/views/spans/selectors/spanOperationSelector';
import {SpanTimeCharts} from 'sentry/views/starfish/views/spans/spanTimeCharts';

import {getSpanListQuery, getSpansTrendsQuery} from './queries';
import type {SpanDataRow, SpanTrendDataRow} from './spansTable';
import SpansTable, {mapRowKeys} from './spansTable';

const LIMIT: number = 25;

type Props = {
  appliedFilters: {[key: string]: string};
  location: Location;
  onSelect: (row: SpanDataRow) => void;
  moduleName?: ModuleName;
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
  const query = getSpanListQuery(
    descriptionFilter,
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

  // Initialize the selected span group if it exists in the URL
  const {onSelect} = props;
  const selectedSpanGroup = location.query.group_id;
  const [initializedSelectedSpan, setInitializedSelectedSpan] = useState(false);
  useEffect(() => {
    if (
      !initializedSelectedSpan &&
      !areSpansLoading &&
      selectedSpanGroup &&
      spansData.length > 0
    ) {
      const selectedSpanData = spansData.find(
        ({group_id}) => group_id === selectedSpanGroup
      );
      if (selectedSpanData) {
        onSelect(mapRowKeys(selectedSpanData, selectedSpanData.span_operation));
      }
      setInitializedSelectedSpan(true);
    }
  }, [areSpansLoading, initializedSelectedSpan, onSelect, selectedSpanGroup, spansData]);

  return (
    <Fragment>
      <FilterOptionsContainer>
        <DatePageFilter alignDropdown="left" />

        <SpanOperationSelector value={props.appliedFilters.span_operation} />

        <DomainSelector
          moduleName={props.moduleName}
          value={props.appliedFilters.domain}
        />

        <ActionSelector
          moduleName={props.moduleName}
          value={props.appliedFilters.action}
        />
      </FilterOptionsContainer>

      <PaddedContainer>
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
      </PaddedContainer>

      <PaddedContainer>
        <SpanTimeCharts
          descriptionFilter={descriptionFilter || ''}
          queryConditions={queryConditions}
        />
      </PaddedContainer>

      <PaddedContainer>
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

const buildQueryFilterFromLocation = (location: Location) => {
  const {query} = location;
  const result = Object.keys(query)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    .filter(key => Boolean(query[key]))
    .map(key => {
      return `${key} = '${query[key]}'`;
    });
  return result;
};
