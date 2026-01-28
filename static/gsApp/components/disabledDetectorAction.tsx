import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {DisableDetectorAction} from 'sentry/views/detectors/components/details/common/actions';

export function DisabledDetectorAction({detector}: {detector: Detector}) {
  const organization = useOrganization();
  const isAnomalyDetector =
    detector.type === 'metric_issue' &&
    'config' in detector &&
    detector.config?.detectionType === 'dynamic';

  const hasFeature = organization.features.includes('anomaly-detection-alerts');

  if (isAnomalyDetector && !hasFeature) {
    return (
      <Button size="sm" disabled>
        {t('Enable')}
      </Button>
    );
  }

  return <DisableDetectorAction detector={detector} />;
}
