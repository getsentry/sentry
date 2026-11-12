import {t} from 'sentry/locale';
import {TopBar} from 'sentry/views/navigation/topBar';

const automationFeedbackOptions = {
  messagePlaceholder: t('How can we improve the alerts experience?'),
  tags: {
    'feedback.source': 'automations',
    'feedback.owner': 'aci',
  },
};

export function AutomationFeedbackButton() {
  return <TopBar.Slot name="feedback" feedbackOptions={automationFeedbackOptions} />;
}
