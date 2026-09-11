import {useCallback, useEffect} from 'react';
import type {ReactNode} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {MessagingIntegrationAnalyticsView} from 'sentry/components/messagingIntegrations/setupMessagingIntegrationButton';
import {SCM_MESSAGING_PROVIDER_TOOLTIPS} from 'sentry/components/onboarding/scm/messagingProviders';
import type {ScmMessagingProviderKey} from 'sentry/components/onboarding/scm/messagingProviders';
import {ScmMessagingChannelPicker} from 'sentry/components/onboarding/scm/scmMessagingChannelPicker';
import type {
  ScmMessagingActiveRow,
  ScmMessagingSetup,
} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import type {ScmMessagingResolvedProvider} from 'sentry/components/onboarding/scm/useScmMessagingProviders';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {IconInfo} from 'sentry/icons/iconInfo';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import type {
  IntegrationWithConfig,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';
import {useOrganization} from 'sentry/utils/useOrganization';

import {RowActions} from './action';
import {openMsTeamsConnectionModal} from './msTeamsConnection';
import {RowSubtitle} from './subtitle';
import type {RowVisualState} from './types';

function deriveVisualState({
  resolvedProvider,
  installState,
  messagingSetup,
  isConfiguring,
  isRemoving,
  hasInstallAccess,
  isRefetchingIntegrations,
}: {
  hasInstallAccess: boolean;
  installState: ReturnType<typeof useAddIntegration>['state'];
  isConfiguring: boolean;
  isRefetchingIntegrations: boolean;
  isRemoving: boolean;
  messagingSetup: ScmMessagingSetup;
  resolvedProvider: ScmMessagingResolvedProvider;
}): RowVisualState {
  // `installState` is local to this row's `useAddIntegration`, so it always
  // refers to this provider's flow.
  if (installState.status === 'installing') {
    return 'installing';
  }
  // Only surface an install error while still uninstalled; a shared-query
  // refetch may reveal the integration after a local error.
  if (resolvedProvider.status === 'installable') {
    if (installState.status === 'error') {
      return 'install-error';
    }
    if (installState.status === 'cancelled' && installState.lastError) {
      return 'install-error';
    }
  }
  // Show the spinner only while the shared integrations query is actively
  // refetching after install. Once it settles — whether or not the integration
  // surfaced — isRefetchingIntegrations becomes false and the row falls back to
  // installable (Connect), so it can never spin forever.
  if (
    installState.status === 'complete' &&
    isRefetchingIntegrations &&
    resolvedProvider.status === 'installable'
  ) {
    return 'loading';
  }

  if (resolvedProvider.status === 'installable') {
    return hasInstallAccess ? 'installable' : 'install-forbidden';
  }

  if (resolvedProvider.status === 'permission-limited') {
    return 'permission-limited';
  }

  // status === 'connected'
  const isConfigured =
    messagingSetup.mode === 'selected' &&
    messagingSetup.providerKey === resolvedProvider.providerKey &&
    resolvedProvider.eligibleIntegrations.some(
      i => i.id === messagingSetup.integrationId
    );

  if (isConfigured && isConfiguring) {
    return 'configuring'; // Edit mode
  }
  if (isConfigured && isRemoving) {
    return 'removing';
  }
  if (isConfigured) {
    return 'configured';
  }
  // Explicitly opened by the user (first-time configure).
  if (isConfiguring) {
    return 'configuring';
  }
  // Connected but no destination saved: idle state with a CTA to open picker.
  return 'choose-destination';
}

function getInstallErrorMessage(
  installState: ReturnType<typeof useAddIntegration>['state']
): string | undefined {
  if (installState.status === 'error') {
    return installState.error;
  }
  if (installState.status === 'cancelled') {
    return installState.lastError;
  }
  return undefined;
}

export interface ScmMessagingProviderRowProps {
  activeRow: ScmMessagingActiveRow;
  /**
   * True while continue is waiting on revalidation or project create.
   * Required alongside `onContinue` so the picker cannot stay idle.
   */
  isContinuing: boolean;
  messagingSetup: ScmMessagingSetup;
  onActiveRowChange: (row: ScmMessagingActiveRow) => void;
  onContinue: () => void;
  onInstallComplete: (providerKey: ScmMessagingProviderKey) => void;
  onMessagingSetupChange: (setup: ScmMessagingSetup) => void;
  resolvedProvider: ScmMessagingResolvedProvider;
  /**
   * True while the parent's integrations query is actively refetching (e.g.
   * after a fresh install). Drives the post-install loading spinner; scoped to
   * this prop so the spinner clears as soon as the refetch settles even if no
   * integration surfaced, preventing an infinite spin.
   */
  isRefetchingIntegrations?: boolean;
  /**
   * Render prop for the inline channel picker.
   *
   * Called with the eligible (non-empty) integrations for this provider and two
   * callbacks: `onConfigured` (save the chosen destination to session state) and
   * `onCancel` (close without saving). Only invoked when `status === 'connected'`.
   *
   * Omitting this prop leaves the configuring state with an empty body.
   */
  renderChannelPicker?: (props: {
    integrations: OrganizationIntegration[];
    onCancel: () => void;
    onConfigured: (setup: ScmMessagingSetup & {mode: 'selected'}) => void;
  }) => ReactNode;
}

export function ScmMessagingProviderRow({
  resolvedProvider,
  messagingSetup,
  onMessagingSetupChange,
  onInstallComplete,
  activeRow,
  onActiveRowChange,
  renderChannelPicker,
  isRefetchingIntegrations = false,
  isContinuing,
  onContinue,
}: ScmMessagingProviderRowProps) {
  const organization = useOrganization();
  const {startFlow, state: installState} = useAddIntegration();

  const hasInstallAccess = hasEveryAccess(['org:integrations'], {organization});

  const isConfigured =
    messagingSetup.mode === 'selected' &&
    messagingSetup.providerKey === resolvedProvider.providerKey &&
    resolvedProvider.eligibleIntegrations.some(
      i => i.id === messagingSetup.integrationId
    );

  const isConfiguring =
    activeRow?.providerKey === resolvedProvider.providerKey &&
    activeRow.mode === 'configuring';
  const isRemoving =
    activeRow?.providerKey === resolvedProvider.providerKey &&
    activeRow.mode === 'removing';

  const visualState = deriveVisualState({
    resolvedProvider,
    installState,
    messagingSetup,
    isConfiguring,
    isRemoving,
    hasInstallAccess,
    isRefetchingIntegrations,
  });

  const isInstallForbidden = visualState === 'install-forbidden';
  useEffect(() => {
    if (isInstallForbidden) {
      trackAnalytics('onboarding.scm_messaging_ask_admin_shown', {
        organization,
        provider: resolvedProvider.providerKey,
      });
    }
  }, [isInstallForbidden, organization, resolvedProvider.providerKey]);

  const handleConnect = useCallback(() => {
    if (resolvedProvider.providerKey === 'msteams') {
      openMsTeamsConnectionModal(resolvedProvider.provider, () => {
        onInstallComplete(resolvedProvider.providerKey);
      });
      return;
    }
    startFlow({
      provider: resolvedProvider.provider,
      organization,
      onInstall: (_integration: IntegrationWithConfig) => {
        onInstallComplete(resolvedProvider.providerKey);
      },
      suppressSuccessMessage: true,
      analyticsParams: {
        view: MessagingIntegrationAnalyticsView.ONBOARDING,
        already_installed: false,
        variant: 'scm',
      },
    });
  }, [
    startFlow,
    resolvedProvider.provider,
    resolvedProvider.providerKey,
    organization,
    onInstallComplete,
  ]);

  const handleConnectClick = () => {
    trackAnalytics('onboarding.scm_messaging_connect_clicked', {
      organization,
      provider: resolvedProvider.providerKey,
    });
    handleConnect();
  };
  const handleRetryInstall = () => {
    trackAnalytics('onboarding.scm_messaging_install_retry_clicked', {
      organization,
      provider: resolvedProvider.providerKey,
    });
    handleConnect();
  };

  const activateRow = (mode: 'configuring' | 'removing') =>
    onActiveRowChange({providerKey: resolvedProvider.providerKey, mode});
  const handleChooseDestination = () => {
    trackAnalytics('onboarding.scm_messaging_choose_destination_clicked', {
      organization,
      provider: resolvedProvider.providerKey,
    });
    activateRow('configuring');
  };
  const handleEditDestination = () => {
    trackAnalytics('onboarding.scm_messaging_destination_edit_clicked', {
      organization,
      provider: resolvedProvider.providerKey,
    });
    activateRow('configuring');
  };
  const handleCancelConfiguring = () => {
    // The same Cancel closes a first-time pick and an edit of a staged
    // destination; only the latter restores a previous choice.
    trackAnalytics(
      isConfigured
        ? 'onboarding.scm_messaging_destination_edit_cancelled'
        : 'onboarding.scm_messaging_choose_destination_cancelled',
      {organization, provider: resolvedProvider.providerKey}
    );
    onActiveRowChange(null);
  };
  const handleStartRemoving = () => activateRow('removing');
  const handleCancelRemoving = () => {
    trackAnalytics('onboarding.scm_messaging_destination_remove_cancelled', {
      organization,
      provider: resolvedProvider.providerKey,
    });
    onActiveRowChange(null);
  };
  const handleConfirmRemove = () => {
    trackAnalytics('onboarding.scm_messaging_destination_remove_confirmed', {
      organization,
      provider: resolvedProvider.providerKey,
    });
    onMessagingSetupChange({mode: 'unconfigured'});
    onActiveRowChange(null);
  };

  const handleConfigured = useCallback(
    (setup: ScmMessagingSetup & {mode: 'selected'}) => {
      onMessagingSetupChange(setup);
      onContinue();
    },
    [onMessagingSetupChange, onContinue]
  );

  const errorMessage = getInstallErrorMessage(installState);

  return (
    <Container border={visualState === 'removing' ? 'danger' : 'primary'} radius="lg">
      <Stack>
        {visualState === 'install-error' && (
          <Stack padding="md" gap="md" align="start">
            <Alert
              variant="danger"
              trailingItems={
                <Alert.Button onClick={handleRetryInstall}>{t('Try again')}</Alert.Button>
              }
            >
              {errorMessage || t('Installation failed. Please try again.')}
            </Alert>
          </Stack>
        )}

        {visualState !== 'install-error' && (
          <Flex padding="lg" gap="md" align="center" justify="between">
            <Flex gap="md" align="center" style={{flex: 1, minWidth: 0}}>
              <Container flexShrink={0} paddingTop="2xs">
                <PluginIcon pluginId={resolvedProvider.providerKey} size={28} />
              </Container>
              <Stack gap="sm">
                <Flex gap="xs" align="center">
                  <Text bold size="md">
                    {visualState === 'removing'
                      ? t('Remove this destination?')
                      : resolvedProvider.provider.name}
                  </Text>
                  {resolvedProvider.status !== 'connected' &&
                    visualState !== 'removing' && (
                      <Tooltip
                        title={
                          SCM_MESSAGING_PROVIDER_TOOLTIPS[resolvedProvider.providerKey]
                        }
                      >
                        <Flex align="center">
                          <IconInfo size="xs" variant="muted" />
                        </Flex>
                      </Tooltip>
                    )}
                  {resolvedProvider.status === 'connected' &&
                    visualState !== 'removing' &&
                    (isConfigured ? (
                      <Tag variant="success" icon={<IconCheckmark />}>
                        {t('Connected')}
                      </Tag>
                    ) : (
                      <Tag variant="info">{t('Authorized')}</Tag>
                    ))}
                </Flex>
                <RowSubtitle
                  visualState={visualState}
                  resolvedProvider={resolvedProvider}
                  messagingSetup={messagingSetup}
                />
              </Stack>
            </Flex>

            <Flex gap="sm" align="center" style={{flexShrink: 0}}>
              <RowActions
                visualState={visualState}
                resolvedProvider={resolvedProvider}
                onConnect={handleConnectClick}
                onChooseDestination={handleChooseDestination}
                onEditDestination={handleEditDestination}
                onStartRemoving={handleStartRemoving}
                onCancelRemoving={handleCancelRemoving}
                onConfirmRemove={handleConfirmRemove}
              />
            </Flex>
          </Flex>
        )}

        {visualState === 'configuring' &&
          resolvedProvider.eligibleIntegrations.length > 0 && (
            <Container borderTop="primary">
              {renderChannelPicker ? (
                renderChannelPicker({
                  integrations: resolvedProvider.eligibleIntegrations,
                  onCancel: handleCancelConfiguring,
                  onConfigured: handleConfigured,
                })
              ) : (
                <ScmMessagingChannelPicker
                  eligibleIntegrations={resolvedProvider.eligibleIntegrations}
                  providerKey={resolvedProvider.providerKey}
                  onCancel={handleCancelConfiguring}
                  onConfigured={handleConfigured}
                  existingSetup={isConfigured ? messagingSetup : undefined}
                  isContinuing={isContinuing}
                />
              )}
            </Container>
          )}
      </Stack>
    </Container>
  );
}
