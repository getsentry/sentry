import {useState} from 'react';
import {useStore} from 'zustand';

import {usePrompts} from 'sentry/actionCreators/prompts';
import type {Organization} from 'sentry/types/organization';
import type {SeerCreditDenialReason} from 'sentry/utils/seer/useSeerCreditCheck';
import {useApi} from 'sentry/utils/useApi';

import {sendSeerTopUpRequest} from 'getsentry/actionCreators/upsell';
import type {SeerOutOfCreditsEscalation} from 'getsentry/components/ai/seerOutOfCreditsNotice';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';
import {trialPromptIsDismissed} from 'getsentry/utils/billing';

const TOP_UP_REQUESTED_PROMPT = 'seer_top_up_requested';

function getEscalation(
  organization: Organization,
  subscription: Subscription | null
): SeerOutOfCreditsEscalation {
  if (organization.access.includes('org:billing')) {
    return 'configure';
  }
  // Members of orgs that buy through an account team have nobody to send a
  // self-serve request to, same as the upgrade and trial CTAs.
  if (subscription?.canSelfServe) {
    return 'request';
  }
  return 'contact';
}

/**
 * Who the viewer turns to for more Seer credits, and the "Contact Admin"
 * request that emails their admins when it's `request`.
 */
export function useSeerTopUpRequest(organization: Organization) {
  const api = useApi({persistInFlight: true});
  const subscription = useStore(
    SubscriptionStore,
    state => state[organization.slug] ?? null
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const escalation = getEscalation(organization, subscription);

  const {isLoading, isPromptDismissed, snoozePrompt} = usePrompts({
    features: [TOP_UP_REQUESTED_PROMPT],
    organization,
    // A request counts until the billing period ends, when the included Seer
    // credits refill.
    isDismissed: prompt => !!subscription && trialPromptIsDismissed(prompt, subscription),
    options: {enabled: escalation === 'request'},
  });

  async function requestCredits(denialReason?: SeerCreditDenialReason | null) {
    setIsRequesting(true);
    // Shows its own sending and sent toasts, and snoozes only when the request succeeds.
    await sendSeerTopUpRequest({
      api,
      organization,
      denialReason,
      handleSuccess: () => snoozePrompt(TOP_UP_REQUESTED_PROMPT),
    });
    setIsRequesting(false);
  }

  return {
    escalation,
    /**
     * Whether the viewer already emailed their admins this billing period is
     * still loading. Until it has, "Contact Admin" could send another request.
     */
    isLoading: escalation === 'request' && isLoading,
    hasRequested: !!isPromptDismissed[TOP_UP_REQUESTED_PROMPT],
    isRequesting,
    requestCredits,
  };
}
