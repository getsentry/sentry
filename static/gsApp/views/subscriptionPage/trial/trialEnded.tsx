import {useEffect} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import {tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {showIntercom} from 'sentry/utils/intercom';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {Subscription} from 'getsentry/types';
import {isTrial} from 'getsentry/utils/billing';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';

type Props = {
  subscription: Subscription;
};

export function TrialEnded({subscription}: Props) {
  const organization = useOrganization();
  const canRequestTrial =
    subscription.canSelfServe && subscription.planDetails?.trialPlan;
  const shouldRender = !(
    isTrial(subscription) ||
    subscription.canTrial ||
    !canRequestTrial
  );

  useEffect(() => {
    if (shouldRender) {
      trackGetsentryAnalytics('intercom_link.viewed', {
        organization,
        source: 'trial',
      });
    }
  }, [shouldRender, organization]);

  if (!shouldRender) {
    return null;
  }

  async function handleIntercomClick() {
    trackGetsentryAnalytics('intercom_link.clicked', {
      organization,
      source: 'trial',
    });
    try {
      await showIntercom(organization.slug);
    } catch {
      const supportEmail = ConfigStore.get('supportEmail');
      if (supportEmail) {
        window.location.href = `mailto:${supportEmail}?subject=${window.encodeURIComponent('Request Another Trial')}`;
      }
    }
  }

  const supportLink = (
    <Button size="zero" variant="link" onClick={handleIntercomClick}>
      {null}
    </Button>
  );

  return (
    <Alert variant="info" showIcon={false}>
      {tct(
        'Your free trial has ended. You may [supportLink:contact support] to request another trial.',
        {supportLink}
      )}
    </Alert>
  );
}
