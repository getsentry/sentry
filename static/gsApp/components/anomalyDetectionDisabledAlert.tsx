import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {DisabledAlert} from 'sentry/views/detectors/components/details/common/disabledAlert';

export function AnomalyDetectionDisabledAlert({
  detector,
  message,
}: {
  detector: Detector;
  message: string;
}) {
  const organization = useOrganization();

  const isAnomalyDetector =
    detector.type === 'metric_issue' &&
    'config' in detector &&
    detector.config?.detectionType === 'dynamic';

  const hasFeature = organization.features.includes('anomaly-detection-alerts');

  // For anomaly detectors without feature, show upgrade message only when disabled
  if (isAnomalyDetector && !hasFeature) {
    if (detector.enabled) {
      return null;
    }
    return (
      <Alert.Container>
        <Alert variant="muted">
          {tct(
            'Anomaly detection is only available on Business and Enterprise plans. [link:Upgrade your plan] to enable this monitor.',
            {
              link: (
                <ExternalLink href="https://sentry.io/pricing/?referrer=anomaly-detection" />
              ),
            }
          )}
        </Alert>
      </Alert.Container>
    );
  }

  // Otherwise show default message with Enable button
  return <DisabledAlert detector={detector} message={message} />;
}
