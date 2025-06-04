import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import {TourAction, TourGuide} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useOrganization from 'sentry/utils/useOrganization';

const LOCAL_STORAGE_KEY = 'insights.session_health_tour';

export default function FeedbackButtonTour() {
  const organization = useOrganization();
  const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});

  return (
    <TourGuide
      title={t('Tell Us Your Opinion on Session Health')}
      description={t(`Are we missing a chart you'd like to see? Let us know.`)}
      actions={
        <TourAction
          size="xs"
          onClick={() => {
            trackAnalytics('insights.session_health_tour.dismissed', {
              organization,
            });
            dismiss();
          }}
        >
          {t('Got it')}
        </TourAction>
      }
      isOpen={!isDismissed}
    >
      <FeedbackWidgetButton
        optionOverrides={{
          tags: {
            ['feedback.source']: 'insights.session_health',
            ['feedback.owner']: 'replay',
          },
        }}
      />
    </TourGuide>
  );
}
