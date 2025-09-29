import {Fragment} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {useMetricsPageDataQueryResult} from 'sentry/views/explore/contexts/metrics/metricsPageData';

import {MetricsAggregateTable} from './tables/metricsAggregateTable';
import {MetricsInfiniteTable} from './tables/metricsInfiniteTable';

export function MetricsTab() {
  const queryResult = useMetricsPageDataQueryResult();
  const isAggregatesView = true; // TODO: Get from state/params

  return (
    <TabContent>
      {isAggregatesView ? <MetricsAggregateTable /> : <MetricsInfiniteTable />}
    </TabContent>
  );
}

const TabContent = styled('div')`
  flex: 1;
  overflow: hidden;
  padding: ${space(2)};
`;
