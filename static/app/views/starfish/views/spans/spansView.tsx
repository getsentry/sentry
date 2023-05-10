import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {useQueries, useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import keyBy from 'lodash/keyBy';
import _orderBy from 'lodash/orderBy';
import sumBy from 'lodash/sumBy';

import DatePageFilter from 'sentry/components/datePageFilter';
import SearchBar from 'sentry/components/searchBar';
import TagDistributionMeter from 'sentry/components/tagDistributionMeter';
import {space} from 'sentry/styles/space';
import usePageFilters from 'sentry/utils/usePageFilters';
import {HostDetails} from 'sentry/views/starfish/modules/APIModule/hostDetails';
import {HOST} from 'sentry/views/starfish/utils/constants';

import {CLUSTERS} from './clusters';
import {getSpanListQuery, getSpansTrendsQuery, getTimeSpentQuery} from './queries';
import type {SpanDataRow, SpanTrendDataRow} from './spansTable';
import SpansTable from './spansTable';

const LIMIT: number = 25;

type Props = {
  location: Location;
};

type State = {
  orderBy: string;
};

export default function SpansView(props: Props) {
  const pageFilter = usePageFilters();
  const [state, setState] = useState<State>({orderBy: 'total_exclusive_time'});

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [didConfirmSearch, setDidConfirmSearch] = useState<boolean>(false);
  const {orderBy} = state;

  const [clusterPath, setClusterPath] = useState<string[]>(['top']);
  const currentClusters = clusterPath.map(
    clusterName =>
      CLUSTERS[clusterName] || {
        isDynamic: true,
        name: clusterName.split(':')[1],
        value: clusterName.split(':')[1],
        parentClusterName: clusterName.split(':')[0],
      }
  );

  const descriptionFilter = didConfirmSearch && searchTerm ? `${searchTerm}` : undefined;

  const currentCluster = currentClusters.at(-1);
  if (currentCluster?.isDynamic) {
    const previousCluster = currentClusters.at(-2);
    currentCluster.condition =
      previousCluster?.grouping_condition?.(currentCluster.name) || (() => '');
  }

  const lastStaticCluster = currentClusters.findLast(cluster => !cluster.isDynamic);

  const clusterBreakdowns = useQueries({
    queries: currentClusters.map(cluster => {
      return {
        queryKey: ['clusterBreakdown', descriptionFilter, cluster.name],
        queryFn: () =>
          fetch(
            `${HOST}/?query=${getTimeSpentQuery(
              descriptionFilter,
              cluster.grouping_column || '',
              currentClusters.map(c => c.condition(c.name))
            )}`
          ).then(res => res.json()),
        retry: false,
        enabled: Boolean(cluster.grouping_column),
        initialData: [],
      };
    }),
  });

  const {isLoading: areSpansLoading, data: spansData} = useQuery<SpanDataRow[]>({
    queryKey: ['spans', currentCluster?.name || 'none', descriptionFilter, orderBy],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getSpanListQuery(
          descriptionFilter,
          pageFilter.selection.datetime,
          currentClusters.map(c => c.condition(c.name)),
          orderBy,
          LIMIT
        )}`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const groupIDs = spansData.map(({group_id}) => group_id);

  const {isLoading: areSpansTrendsLoading, data: spansTrendsData} = useQuery<
    SpanTrendDataRow[]
  >({
    queryKey: ['spansTrends', currentCluster?.name || 'none', descriptionFilter],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getSpansTrendsQuery(
          descriptionFilter,
          pageFilter.selection.datetime,
          groupIDs
        )}`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
    enabled: groupIDs.length > 0,
  });

  return (
    <Fragment>
      <div>
        <FilterOptionsContainer>
          <DatePageFilter alignDropdown="left" />
        </FilterOptionsContainer>

        {currentClusters.map((cluster, depth) => {
          const clusterBreakdownResponse = clusterBreakdowns[depth];
          if (
            !clusterBreakdownResponse ||
            clusterBreakdownResponse.isLoading ||
            clusterBreakdownResponse.error
          ) {
            return null;
          }

          const exclusiveTimeBySubCluster = keyBy(
            clusterBreakdownResponse.data,
            'primary_group'
          );

          const clusters = Object.keys(exclusiveTimeBySubCluster);

          const segments = _orderBy(
            (clusters || []).map(clusterName => {
              const subCluster = CLUSTERS[clusterName];

              return {
                name: subCluster?.label || clusterName,
                value: clusterName,
                count: exclusiveTimeBySubCluster[clusterName]?.exclusive_time,
                url: '',
              };
            }),
            'count',
            'desc'
          );

          if (segments.length === 0) {
            return null;
          }

          return (
            <TagDistributionMeter
              key={cluster.name}
              title={cluster.label}
              onTagClick={(_name, tag) => {
                const incomingCluster = CLUSTERS[tag.value];
                const bottomCluster = currentClusters.at(-1);

                const incomingClusterName = incomingCluster
                  ? tag.value
                  : `${bottomCluster?.name || ''}:${tag.value}`;

                setClusterPath([...clusterPath.slice(0, depth + 1), incomingClusterName]);
              }}
              segments={segments}
              totalValues={sumBy(segments, 'count')}
            />
          );
        })}
      </div>

      <div>
        <button onClick={() => setClusterPath(['top'])}>Reset</button>
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

      {lastStaticCluster?.name === 'http.client.get' && currentCluster?.value && (
        <HostDetails host={currentCluster.value} />
      )}

      <SpansTable
        location={props.location}
        clusters={currentClusters}
        isLoading={areSpansLoading || areSpansTrendsLoading}
        spansData={spansData}
        orderBy={orderBy}
        onSetOrderBy={newOrderBy => setState({orderBy: newOrderBy})}
        spansTrendsData={spansTrendsData}
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
