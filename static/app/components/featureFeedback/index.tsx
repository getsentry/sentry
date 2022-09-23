import {openModal} from 'sentry/actionCreators/modal';
import Button, {ButtonProps} from 'sentry/components/button';
import {
  FeedbackModal,
  FeedbackModalProps,
  modalCss,
} from 'sentry/components/featureFeedback/feedbackModal';
import {Data} from 'sentry/components/forms/type';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';

export type FeatureFeedbackProps<T extends Data> = FeedbackModalProps<T> & {
  buttonProps?: Partial<ButtonProps>;
};

// Provides a button that, when clicked, opens a modal with a form that,
// when filled and submitted, will send feedback to Sentry (feedbacks project).
export function FeatureFeedback<T extends Data>({
  buttonProps = {},
  ...props
}: FeatureFeedbackProps<T>) {
  function handleClick() {
    openModal(modalProps => <FeedbackModal {...modalProps} {...props} />, {
      modalCss,
    });
  }

  return (
    <Button icon={<IconMegaphone />} onClick={handleClick} {...buttonProps}>
      {t('Give Feedback')}
    </Button>
  );
}
