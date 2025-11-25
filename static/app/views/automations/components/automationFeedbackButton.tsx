import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';

export function AutomationFeedbackButton() {
  return (
    <FeedbackButton
      size="sm"
      feedbackOptions={{
        messagePlaceholder: t('How can we improve the alerts experience?'),
        tags: {
          ['feedback.source']: 'automations',
          ['feedback.owner']: 'aci',
        },
      }}
    >
      {t('Feedback')}
    </FeedbackButton>
  );
}
