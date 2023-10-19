import {Button} from 'sentry/components/button';
import {FeedbackModal} from 'sentry/components/feedback/widget/feedbackModal';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';

const CRONS_FEEDBACK_NAME = 'crons';

function CronsFeedbackButton() {
  const title = 'Give Feedback';

  return (
    <FeedbackModal
      title={title}
      type={CRONS_FEEDBACK_NAME}
      sendButtonText="Send Feedback"
      descriptionPlaceholder="What did you expect?"
    >
      {({showModal}) => (
        <Button size="sm" icon={<IconMegaphone />} onClick={showModal}>
          {title}
        </Button>
      )}
    </FeedbackModal>
  );
}

export default CronsFeedbackButton;
