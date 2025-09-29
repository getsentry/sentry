import styled from '@emotion/styled';

import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useQueryParamsMode} from 'sentry/views/explore/queryParams/context';

import {MetricsAggregateTable} from './tables/metricsAggregateTable';
import {MetricsSamplesTable} from './tables/metricsSamplesTable';

export function MetricsTab() {
  const mode = useQueryParamsMode();
  const isAggregatesView = mode === Mode.AGGREGATE;

  return (
    <TabContent>
      {isAggregatesView ? <MetricsAggregateTable /> : <MetricsSamplesTable />}
    </TabContent>
  );
}

const TabContent = styled('div')`
  flex: 1;
  overflow: hidden;
`;
