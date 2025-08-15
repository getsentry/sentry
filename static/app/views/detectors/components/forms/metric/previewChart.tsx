import {useMemo} from 'react';

import {MetricDetectorChart} from 'sentry/views/detectors/components/forms/metric/metricDetectorChart';
import {
  createConditions,
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';

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
    <MetricDetectorChart
      dataset={dataset}
      aggregate={aggregateFunction}
      interval={interval}
      query={query}
      environment={environment}
      projectId={projectId}
      conditions={conditions}
      detectionType={detectionType}
      comparisonDelta={detectionType === 'percent' ? conditionComparisonAgo : undefined}
      sensitivity={sensitivity}
      thresholdType={thresholdType}
    />
  );
}
