import {useCallback} from 'react';
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
  messagingSetup: ScmMessagingSetup;
  onActiveRowChange: (row: ScmMessagingActiveRow) => void;
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

  const handleConnect = useCallback(() => {
    if (resolvedProvider.providerKey === 'msteams') {
      openMsTeamsConnectionModal(resolvedProvider.provider);
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

  const activateRow = (mode: 'configuring' | 'removing') =>
    onActiveRowChange({providerKey: resolvedProvider.providerKey, mode});
  const handleCancelConfiguring = () => onActiveRowChange(null);
  const handleCancelRemoving = () => onActiveRowChange(null);
  const handleConfirmRemove = () => {
    onMessagingSetupChange({mode: 'unconfigured'});
    onActiveRowChange(null);
  };

  const handleConfigured = useCallback(
    (setup: ScmMessagingSetup & {mode: 'selected'}) => {
      onMessagingSetupChange(setup);
      onActiveRowChange(null);
    },
    [onMessagingSetupChange, onActiveRowChange]
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
                <Alert.Button onClick={handleConnect}>{t('Try again')}</Alert.Button>
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
                    visualState !== 'removing' && (
                      <Tag variant="success" icon={<IconCheckmark />}>
                        {isConfigured ? t('Destination added') : t('Connected')}
                      </Tag>
                    )}
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
                onConnect={handleConnect}
                onChooseDestination={() => activateRow('configuring')}
                onEditDestination={() => activateRow('configuring')}
                onStartRemoving={() => activateRow('removing')}
                onCancelRemoving={handleCancelRemoving}
                onConfirmRemove={handleConfirmRemove}
              />
            </Flex>
          </Flex>
        )}

        {visualState === 'configuring' &&
          resolvedProvider.eligibleIntegrations.length > 0 && (
            <Container borderTop="primary" padding="lg">
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
                />
              )}
            </Container>
          )}
      </Stack>
    </Container>
  );
}
