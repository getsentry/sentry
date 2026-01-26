import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';

export function AnomalyDetectionDisabledAlert({detector}: {detector: Detector}) {
  const organization = useOrganization();

  // Check if this is an anomaly detection detector without the required feature
  const isAnomalyDetector =
    detector.type === 'metric_issue' &&
    'config' in detector &&
    detector.config?.detectionType === 'dynamic';

  const hasAnomalyDetectionFeature = organization.features.includes(
    'anomaly-detection-alerts'
  );

  // Only show for anomaly detectors without the feature
  if (!isAnomalyDetector || hasAnomalyDetectionFeature) {
    return null;
  }

  return (
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
  );
}
