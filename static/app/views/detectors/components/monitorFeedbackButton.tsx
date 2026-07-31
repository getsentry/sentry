import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import {TopBar} from 'sentry/views/navigation/topBar';

const monitorFeedbackOptions = {
  messagePlaceholder: t('How can we improve the monitor experience?'),
  tags: {
    ['feedback.source']: 'monitors',
    ['feedback.owner']: 'aci',
  },
};

export function MonitorFeedbackButton() {
  return (
    <TopBar.Slot name="feedback">
      <FeedbackButton
        feedbackOptions={monitorFeedbackOptions}
        aria-label={t('Feedback')}
        tooltipProps={{title: t('Feedback')}}
      >
        {null}
      </FeedbackButton>
    </TopBar.Slot>
  );
}
