import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useQueryParamsMode} from 'sentry/views/explore/queryParams/context';

import {MetricsAggregateTable} from './tables/metricsAggregateTable';
import {MetricsInfiniteTable} from './tables/metricsInfiniteTable';

export function MetricsTab() {
  const mode = useQueryParamsMode();
  const isAggregatesView = mode === Mode.AGGREGATE;

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
