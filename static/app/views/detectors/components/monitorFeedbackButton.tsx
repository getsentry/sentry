import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

const monitorFeedbackOptions = {
  messagePlaceholder: t('How can we improve the monitor experience?'),
  tags: {
    ['feedback.source']: 'monitors',
    ['feedback.owner']: 'aci',
  },
};

export function MonitorFeedbackButton() {
  const hasPageFrameFeature = useHasPageFrameFeature();

  if (hasPageFrameFeature) {
    return (
      <TopBar.Slot name="feedback">
        <FeedbackButton feedbackOptions={monitorFeedbackOptions}>{null}</FeedbackButton>
      </TopBar.Slot>
    );
  }

  return (
    <FeedbackButton size="sm" feedbackOptions={monitorFeedbackOptions}>
      {t('Feedback')}
    </FeedbackButton>
  );
}
