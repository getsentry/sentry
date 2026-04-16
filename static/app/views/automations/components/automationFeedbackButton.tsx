import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

const automationFeedbackOptions = {
  messagePlaceholder: t('How can we improve the alerts experience?'),
  tags: {
    ['feedback.source']: 'automations',
    ['feedback.owner']: 'aci',
  },
};

export function AutomationFeedbackButton() {
  const hasPageFrameFeature = useHasPageFrameFeature();

  if (hasPageFrameFeature) {
    return (
      <TopBar.Slot name="feedback">
        <FeedbackButton feedbackOptions={automationFeedbackOptions}>
          {null}
        </FeedbackButton>
      </TopBar.Slot>
    );
  }

  return (
    <FeedbackButton size="sm" feedbackOptions={automationFeedbackOptions}>
      {t('Feedback')}
    </FeedbackButton>
  );
}
