import {openModal} from 'sentry/actionCreators/modal';
import {Button, ButtonProps} from 'sentry/components/button';
import {
  FeedbackModal,
  FeedbackModalProps,
  modalCss,
} from 'sentry/components/featureFeedback/feedbackModal';
import {Data} from 'sentry/components/forms/types';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';

export type FeatureFeedbackProps<T extends Data> = FeedbackModalProps<T> & {
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
    <Button {...buttonProps} icon={<IconMegaphone />} onClick={handleClick}>
      {t('Give Feedback')}
    </Button>
  );
}
