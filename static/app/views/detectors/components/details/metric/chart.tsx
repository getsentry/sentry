import styled from '@emotion/styled';

import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {MetricDetectorChart} from 'sentry/views/detectors/components/forms/metric/metricDetectorChart';
import {getDetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';

interface MetricDetectorDetailsChartProps {
  detector: MetricDetector;
}

export function MetricDetectorDetailsChart({detector}: MetricDetectorDetailsChartProps) {
  const dataSource = detector.dataSources[0];
  const snubaQuery =
    dataSource?.type === 'snuba_query_subscription'
      ? dataSource.queryObj?.snubaQuery
      : undefined;

  if (!snubaQuery) {
    // Unlikely, helps narrow types
    return null;
  }

  const dataset = getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes);
  const aggregate = snubaQuery.aggregate;
  const query = snubaQuery.query;
  const environment = snubaQuery.environment;
  const interval = snubaQuery.timeWindow;
  const conditions = detector.conditionGroup?.conditions || [];
  const detectionType = detector.config.detectionType;

  return (
    <ChartContainer>
      <MetricDetectorChart
        dataset={dataset}
        aggregate={aggregate}
        interval={interval}
        query={query}
        environment={environment}
        projectId={detector.projectId}
        conditions={conditions}
        detectionType={detectionType}
      />
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.lg} ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;
