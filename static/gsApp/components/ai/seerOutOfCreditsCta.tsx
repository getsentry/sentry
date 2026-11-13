import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {usePrompts} from 'sentry/actionCreators/prompts';
import type {SeerOutOfCreditsCtaProps} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import type {Organization} from 'sentry/types/organization';
import type {SeerCreditDenialReason} from 'sentry/utils/seer/useSeerCreditCheck';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

import {sendSeerTopUpRequest} from 'getsentry/actionCreators/upsell';
import {
  SeerOutOfCreditsNotice,
  type SeerOutOfCreditsEscalation,
} from 'getsentry/components/ai/seerOutOfCreditsNotice';
import {useSubscription} from 'getsentry/hooks/useSubscription';
import type {Subscription} from 'getsentry/types';
import {trialPromptIsDismissed} from 'getsentry/utils/billing';
import {openSeerAutoTopUpModal} from 'getsentry/views/subscriptionPage/seerWallet/autoTopUpModal';
import {seerWalletAutoTopUpOptions} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

function getEscalation(
  organization: Organization,
  subscription: Subscription | null,
  denialReason: SeerCreditDenialReason | null | undefined
): SeerOutOfCreditsEscalation {
  if (organization.access.includes('org:billing')) {
    return 'configure';
  }
  // "Contact Admin" asks the admins for more credits, which doesn't lift the
  // daily usage limit, so members are only told to ask them about the limit.
  if (denialReason === 'daily_cap_exceeded') {
    return 'contact';
  }
  // Members of orgs that buy through an account team have nobody to send a
  // self-serve request to, same as the upgrade and trial CTAs.
  if (subscription?.canSelfServe) {
    return 'request';
  }
  return 'contact';
}

const TOP_UP_REQUESTED_PROMPT = 'seer_top_up_requested';

export function SeerOutOfCreditsCta({
  reason,
  denialReason,
  size,
  variant,
}: SeerOutOfCreditsCtaProps) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const subscription = useSubscription();
  const [isRequestingCredits, setIsRequestingCredits] = useState(false);
  const escalation = getEscalation(organization, subscription, denialReason);

  const {
    isLoading: isPromptLoading,
    isPromptDismissed,
    snoozePrompt,
  } = usePrompts({
    features: [TOP_UP_REQUESTED_PROMPT],
    organization,
    // A request counts until the billing period ends, when the included Seer
    // credits refill.
    isDismissed: prompt => !!subscription && trialPromptIsDismissed(prompt, subscription),
    options: {enabled: escalation === 'request'},
  });

  // With auto-reload on, running out means the org hit its daily usage limit,
  // which gets its own copy. Only billing members can read the setting.
  const {data: autoTopUp, isPending: isAutoTopUpPending} = useQuery({
    ...seerWalletAutoTopUpOptions(organization),
    enabled: escalation === 'configure',
    retry: false,
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

  // Wait for what the notice depends on. Otherwise billing members with
  // auto-reload on see the "off" copy first, and members who already emailed
  // their admins this period could send another request before "Admins emailed"
  // shows.
  if (
    (escalation === 'configure' && isAutoTopUpPending) ||
    (escalation === 'request' && isPromptLoading)
  ) {
    return null;
  }

  return (
    <SeerOutOfCreditsNotice
      reason={reason}
      denialReason={denialReason}
      size={size}
      variant={variant}
      escalation={escalation}
      autoReloadEnabled={autoTopUp?.enabled}
      onConfigureAutoReload={() => openSeerAutoTopUpModal({organization})}
      onRequestCredits={handleRequestCredits}
      isRequestingCredits={isRequestingCredits}
      hasRequestedCredits={isPromptDismissed[TOP_UP_REQUESTED_PROMPT]}
    />
  );
}
