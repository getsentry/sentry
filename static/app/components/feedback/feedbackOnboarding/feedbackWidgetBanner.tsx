import type {CSSProperties} from 'react';

import replaysDeadRageBackground from 'sentry-images/spot/replay-dead-rage-changelog.svg';

import PageBanner from 'sentry/components/alerts/pageBanner';
import {Button} from 'sentry/components/button';
import {useFeedbackOnboardingSidebarPanel} from 'sentry/components/feedback/useFeedbackOnboarding';
import {t} from 'sentry/locale';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useOrganization from 'sentry/utils/useOrganization';

export default function FeedbackWidgetBanner({style}: {style?: CSSProperties}) {
  const {activateSidebar} = useFeedbackOnboardingSidebarPanel();
  const organization = useOrganization();

  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:feedback-widget-callout`,
  });

  if (isDismissed) {
    return null;
  }

  return (
    <PageBanner
      style={style}
      button={
        <Button
          priority="primary"
          analyticsEventName="Clicked Feedback Onboarding CTA Button in Widget Callout Banner"
          analyticsEventKey="feedback.widget-banner-cta-button-clicked"
          onClick={activateSidebar}
        >
          {t('Set Up Now')}
        </Button>
      }
      description={t(
        'Want to receive user feedback at any time, not just when an error happens? Learn how to set up our customizable user feedback widget.'
      )}
      heading={t('Introducing the User Feedback Widget')}
      icon={null}
      image={replaysDeadRageBackground}
      title={null}
      onDismiss={() => {
        dismiss();
      }}
    />
  );
}
