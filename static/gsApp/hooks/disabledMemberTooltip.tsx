import {Tooltip} from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {displayPlanName} from 'getsentry/utils/billing';

type Props = {
  children: React.ReactNode;
  subscription: Subscription;
};

function DisabledMemberTooltip({subscription, children}: Props) {
  // only disabling members for plans with exactly 1 member
  const title = tct('Only 1 member allowed with [planName] Plan', {
    planName: displayPlanName(subscription.planDetails),
  });

  return <Tooltip title={title}>{children}</Tooltip>;
}
export default withSubscription(DisabledMemberTooltip);
