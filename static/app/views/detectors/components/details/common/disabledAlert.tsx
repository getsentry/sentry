import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconPlay} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {useUpdateDetector} from 'sentry/views/detectors/hooks';
import {useCanEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';

type DisabledAlertProps = {
  detector: Detector;
  message: string;
};

/**
 * Use this component on detector detail pages when you want users to quickly understand
 * that a detector is disabled and not actively monitoring, and give them a one-click way
 * to enable it. The alert automatically hides when the detector is enabled.
 */
export function DisabledAlert({detector, message}: DisabledAlertProps) {
  const organization = useOrganization();
  const {mutate: updateDetector, isPending: isEnabling} = useUpdateDetector();
  const canEdit = useCanEditDetector({
    detectorType: detector.type,
    projectId: detector.projectId,
  });

  if (detector.enabled) {
    return null;
  }

  const handleEnable = () => {
    updateDetector({detectorId: detector.id, enabled: true});
  };

  // Check if this is a metric (anomaly detection) detector without the required feature
  const isMetricDetector = detector.type === 'metric_issue';
  const hasAnomalyDetectionFeature = organization.features.includes(
    'anomaly-detection-alerts'
  );
  const requiresUpgrade = isMetricDetector && !hasAnomalyDetectionFeature;

  if (requiresUpgrade) {
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

  return (
    <Alert.Container>
      <Alert
        variant="muted"
        trailingItems={
          <Button
            size="xs"
            icon={<IconPlay />}
            onClick={handleEnable}
            disabled={isEnabling || !canEdit}
            aria-label={t('Enable')}
            title={
              canEdit ? undefined : t('You do not have permission to enable this monitor')
            }
          >
            {t('Enable')}
          </Button>
        }
      >
        {message}
      </Alert>
    </Alert.Container>
  );
}
