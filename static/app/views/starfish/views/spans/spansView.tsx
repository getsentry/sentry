import {Fragment, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
// eslint-disable-next-line no-restricted-imports
import get from 'lodash/get';

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
  const currentCluster = get(CLUSTERS, clusterPath);

  const {isLoading: areSpansLoading, data: spansData} = useQuery<SpanDataRow[]>({
    queryKey: ['spans'],
    queryFn: () =>
      fetch(`${HOST}/?query=${getSpanListQuery(currentCluster?.condition)}`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
  });

  return (
    <Fragment>
      <div>
        <button onClick={() => setClusterPath(['top', 'clusters', 'db'])}>DB</button>
        <button onClick={() => setClusterPath(['top', 'clusters', 'http'])}>HTTP</button>
        <button onClick={() => setClusterPath(['top', 'clusters', 'other'])}>
          Other
        </button>
        <button onClick={() => setClusterPath(['top'])}>None</button>
      </div>

      <SpansTable
        location={props.location}
        isLoading={areSpansLoading}
        data={spansData}
      />
    </Fragment>
  );
}
