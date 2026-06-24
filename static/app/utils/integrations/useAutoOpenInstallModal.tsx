import {useEffect, useRef} from 'react';
import {useQueryState} from 'nuqs';

import type {
  Integration,
  IntegrationInstallationStatus,
  IntegrationProvider,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';

interface Props {
  installationStatus: IntegrationInstallationStatus;
  onInstall: (integration: Integration) => void;
  organization: Organization;
  provider: IntegrationProvider | undefined;
}

/**
 * Auto-opens the integration install modal once per provider when the detail
 * page is loaded with `?showInstallModal=1` (e.g. from the Slack reinstall
 * nudge). Gated to mirror the install button: provider installable, user has
 * integration access, and the org's plan allows it. The param is stripped after
 * opening so refresh / back-button don't re-trigger it.
 *
 * The dedupe is keyed on the provider rather than mount: this view stays mounted
 * across client-side navigation between integration detail routes (only the slug
 * param changes), so a later visit for a different provider must still open.
 */
export function useAutoOpenInstallModal({
  provider,
  organization,
  onInstall,
  installationStatus,
}: Props) {
  const [showInstallModal, setShowInstallModal] = useQueryState('showInstallModal');
  const {startFlow} = useAddIntegration();
  const autoOpenedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (showInstallModal !== '1') {
      return;
    }
    if (!provider?.canAdd || !organization.access.includes('org:integrations')) {
      return;
    }
    if (autoOpenedForRef.current === provider.key) {
      return;
    }
    // Mirror the install button's plan gate: install is disabled when the org
    // has none of the provider's feature flags.
    const features = provider.metadata.features;
    const disabledFromFeatures =
      features.length > 0 &&
      !features.some(feature => organization.features.includes(feature.featureGate));
    if (disabledFromFeatures) {
      return;
    }

    autoOpenedForRef.current = provider.key;

    startFlow({
      provider,
      organization,
      onInstall,
      analyticsParams: {
        view: 'integrations_directory_integration_detail',
        already_installed: installationStatus !== 'Not Installed',
      },
    });

    setShowInstallModal(null);
  }, [
    showInstallModal,
    provider,
    organization,
    onInstall,
    installationStatus,
    startFlow,
    setShowInstallModal,
  ]);
}
