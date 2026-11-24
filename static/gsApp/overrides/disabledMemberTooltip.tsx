import {Tooltip} from '@sentry/scraps/tooltip';

import {tct} from 'sentry/locale';

import {SubscriptionLoadingFallback} from 'getsentry/components/subscriptionLoadingFallback';
import {useSubscription} from 'getsentry/hooks/useSubscription';
import {displayPlanName} from 'getsentry/utils/billing';

type Props = {children: React.ReactNode};

export function DisabledMemberTooltip({children}: Props) {
  const subscription = useSubscription();

  if (!subscription) {
    return <SubscriptionLoadingFallback />;
  }

  // only disabling members for plans with exactly 1 member
  const title = tct('Only 1 member allowed with [planName] Plan', {
    planName: displayPlanName(subscription.planDetails),
  });

  return <Tooltip title={title}>{children}</Tooltip>;
}
