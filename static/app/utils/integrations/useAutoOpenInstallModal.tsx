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
 * Auto-opens the integration install modal once when the detail page is loaded
 * with `?showInstallModal=1` (e.g. from the Slack reinstall nudge). Gated to
 * mirror the install button: the provider must be installable and the user must
 * have integration access. The param is stripped after opening so refresh /
 * back-button don't re-trigger it.
 */
export function useAutoOpenInstallModal({
  provider,
  organization,
  onInstall,
  installationStatus,
}: Props) {
  const [showInstallModal, setShowInstallModal] = useQueryState('showInstallModal');
  const {startFlow} = useAddIntegration();
  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    if (hasAutoOpenedRef.current || showInstallModal !== '1') {
      return;
    }
    if (!provider?.canAdd || !organization.access.includes('org:integrations')) {
      return;
    }

    hasAutoOpenedRef.current = true;

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
