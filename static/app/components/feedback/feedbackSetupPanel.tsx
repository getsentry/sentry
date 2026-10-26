import {useEffect} from 'react';

import feedbackOnboardingImg from 'sentry-images/spot/feedback-onboarding.svg';

import {Button} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Image} from '@sentry/scraps/image';

import {useFeedbackOnboardingSidebarPanel} from 'sentry/components/feedback/useFeedbackOnboarding';
import {Panel} from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

export function FeedbackSetupPanel() {
  const organization = useOrganization();
  const {activateSidebar} = useFeedbackOnboardingSidebarPanel();

  useEffect(() => {
    trackAnalytics('feedback.index-setup-viewed', {
      organization,
    });
  }, [organization]);

  return (
    <Panel style={{margin: 0}}>
      <EmptyState
        padding="3xl"
        align="center"
        justify="center"
        illustration={
          <Image
            width="auto"
            height={{zero: '150px', lg: '185px'}}
            loading="eager"
            src={feedbackOnboardingImg}
            alt={t(
              'Illustration of a purple character pushing a wheelbarrow filled with feedback speech bubbles'
            )}
          />
        }
        title={t('Set Up User Feedback')}
        description={t(
          'Allow your users to create bug reports so they can let you know about these sneaky issues right away. Every report will automatically include related replays, tags, and errors, making fixing the issue dead simple.'
        )}
        action={
          <Button
            onClick={activateSidebar}
            variant="primary"
            analyticsEventName="Clicked Feedback Onboarding Setup - Feedback Index"
            analyticsEventKey="feedback.index-click-onboarding-setup"
          >
            {t('Set Up Now')}
          </Button>
        }
      />
    </Panel>
  );
}
