import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {MetricDetectorChart} from 'sentry/views/detectors/components/forms/metric/metricDetectorChart';
import {getDetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {useTimePeriodSelection} from 'sentry/views/detectors/hooks/useTimePeriodSelection';

interface MetricDetectorDetailsChartProps {
  detector: MetricDetector;
}

export function MetricDetectorDetailsChart({detector}: MetricDetectorDetailsChartProps) {
  const dataSource = detector.dataSources[0];
  const snubaQuery = dataSource.queryObj?.snubaQuery;

  const {selectedTimePeriod, setSelectedTimePeriod, timePeriodOptions} =
    useTimePeriodSelection({
      dataset: snubaQuery?.dataset ?? Dataset.ERRORS,
      interval: snubaQuery?.timeWindow,
    });

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
    <Flex direction="column" gap="xl">
      <CompactSelect
        size="sm"
        options={timePeriodOptions}
        value={selectedTimePeriod}
        onChange={opt => setSelectedTimePeriod(opt.value)}
      />
      <ChartContainer>
        <ChartContainerBody>
          <MetricDetectorChart
            dataset={dataset}
            aggregate={aggregate}
            interval={interval}
            query={query}
            environment={environment}
            projectId={detector.projectId}
            conditions={conditions}
            detectionType={detectionType}
            statsPeriod={selectedTimePeriod}
          />
        </ChartContainerBody>
      </ChartContainer>
    </Flex>
  );
}

const ChartContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const ChartContainerBody = styled('div')`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.lg} ${p => p.theme.space.xs};
`;
