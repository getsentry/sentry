import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';

export default function AutofixFeedback() {
  return (
    <FeedbackButton
      size="xs"
      feedbackOptions={{
        formTitle: t('Give feedback to the devs'),
        messagePlaceholder: t('How can we make Seer better for you?'),
        tags: {
          ['feedback.source']: 'issue_details_ai_autofix',
          ['feedback.owner']: 'ml-ai',
        },
      }}
    />
  );
}
