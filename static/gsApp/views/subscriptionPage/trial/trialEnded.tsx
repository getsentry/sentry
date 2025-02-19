import {Alert} from 'sentry/components/core/alert';
import {tct} from 'sentry/locale';

import ZendeskLink from 'getsentry/components/zendeskLink';
import type {Subscription} from 'getsentry/types';

type Props = {
  subscription: Subscription;
};

function TrialEnded({subscription}: Props) {
  const canRequestTrial =
    subscription.canSelfServe && subscription.planDetails?.trialPlan;

  if (subscription.isTrial || subscription.canTrial || !canRequestTrial) {
    return null;
  }

  const supportLink = <ZendeskLink subject="Request Another Trial" source="trial" />;

  return (
    <Alert.Container>
      <Alert type="info">
        {tct(
          'Your free trial has ended. You may [supportLink:contact support] to request another trial.',
          {supportLink}
        )}
      </Alert>
    </Alert.Container>
  );
}

export default TrialEnded;
