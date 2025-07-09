import {openModal} from 'sentry/actionCreators/modal';
import type {ButtonProps} from 'sentry/components/core/button';
import {Button} from 'sentry/components/core/button';
import type {FeedbackModalProps} from 'sentry/components/featureFeedback/feedbackModal';
import {FeedbackModal, modalCss} from 'sentry/components/featureFeedback/feedbackModal';
import type {Data} from 'sentry/components/forms/types';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';

type FeatureFeedbackProps<T extends Data> = FeedbackModalProps<T> & {
  buttonProps?: Partial<ButtonProps>;
  secondaryAction?: React.ReactNode;
};

// Provides a button that, when clicked, opens a modal with a form that,
// when filled and submitted, will send feedback to Sentry (feedbacks project).
export function FeatureFeedback<T extends Data>({
  buttonProps = {},
  ...props
}: FeatureFeedbackProps<T>) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    openModal(modalProps => <FeedbackModal {...modalProps} {...props} />, {
      modalCss,
    });

    buttonProps.onClick?.(e);
  }

  return (
    <Button {...buttonProps} redesign redesign icon={<IconMegaphone redesign redesign />} onClick={handleClick}>
      {t('Give Feedback')}
    </Button>
  );
}
