import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';

export function MonitorFeedbackButton() {
  return (
    <FeedbackButton
      size="sm"
      feedbackOptions={{
        messagePlaceholder: t('How can we improve the monitor experience?'),
        tags: {
          ['feedback.source']: 'monitors',
          ['feedback.owner']: 'aci',
        },
      }}
    >
      {t('Feedback')}
    </FeedbackButton>
  );
}
