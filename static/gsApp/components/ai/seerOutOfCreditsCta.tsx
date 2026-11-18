import {useQuery} from '@tanstack/react-query';

import type {SeerOutOfCreditsCtaProps} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SeerOutOfCreditsNotice} from 'getsentry/components/ai/seerOutOfCreditsNotice';
import {useSeerTopUpRequest} from 'getsentry/components/ai/useSeerTopUpRequest';
import {openSeerAutoTopUpModal} from 'getsentry/views/subscriptionPage/seerWallet/autoTopUpModal';
import {seerWalletAutoTopUpOptions} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

export function SeerOutOfCreditsCta({
  reason,
  denialReason,
  size,
  variant,
}: SeerOutOfCreditsCtaProps) {
  const organization = useOrganization();
  const {escalation, isLoading, hasRequested, isRequesting, requestCredits} =
    useSeerTopUpRequest(organization);

  // With auto-reload on, running out means the org hit its daily usage limit,
  // which gets its own copy. Only billing members can read the setting.
  const {data: autoTopUp, isPending: isAutoTopUpPending} = useQuery({
    ...seerWalletAutoTopUpOptions(organization),
    enabled: escalation === 'configure',
    retry: false,
  });

  // Wait for what the notice depends on. Otherwise billing members with
  // auto-reload on see the "off" copy first, and members who already emailed
  // their admins this period could send another request before "Admins emailed"
  // shows.
  if ((escalation === 'configure' && isAutoTopUpPending) || isLoading) {
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
      onRequestCredits={() => requestCredits(denialReason)}
      isRequestingCredits={isRequesting}
      hasRequestedCredits={hasRequested}
    />
  );
}
