import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';

import {FeedBackModalProps} from './feedbackModal';

interface Props extends FeedBackModalProps {}

export function FeatureFeedback({feedbackTypes}: Props) {
  async function handleClick() {
    const mod = await import('sentry/components/featureFeedback/feedbackModal');

    const {FeedbackModal, modalCss} = mod;

    openModal(deps => <FeedbackModal {...deps} feedbackTypes={feedbackTypes} />, {
      modalCss,
    });
  }

  return (
    <Button icon={<IconMegaphone />} onClick={handleClick}>
      {t('Give Feedback')}
    </Button>
  );
}
