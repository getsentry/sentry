import {useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {MetricDetectorChart} from 'sentry/views/detectors/components/forms/metric/metricDetectorChart';
import {
  createConditions,
  getBackendDataset,
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {useTimePeriodSelection} from 'sentry/views/detectors/hooks/useTimePeriodSelection';

export function MetricDetectorPreviewChart() {
  // Get all the form fields needed for the chart
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const aggregateFunction = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );
  const interval = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.interval);
  const query = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.query);
  const environment = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.environment);
  const projectId = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.projectId);

  // Threshold-related form fields
  const conditionValue = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionValue
  );
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );
  const highThreshold = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.highThreshold
  );
  const initialPriorityLevel = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel
  );
  const detectionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.detectionType
  );
  const conditionComparisonAgo = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionComparisonAgo
  );
  const sensitivity = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.sensitivity);
  const thresholdType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.thresholdType
  );

  const {selectedTimePeriod, setSelectedTimePeriod, timePeriodOptions} =
    useTimePeriodSelection({
      dataset: getBackendDataset(dataset),
      interval,
    });

  // Create condition group from form data using the helper function
  const conditions = useMemo(() => {
    // Wait for a condition value to be defined
    if (detectionType === 'static' && !conditionValue) {
      return [];
    }

    return createConditions({
      conditionType,
      conditionValue,
      initialPriorityLevel,
      highThreshold,
    });
  }, [conditionType, conditionValue, initialPriorityLevel, highThreshold, detectionType]);

  return (
    <ChartContainer>
      <MetricDetectorChart
        dataset={dataset}
        aggregate={aggregateFunction}
        interval={interval}
        query={query}
        environment={environment}
        projectId={projectId}
        conditions={conditions}
        detectionType={detectionType}
        statsPeriod={selectedTimePeriod}
        comparisonDelta={detectionType === 'percent' ? conditionComparisonAgo : undefined}
        sensitivity={sensitivity}
        thresholdType={thresholdType}
      />
      <ChartFooter>
        <CompactSelect
          size="sm"
          options={timePeriodOptions}
          value={selectedTimePeriod}
          onChange={opt => setSelectedTimePeriod(opt.value)}
          triggerProps={{
            borderless: true,
            prefix: t('Display'),
          }}
        />
      </ChartFooter>
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  max-width: 1440px;
  border-top: 1px solid ${p => p.theme.border};
`;

const ChartFooter = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: ${p => `${p.theme.space.sm} 0`};
  border-top: 1px solid ${p => p.theme.border};
`;
