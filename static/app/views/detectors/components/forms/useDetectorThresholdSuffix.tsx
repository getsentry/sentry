import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from './metric/metricFormData';

/**
 * Returns the threshold suffix for the detector
 */
export function useDetectorThresholdSuffix(): 's' | '%' | '' {
  const kind = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.kind);

  if (kind === 'static') {
    // TODO: Look at the aggregate to determine the suffix
    return 's';
  }

  if (kind === 'percent') {
    return '%';
  }

  return '';
}
