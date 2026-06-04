import {useMemo} from 'react';

import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {MetricDetectorChart} from 'sentry/views/detectors/components/forms/metric/metricDetectorChart';
import {
  createConditions,
  getBackendDataset,
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {percentThresholdDeltaToAbsolute} from 'sentry/views/detectors/utils/percentThreshold';

interface MetricDetectorPreviewChartProps {
  detector?: MetricDetector;
}

export function MetricDetectorPreviewChart({
  detector,
}: MetricDetectorPreviewChartProps = {}) {
  // Get all the form fields needed for the chart
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const aggregateFunction = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );
  const interval = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.interval);
  const rawQuery = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.query);
  const environment = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.environment);
  const projectId = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.projectId);
  const extrapolationMode = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.extrapolationMode
  );

  // Threshold-related form fields
  const highThreshold = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.highThreshold
  );
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );
  const mediumThreshold = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.mediumThreshold
  );
  const resolutionStrategy = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.resolutionStrategy
  );
  const resolutionValue = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.resolutionValue
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
    // Wait for a high threshold value to be defined
    if (detectionType === 'static' && !highThreshold) {
      return [];
    }

    const rawConditions = createConditions({
      conditionType,
      highThreshold,
      mediumThreshold,
      resolutionStrategy,
      resolutionValue,
    });

    if (detectionType !== 'percent') {
      return rawConditions;
    }

    // The shared threshold chart hook expects backend-style absolute percent comparisons
    // (e.g. 110), while the form state stores user-facing deltas (e.g. 10% higher).
    return rawConditions.map(condition => ({
      ...condition,
      comparison:
        typeof condition.comparison === 'number'
          ? percentThresholdDeltaToAbsolute(condition.comparison, condition.type)
          : condition.comparison,
    }));
  }, [
    conditionType,
    highThreshold,
    mediumThreshold,
    resolutionStrategy,
    resolutionValue,
    detectionType,
  ]);

  const datasetConfig = getDatasetConfig(dataset);
  const {query, eventTypes} = datasetConfig.separateEventTypesFromQuery(rawQuery);

  return (
    <MetricDetectorChart
      detectorDataset={dataset}
      dataset={getBackendDataset(dataset)}
      aggregate={aggregateFunction}
      interval={interval}
      query={query}
      eventTypes={eventTypes}
      environment={environment}
      projectId={projectId}
      conditions={conditions}
      detectionType={detectionType}
      comparisonDelta={detectionType === 'percent' ? conditionComparisonAgo : undefined}
      sensitivity={sensitivity}
      thresholdType={thresholdType}
      extrapolationMode={extrapolationMode}
      detectorId={detector?.id}
    />
  );
}
