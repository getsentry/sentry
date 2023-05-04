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
  const currentClusters = clusterPath.map(clusterName => CLUSTERS[clusterName]);
  const currentCluster = currentClusters.at(-1);

  const clusterBreakdowns = useQueries({
    queries: currentClusters.map(cluster => {
      return {
        queryKey: ['clusterBreakdown', cluster.name],
        queryFn: () =>
          fetch(
            `${HOST}/?query=${getTimeSpentQuery(cluster.grouping_column || '', [
              cluster.condition,
            ])}`
          ).then(res => res.json()),
        retry: false,
        initialData: [],
      };
    }),
  });

  const {isLoading: areSpansLoading, data: spansData} = useQuery<SpanDataRow[]>({
    queryKey: ['spans', currentCluster.name],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getSpanListQuery(
          currentClusters.map(cluster => cluster.condition)
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

          const segments = (cluster.clusters || []).map(clusterName => {
            const subCluster = CLUSTERS[clusterName];

            return {
              name: subCluster.label,
              value: clusterName,
              count: exclusiveTimeBySubCluster[subCluster.name]?.exclusive_time,
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
