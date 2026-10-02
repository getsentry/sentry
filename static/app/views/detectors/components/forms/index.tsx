import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';
import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
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
  EditExistingPreprodDetectorForm,
  NewPreprodDetectorForm,
} from 'sentry/views/detectors/components/forms/mobileBuild';
import {
  EditExistingUptimeDetectorForm,
  NewUptimeDetectorForm,
} from 'sentry/views/detectors/components/forms/uptime';
import {detectorTypeIsAvailableForCreation} from 'sentry/views/detectors/utils/detectorTypeConfig';

function PlaceholderForm() {
  return (
    <Stack flex={1}>
      <Layout.Body>
        <Layout.Main width="full">
          <LoadingError message={t('This monitor type can not be created')} />
        </Layout.Main>
      </Layout.Body>
    </Stack>
  );
}

export function NewDetectorForm({detectorType}: {detectorType: DetectorType}) {
  const organization = useOrganization();
  const {duplicateDetector} = useDetectorFormContext();

  const detectorCopy = duplicateDetector
    ? {...duplicateDetector, name: t('%s (Copy)', duplicateDetector.name)}
    : undefined;

  switch (detectorType) {
    case 'metric_issue':
      return (
        <NewMetricDetectorForm
          duplicateDetector={
            detectorCopy?.type === 'metric_issue' ? detectorCopy : undefined
          }
        />
      );
    case 'uptime_domain_failure':
      return (
        <NewUptimeDetectorForm
          duplicateDetector={
            detectorCopy?.type === 'uptime_domain_failure' ? detectorCopy : undefined
          }
        />
      );
    case 'error':
      return <NewErrorDetectorForm />;
    case 'monitor_check_in_failure':
      return (
        <NewCronDetectorForm
          duplicateDetector={
            detectorCopy?.type === 'monitor_check_in_failure' ? detectorCopy : undefined
          }
        />
      );
    case 'issue_stream':
      return <PlaceholderForm />;
    case 'preprod_size_analysis':
      if (!detectorTypeIsAvailableForCreation(detectorType, organization)) {
        return <PlaceholderForm />;
      }
      return (
        <NewPreprodDetectorForm
          duplicateDetector={
            detectorCopy?.type === 'preprod_size_analysis' ? detectorCopy : undefined
          }
        />
      );
    default:
      unreachable(detectorType);
      return <PlaceholderForm />;
  }
}

export function EditExistingDetectorForm({
  detector,
  project,
}: {
  detector: Detector;
  project: Project;
}) {
  const detectorType = detector.type;
  switch (detectorType) {
    case 'metric_issue':
      return <EditExistingMetricDetectorForm detector={detector} />;
    case 'uptime_domain_failure':
      return <EditExistingUptimeDetectorForm detector={detector} />;
    case 'error':
      return <EditExistingErrorDetectorForm detector={detector} project={project} />;
    case 'monitor_check_in_failure':
      return <EditExistingCronDetectorForm detector={detector} />;
    case 'issue_stream':
      return (
        <Alert.Container>
          <Alert variant="danger">{t('Issue stream monitors can not be edited.')}</Alert>
        </Alert.Container>
      );
    case 'preprod_size_analysis':
      return <EditExistingPreprodDetectorForm detector={detector} />;
    default:
      unreachable(detectorType);
      return <PlaceholderForm />;
  }
}
