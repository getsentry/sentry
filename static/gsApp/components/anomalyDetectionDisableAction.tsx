import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';

export function AnomalyDetectionDisableAction({detector}: {detector: Detector}) {
  const organization = useOrganization();

  // Check if this is an anomaly detection detector without the required feature
  const isAnomalyDetector =
    detector.type === 'metric_issue' &&
    'config' in detector &&
    detector.config?.detectionType === 'dynamic';

  const hasAnomalyDetectionFeature = organization.features.includes(
    'anomaly-detection-alerts'
  );

  // Only override for anomaly detectors without the feature
  if (!isAnomalyDetector || hasAnomalyDetectionFeature) {
    return null;
  }

  // For anomaly detectors without feature: disable the Enable button with tooltip
  const isDisabled = !detector.enabled;
  const tooltipText = isDisabled
    ? t('Anomaly detection is only available on Business and Enterprise plans')
    : undefined;

  return (
    <Tooltip title={tooltipText} disabled={!tooltipText}>
      <Button size="sm" disabled>
        {detector.enabled ? t('Disable') : t('Enable')}
      </Button>
    </Tooltip>
  );
}
