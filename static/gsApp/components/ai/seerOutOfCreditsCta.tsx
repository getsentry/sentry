import {useState} from 'react';

import {usePrompts} from 'sentry/actionCreators/prompts';
import type {SeerOutOfCreditsCtaProps} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import {
  SeerOutOfCreditsNotice,
  type SeerOutOfCreditsEscalation,
} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsNotice';
import type {Organization} from 'sentry/types/organization';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

import {sendSeerTopUpRequest} from 'getsentry/actionCreators/upsell';
import {useSubscription} from 'getsentry/hooks/useSubscription';
import type {Subscription} from 'getsentry/types';
import {trialPromptIsDismissed} from 'getsentry/utils/billing';

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

const TOP_UP_REQUESTED_PROMPT = 'seer_top_up_requested';

export function SeerOutOfCreditsCta({message}: SeerOutOfCreditsCtaProps) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const subscription = useSubscription();
  const [isRequestingCredits, setIsRequestingCredits] = useState(false);
  const escalation = getEscalation(organization, subscription);

  const {isPromptDismissed, snoozePrompt} = usePrompts({
    features: [TOP_UP_REQUESTED_PROMPT],
    organization,
    // A request counts until the billing period ends, when the included Seer
    // credits refill.
    isDismissed: prompt => !!subscription && trialPromptIsDismissed(prompt, subscription),
    options: {enabled: escalation === 'request'},
  });

  async function handleRequestCredits() {
    setIsRequestingCredits(true);
    // Shows its own sending and sent toasts, and snoozes only when the request succeeds.
    await sendSeerTopUpRequest({
      api,
      organization,
      handleSuccess: () => snoozePrompt(TOP_UP_REQUESTED_PROMPT),
    });
    setIsRequestingCredits(false);
  }

  return (
    <SeerOutOfCreditsNotice
      escalation={escalation}
      message={message}
      // The Seer wallet card on the billing overview is where credits are
      // managed until there is an in-place top-up modal.
      topUpTo={`/settings/${organization.slug}/billing/overview/`}
      onRequestCredits={handleRequestCredits}
      isRequestingCredits={isRequestingCredits}
      hasRequestedCredits={isPromptDismissed[TOP_UP_REQUESTED_PROMPT]}
    />
  );
}
