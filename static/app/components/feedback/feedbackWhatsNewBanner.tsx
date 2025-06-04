import {useEffect} from 'react';

import replaysDeadRageBackground from 'sentry-images/spot/replay-dead-rage-changelog.svg';

import PageBanner from 'sentry/components/alerts/pageBanner';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconBroadcast} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useOrganization from 'sentry/utils/useOrganization';

export default function FeedbackWhatsNewBanner() {
  const organization = useOrganization();

  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:feedback-whats-new-banner`,
  });

  useEffect(() => {
    if (!isDismissed) {
      trackAnalytics('feedback.whats-new-banner-viewed', {
        organization,
      });
    }
  }, [organization, isDismissed]);

  if (isDismissed) {
    return null;
  }

  return (
    <PageBanner
      button={
        <LinkButton
          external
          href="https://docs.sentry.io/product/user-feedback/setup/"
          priority="primary"
          analyticsEventName="Clicked Feedback What's New Banner"
          analyticsEventKey="feedback.whats-new-banner-clicked"
          analyticsParams={{surface: 'whats-new-banner'}}
        >
          {t('Set Up Now')}
        </LinkButton>
      }
      description={t(
        'Users can submit feedback anytime they’re having a problem with your app via our feedback widget.'
      )}
      heading={t('Introducing User Feedback')}
      icon={<IconBroadcast size="sm" />}
      image={replaysDeadRageBackground}
      title={t('What’s new')}
      onDismiss={() => {
        trackAnalytics('feedback.whats-new-banner-dismissed', {
          organization,
        });
        dismiss();
      }}
    />
  );
}
