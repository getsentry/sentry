import {useEffect, useRef} from 'react';
import {useQueryState} from 'nuqs';

import {t} from 'sentry/locale';
import type {IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {AddIntegrationParams} from 'sentry/utils/integrations/useAddIntegration';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';

interface Props {
  onInstall: AddIntegrationParams['onInstall'];
  organization: Organization;
  provider: IntegrationProvider;
  analyticsParams?: AddIntegrationParams['analyticsParams'];
  suppressSuccessMessage?: boolean;
}

/**
 * Auto-opens the integration install modal once per provider when the detail
 * page is loaded with `?showInstallModal=1` (e.g. from the Slack reinstall
 * nudge). The param is stripped after opening so refresh / back-button don't
 * re-trigger it.
 *
 * This is called from {@link AddIntegrationButton}, so auto-open inherits the
 * button's render gating for free: the button only renders for installable
 * (`canAdd`) providers, when the user has integration access, and when the org's
 * plan allows it. No separate feature/access checks are needed here.
 *
 * The dedupe is keyed on the provider rather than mount: the install button stays
 * mounted across client-side navigation between integration detail routes (only
 * the slug param changes), so a later visit for a different provider must still
 * open.
 */
export function useAutoOpenInstallModal({
  provider,
  organization,
  onInstall,
  analyticsParams,
  suppressSuccessMessage,
}: Props) {
  const [showInstallModal, setShowInstallModal] = useQueryState('showInstallModal');
  const {startFlow} = useAddIntegration();
  const autoOpenedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (showInstallModal !== '1') {
      return;
    }
    if (!provider.canAdd) {
      return;
    }
    if (autoOpenedForRef.current === provider.key) {
      return;
    }

    autoOpenedForRef.current = provider.key;

    // NOTE: The `?showInstallModal=1` entry point is currently only used by the
    // Slack reinstall/upgrade nudge, so we override the generic install modal
    // copy to frame it as a reauthorization. `useAddIntegration` itself is
    // provider-agnostic and may outlive this usage; if other providers start
    // auto-opening, lift this out rather than hardcoding it to Slack here.
    startFlow({
      provider,
      organization,
      onInstall,
      analyticsParams,
      suppressSuccessMessage,
      ...(provider.key === 'slack' && {
        modalParams: {
          title: t('Upgrade Slack Integration'),
          description: t(
            'Reauthorize the Sentry app in your Slack Workspace so you can chat with Seer directly.'
          ),
        },
      }),
    });

    setShowInstallModal(null);
  }, [
    showInstallModal,
    provider,
    organization,
    onInstall,
    analyticsParams,
    suppressSuccessMessage,
    startFlow,
    setShowInstallModal,
  ]);
}
