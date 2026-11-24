import {useEffect, useRef} from 'react';

import type {Organization} from 'sentry/types/organization';
import {
  SEER_CREDIT_DENIAL_REASONS,
  type SeerCreditDenialReason,
} from 'sentry/utils/seer/useSeerCreditCheck';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import {openSeerAutoTopUpModal} from 'getsentry/views/subscriptionPage/seerWallet/autoTopUpModal';
import {SEER_AUTO_RELOAD_MODAL_HASH} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

function parseDenialReason(value: string | undefined): SeerCreditDenialReason | null {
  return SEER_CREDIT_DENIAL_REASONS.find(reason => reason === value) ?? null;
}

/**
 * Opens the Seer auto-reload modal on any organization page whose URL has
 * `#open-seer-auto-reload-modal`, so emails and Slack can link straight to it.
 * Everyone can open the link: the modal asks members without billing access to
 * contact their admins, about the reason after the hash's `:` when it has one.
 */
export function useSeerAutoReloadModalLink(organization: Organization) {
  const location = useLocation();
  const navigate = useNavigate();
  const [hash, reason] = location.hash.split(':');
  const isLinked = hash === SEER_AUTO_RELOAD_MODAL_HASH;
  const denialReason = parseDenialReason(reason);
  const hasSeerWallet = organization.features.includes('token-billed-seer-enabled');
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    // Reset once the hash is gone, so following the link again opens the modal
    // again.
    if (!isLinked) {
      hasOpenedRef.current = false;
      return;
    }
    // Clearing the hash lands later, so the effect can run again before it
    // does, such as when the organization reloads. Opening again would remount
    // the modal.
    if (hasSeerWallet && !hasOpenedRef.current) {
      hasOpenedRef.current = true;
      openSeerAutoTopUpModal({organization, denialReason});
    }
    // Clear the hash so a refresh doesn't open the modal again. The modal
    // only closes when the path changes, so it stays open.
    navigate({pathname: location.pathname, search: location.search}, {replace: true});
  }, [
    isLinked,
    denialReason,
    hasSeerWallet,
    organization,
    navigate,
    location.pathname,
    location.search,
  ]);
}
