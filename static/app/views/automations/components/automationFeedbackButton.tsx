import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import {TopBar} from 'sentry/views/navigation/topBar';

const automationFeedbackOptions = {
  messagePlaceholder: t('How can we improve the alerts experience?'),
  tags: {
    ['feedback.source']: 'automations',
    ['feedback.owner']: 'aci',
  },
};

export function AutomationFeedbackButton() {
  return (
    <TopBar.Slot name="feedback">
      <FeedbackButton
        feedbackOptions={automationFeedbackOptions}
        aria-label={t('Feedback')}
        tooltipProps={{title: t('Feedback')}}
      >
        {null}
      </FeedbackButton>
    </TopBar.Slot>
  );
}
