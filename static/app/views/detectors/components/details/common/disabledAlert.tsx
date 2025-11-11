import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useUpdateDetector} from 'sentry/views/detectors/hooks';

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
  const {mutate: updateDetector, isPending: isEnabling} = useUpdateDetector();

  if (detector.enabled) {
    return null;
  }

  const handleEnable = () => {
    updateDetector({detectorId: detector.id, enabled: true});
  };

  return (
    <Alert.Container>
      <Alert
        type="muted"
        trailingItems={
          <Button
            size="xs"
            icon={<IconPlay />}
            onClick={handleEnable}
            disabled={isEnabling}
            aria-label={t('Enable')}
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
