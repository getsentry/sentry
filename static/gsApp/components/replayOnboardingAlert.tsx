import type {ReactNode} from 'react';
import {Fragment} from 'react';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';

type Props = {
  children: ReactNode;
  subscription: Subscription;
};

function ReplayOnboardingAlert({children, subscription}: Props) {
  // in `sentry` we render an info alert to re-enforce the "Select/Create Project" CTA
  // this does not apply for AM1 plans so we'll simply hide it
  if (subscription.planTier === PlanTier.AM1) {
    return null;
  }

  return <Fragment>{children}</Fragment>;
}

export default withSubscription(ReplayOnboardingAlert, {noLoader: true});
