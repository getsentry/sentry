import {Button} from 'sentry/components/button';
import {FeedbackModal} from 'sentry/components/feedback/widget/feedbackModal';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t} from 'sentry/locale';

const CRONS_FEEDBACK_NAME = 'crons';

function CronsFeedbackButton() {
  const title = t('Give Feedback');

  return (
    <FeedbackModal title={title} type={CRONS_FEEDBACK_NAME}>
      {({showModal}) => (
        <Button size="sm" icon={<IconMegaphone />} onClick={showModal}>
          {title}
        </Button>
      )}
    </FeedbackModal>
  );
}

export default CronsFeedbackButton;
