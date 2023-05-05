import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {useQueries, useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import keyBy from 'lodash/keyBy';
import sumBy from 'lodash/sumBy';

import DatePageFilter from 'sentry/components/datePageFilter';
import TagDistributionMeter from 'sentry/components/tagDistributionMeter';
import {space} from 'sentry/styles/space';
import usePageFilters from 'sentry/utils/usePageFilters';
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
  const {orderBy} = state;

  const [clusterPath, setClusterPath] = useState<string[]>(['top']);
  const currentClusters = clusterPath.map(
    clusterName =>
      CLUSTERS[clusterName] || {
        isDynamic: true,
        name: clusterName,
      }
  );
  const currentCluster = currentClusters.at(-1);
  if (currentCluster.isDynamic) {
    currentCluster.condition = currentClusters
      .at(-2)
      .grouping_condition(currentCluster.name);
  }

  const clusterBreakdowns = useQueries({
    queries: currentClusters.map(cluster => {
      return {
        queryKey: ['clusterBreakdown', cluster.name],
        queryFn: () =>
          fetch(
            `${HOST}/?query=${getTimeSpentQuery(
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
    queryKey: ['spans', currentCluster.name, orderBy],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getSpanListQuery(
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
    queryKey: ['spansTrends', currentCluster.name],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getSpansTrendsQuery(pageFilter.selection.datetime, groupIDs)}`
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

          const segments = (clusters || []).map(clusterName => {
            const subCluster = CLUSTERS[clusterName];

            return {
              name: subCluster?.label || clusterName,
              value: clusterName,
              count: exclusiveTimeBySubCluster[clusterName]?.exclusive_time,
              url: '',
            };
          });

          if (segments.length === 0) {
            return null;
          }

          return (
            <TagDistributionMeter
              key={cluster.name}
              title={cluster.label}
              onTagClick={(_name, value) => {
                setClusterPath([...clusterPath.slice(0, depth + 1), value.value]);
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

      <SpansTable
        location={props.location}
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
