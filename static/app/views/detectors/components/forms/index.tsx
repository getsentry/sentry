import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {unreachable} from 'sentry/utils/unreachable';
import type {EditableDetectorType} from 'sentry/views/detectors/components/forms/config';
import {
  EditExistingMetricDetectorForm,
  NewMetricDetectorForm,
} from 'sentry/views/detectors/components/forms/metric/metric';
import {
  EditExistingUptimeDetectorForm,
  NewUptimeDetectorForm,
} from 'sentry/views/detectors/components/forms/uptime';

export function NewDetectorForm({detectorType}: {detectorType: EditableDetectorType}) {
  switch (detectorType) {
    case 'metric_issue':
      return <NewMetricDetectorForm />;
    case 'uptime_domain_failure':
      return <NewUptimeDetectorForm />;
    default:
      unreachable(detectorType);
      return null;
  }
}

export function EditExistingDetectorForm({
  detector,
  detectorType,
}: {
  detector: Detector;
  detectorType: EditableDetectorType;
}) {
  switch (detectorType) {
    case 'metric_issue':
      return <EditExistingMetricDetectorForm detector={detector} />;
    case 'uptime_domain_failure':
      return <EditExistingUptimeDetectorForm detector={detector} />;
    default:
      unreachable(detectorType);
      return null;
  }
}
