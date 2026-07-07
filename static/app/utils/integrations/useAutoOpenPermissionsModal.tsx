import {useEffect, useRef} from 'react';
import {useQueryState} from 'nuqs';

import {openModal} from 'sentry/actionCreators/modal';
import {AutofixGithubAppPermissionsModal} from 'sentry/components/events/autofix/autofixGithubAppPermissionsModal';
import {t} from 'sentry/locale';
import type {Integration, IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {
  canManageIntegrations,
  getGithubPermissionsUpdateUrl,
} from 'sentry/utils/integrationUtil';

/**
 * Opens the GitHub App update-permissions modal for a single installation.
 * Used both by the auto-open flow below and the manual "Update now" button on
 * the integration detail page.
 */
export function openGithubPermissionsUpdateModal(integration: Integration) {
  const installationUrl = integration.externalId
    ? getGithubPermissionsUpdateUrl(integration.externalId)
    : undefined;

  openModal(deps => (
    <AutofixGithubAppPermissionsModal
      {...deps}
      installationUrl={installationUrl}
      description={t(
        'This GitHub App installation is missing permissions required for the latest features. Update the installation to grant the required permissions.'
      )}
    />
  ));
}

interface Props {
  /**
   * Whether the configurations query is still loading. We wait for it to
   * settle before deciding whether to open the modal or clear the param,
   * otherwise we'd strip `showPermsModal` before the data arrives and the
   * modal would never open.
   */
  isConfigurationsLoading: boolean;
  organization: Organization;
  /** Installations flagged as requiring a permissions upgrade. */
  outdatedConfigurations: Integration[];
  provider: IntegrationProvider | undefined;
}

/**
 * Auto-opens the update-permissions modal when the detail page is loaded with
 * `?showPermsModal=1` (e.g. from the outdated-integration "click here" link).
 * The param is stripped once configs load so refresh / back-button don't
 * re-trigger it, and a fresh arrival (re-adding the param) opens it again.
 *
 * Only GitHub has a permissions modal (its outdated state means missing app
 * permissions); for other providers this no-ops.
 */
export function useAutoOpenPermissionsModal({
  provider,
  organization,
  outdatedConfigurations,
  isConfigurationsLoading,
}: Props) {
  const [showPermsModal, setShowPermsModal] = useQueryState('showPermsModal');
  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    // Reset when the param is absent so a fresh arrival (e.g. re-clicking the
    // link) can auto-open again. While the param is present this ref only
    // guards against a double-open before setShowPermsModal(null) lands.
    if (showPermsModal !== '1') {
      hasAutoOpenedRef.current = false;
      return;
    }
    if (!canManageIntegrations(organization)) {
      hasAutoOpenedRef.current = false;
      setShowPermsModal(null);
      return;
    }
    if (isConfigurationsLoading || !provider || hasAutoOpenedRef.current) {
      return;
    }

    if (provider.key === 'github' && outdatedConfigurations.length === 1) {
      const [outdatedConfiguration] = outdatedConfigurations;
      hasAutoOpenedRef.current = true;
      openGithubPermissionsUpdateModal(outdatedConfiguration!);
    }

    setShowPermsModal(null);
  }, [
    showPermsModal,
    setShowPermsModal,
    isConfigurationsLoading,
    provider,
    organization,
    outdatedConfigurations,
  ]);
}
