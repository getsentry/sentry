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
  isConfigurationsPending: boolean;
  organization: Organization;
  /** Installations flagged as requiring a permissions upgrade. */
  outdatedConfigurations: Integration[];
  provider: IntegrationProvider | undefined;
}

/**
 * Auto-opens the update-permissions modal once per provider when the detail
 * page is loaded with `?showPermsModal=1` (e.g. from the outdated-integration
 * "click here" link). The param is stripped after opening so refresh /
 * back-button don't re-trigger it.
 *
 * The dedupe is keyed on the provider rather than mount: the detail view stays
 * mounted across client-side navigation between integration detail routes (only
 * the slug param changes), so a later visit for a different provider must still
 * open — while re-adding the param for the same provider must not re-open.
 *
 * Only GitHub has a permissions modal (its outdated state means missing app
 * permissions); for other providers this no-ops.
 */
export function useAutoOpenPermissionsModal({
  provider,
  organization,
  outdatedConfigurations,
  isConfigurationsPending,
}: Props) {
  const [showPermsModal, setShowPermsModal] = useQueryState('showPermsModal');
  const autoOpenedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (showPermsModal !== '1' || !canManageIntegrations(organization)) {
      return;
    }
    if (isConfigurationsPending || !provider) {
      return;
    }
    if (autoOpenedForRef.current === provider.key) {
      return;
    }

    autoOpenedForRef.current = provider.key;

    if (provider.key === 'github' && outdatedConfigurations.length === 1) {
      const [outdatedConfiguration] = outdatedConfigurations;
      openGithubPermissionsUpdateModal(outdatedConfiguration!);
    }

    setShowPermsModal(null);
  }, [
    showPermsModal,
    setShowPermsModal,
    isConfigurationsPending,
    provider,
    organization,
    outdatedConfigurations,
  ]);
}
