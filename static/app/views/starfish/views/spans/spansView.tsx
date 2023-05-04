import {Fragment, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import sumBy from 'lodash/sumBy';

import TagDistributionMeter from 'sentry/components/tagDistributionMeter';
import {HOST} from 'sentry/views/starfish/utils/constants';

import {CLUSTERS} from './clusters';
import {getSpanListQuery} from './queries';
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
          const segments = (cluster.clusters || []).map(clusterName => {
            const subCluster = CLUSTERS[clusterName];

            return {
              name: subCluster.label,
              value: clusterName,
              count: 100,
              url: '',
            };
          });

          return segments.length > 0 ? (
            <TagDistributionMeter
              key={cluster.name}
              title={cluster.label}
              onTagClick={(_name, value) => {
                setClusterPath([...clusterPath.slice(0, depth + 1), value.value]);
              }}
              segments={segments}
              totalValues={sumBy(segments, 'count')}
            />
          ) : null;
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
