import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';
import {unreachable} from 'sentry/utils/unreachable';
import {
  EditExistingCronDetectorForm,
  NewCronDetectorForm,
} from 'sentry/views/detectors/components/forms/cron';
import {
  EditExistingErrorDetectorForm,
  NewErrorDetectorForm,
} from 'sentry/views/detectors/components/forms/error';
import {
  EditExistingMetricDetectorForm,
  NewMetricDetectorForm,
} from 'sentry/views/detectors/components/forms/metric/metric';
import {
  EditExistingUptimeDetectorForm,
  NewUptimeDetectorForm,
} from 'sentry/views/detectors/components/forms/uptime';

function PlaceholderForm() {
  return (
    <Layout.Page>
      <Layout.Body>
        <Layout.Main fullWidth>
          <LoadingError message={t('This monitor type is not yet implemented')} />
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

export function NewDetectorForm({detectorType}: {detectorType: DetectorType}) {
  switch (detectorType) {
    case 'metric_issue':
      return <NewMetricDetectorForm />;
    case 'uptime_domain_failure':
      return <NewUptimeDetectorForm />;
    case 'error':
      return <NewErrorDetectorForm />;
    case 'monitor_check_in_failure':
      return <NewCronDetectorForm />;
    default:
      unreachable(detectorType);
      return <PlaceholderForm />;
  }
}

export function EditExistingDetectorForm({detector}: {detector: Detector}) {
  const detectorType = detector.type;
  switch (detectorType) {
    case 'metric_issue':
      return <EditExistingMetricDetectorForm detector={detector} />;
    case 'uptime_domain_failure':
      return <EditExistingUptimeDetectorForm detector={detector} />;
    case 'error':
      return <EditExistingErrorDetectorForm detector={detector} />;
    case 'monitor_check_in_failure':
      return <EditExistingCronDetectorForm detector={detector} />;
    default:
      unreachable(detectorType);
      return <PlaceholderForm />;
  }
}
