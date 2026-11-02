import {useState} from 'react';

import type {SeerOutOfCreditsCtaProps} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import {
  SeerOutOfCreditsNotice,
  type SeerOutOfCreditsEscalation,
} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsNotice';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import type {Organization} from 'sentry/types/organization';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

import {sendAddEventsRequest} from 'getsentry/actionCreators/upsell';
import {useSubscription} from 'getsentry/hooks/useSubscription';
import type {Subscription} from 'getsentry/types';

function getEscalation(
  organization: Organization,
  subscription: Subscription | null
): SeerOutOfCreditsEscalation {
  if (organization.access.includes('org:billing')) {
    return 'top-up';
  }
  // Members of orgs that buy through an account team have nobody to send a
  // self-serve request to, same as the upgrade and trial CTAs.
  if (subscription?.canSelfServe) {
    return 'request';
  }
  return 'contact';
}

export function SeerOutOfCreditsCta({message}: SeerOutOfCreditsCtaProps) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const subscription = useSubscription();
  const [isRequestingCredits, setIsRequestingCredits] = useState(false);

  async function handleRequestCredits() {
    setIsRequestingCredits(true);
    // Reuses Seer's "Request Budget" email until there is a credits variant
    // that links to the Seer wallet. It shows its own sending and sent toasts.
    await sendAddEventsRequest({
      api,
      organization,
      eventTypes: [DATA_CATEGORY_INFO.seer_autofix.singular],
    });
    setIsRequestingCredits(false);
  }

  return (
    <SeerOutOfCreditsNotice
      escalation={getEscalation(organization, subscription)}
      message={message}
      // The Seer wallet card on the billing overview is where credits are
      // managed until there is an in-place top-up modal.
      topUpTo={`/settings/${organization.slug}/billing/overview/`}
      onRequestCredits={handleRequestCredits}
      isRequestingCredits={isRequestingCredits}
    />
  );
}
