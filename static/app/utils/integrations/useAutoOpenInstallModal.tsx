import {useEffect, useRef} from 'react';
import {useQueryState} from 'nuqs';

import type {
  IntegrationProvider,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getSlackUpgradeModalParams} from 'sentry/utils/integrations/slackUpgradeModalParams';
import type {AddIntegrationParams} from 'sentry/utils/integrations/useAddIntegration';
import {integrationRequiresUpgrade} from 'sentry/utils/integrationUtil';

interface Props {
  onInstall: AddIntegrationParams['onInstall'];
  organization: Organization;
  provider: IntegrationProvider;
  /**
   * The caller's `startFlow` from `useAddIntegration`. Accepting it here rather
   * than creating a second hook instance means the auto-open and button-click
   * paths share one hook, keeping install state observable in one place.
   */
  startFlow: (params: AddIntegrationParams) => void;
  analyticsParams?: AddIntegrationParams['analyticsParams'];
  configurations?: OrganizationIntegration[];
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
  startFlow,
  analyticsParams,
  suppressSuccessMessage,
  configurations,
}: Props) {
  const [showInstallModal, setShowInstallModal] = useQueryState('showInstallModal');
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

    // Only the detail page's gated install button has loaded configurations.
    // Row update buttons must not race it or choose an arbitrary workspace.
    if (provider.key === 'slack' && !configurations) {
      return;
    }
    const outdatedConfigurations = configurations?.filter(integrationRequiresUpgrade);
    const upgradeConfiguration =
      outdatedConfigurations?.length === 1 ? outdatedConfigurations[0] : undefined;
    if (provider.key === 'slack' && !upgradeConfiguration) {
      setShowInstallModal(null);
      return;
    }

    autoOpenedForRef.current = provider.key;

    trackAnalytics('integrations.install_modal_auto_opened', {
      organization,
      integration: provider.key,
      integration_type: 'first_party',
      ...analyticsParams,
    });

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
        modalParams: getSlackUpgradeModalParams(upgradeConfiguration?.missingFeatures),
      }),
    });

    setShowInstallModal(null);
  }, [
    showInstallModal,
    configurations,
    provider,
    organization,
    onInstall,
    analyticsParams,
    suppressSuccessMessage,
    startFlow,
    setShowInstallModal,
  ]);
}
