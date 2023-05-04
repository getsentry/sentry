import {Fragment, useState} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import keyBy from 'lodash/keyBy';
import sumBy from 'lodash/sumBy';

import TagDistributionMeter from 'sentry/components/tagDistributionMeter';
import {HOST} from 'sentry/views/starfish/utils/constants';

import {CLUSTERS} from './clusters';
import {getSpanListQuery, getTimeSpentQuery} from './queries';
import SpansTable from './spansTable';

type Props = {
  location: Location;
};

type SpanDataRow = {
  description: string;
  group_id: string;
  span_operation: string;
};

export default function SpansView(props: Props) {
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
    queryKey: ['spans', currentCluster.name],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getSpanListQuery(
          currentClusters.map(c => c.condition(c.name))
        )}`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  return (
    <Fragment>
      <div>
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
        isLoading={areSpansLoading}
        data={spansData}
      />
    </Fragment>
  );
}
