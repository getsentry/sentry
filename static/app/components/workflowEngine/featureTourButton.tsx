import {Button} from '@sentry/scraps/button';

import type {TourStep} from 'sentry/components/modals/featureTourModal';
import {FeatureTourModal} from 'sentry/components/modals/featureTourModal';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';

interface WorkflowEngineFeatureTourButtonProps {
  doneUrl: string;
  steps: TourStep[];
}

export function WorkflowEngineFeatureTourButton({
  steps,
  doneUrl,
}: WorkflowEngineFeatureTourButtonProps) {
  return (
    <FeatureTourModal steps={steps} doneUrl={doneUrl} doneText={t('Got it')}>
      {({showModal}) => (
        <Button
          size="sm"
          icon={<IconInfo />}
          onClick={showModal}
          aria-label={t('Feature tour')}
        />
      )}
    </FeatureTourModal>
  );
}
