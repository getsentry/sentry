import {useEffect} from 'react';

import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import {openSeerAutoTopUpModal} from 'getsentry/views/subscriptionPage/seerWallet/autoTopUpModal';
import {SEER_AUTO_RELOAD_MODAL_HASH} from 'getsentry/views/subscriptionPage/seerWallet/seerWalletOptions';

/**
 * Opens the Seer auto-reload modal on any organization page whose URL has
 * `#open-seer-auto-reload-modal`, so emails and Slack can link straight to it.
 * Everyone can open the link: the modal asks members without billing access to
 * contact their admins.
 */
export function useSeerAutoReloadModalLink(organization: Organization) {
  const location = useLocation();
  const navigate = useNavigate();
  const isLinked = location.hash === SEER_AUTO_RELOAD_MODAL_HASH;
  const hasSeerWallet = organization.features.includes('token-billed-seer-enabled');

  useEffect(() => {
    if (!isLinked) {
      return;
    }
    if (hasSeerWallet) {
      openSeerAutoTopUpModal({organization});
    }
    // Clear the hash so a refresh doesn't open the modal again. The modal
    // only closes when the path changes, so it stays open.
    navigate({pathname: location.pathname, search: location.search}, {replace: true});
  }, [
    isLinked,
    hasSeerWallet,
    organization,
    navigate,
    location.pathname,
    location.search,
  ]);
}
