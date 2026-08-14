import {Fragment, useCallback, useEffect, useState} from 'react';
import type {ReactNode} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t} from 'sentry/locale';
import type {
  IntegrationWithConfig,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MessagingIntegrationAnalyticsView} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';

import {SCM_MESSAGING_PROVIDER_DESCRIPTIONS} from './messagingProviders';
import {ScmMessagingChannelPicker} from './scmMessagingChannelPicker';
import type {ScmMessagingSetup} from './scmMessagingSetup';
import {ScmSelectableContainer} from './scmSelectableContainer';
import type {ScmMessagingProviderViewModel} from './useScmMessagingProviders';

/**
 * The visual state of a single provider row. Derived from the view model,
 * the install-flow state machine, and the current messaging setup in session
 * storage.
 */
type RowVisualState =
  | 'installable'
  /** OAuth modal is open / install in progress. */
  | 'installing'
  /** Install attempt ended with an error (or was closed after one). */
  | 'install-error'
  /** Install confirmed; waiting for the integrations query to re-settle. */
  | 'loading'
  /** Active integration exists but is ineligible for Issue Alert actions. */
  | 'permission-limited'
  /** Active, eligible integration; no destination configured yet. */
  | 'connected'
  /** Destination is being configured (channel picker rendered inline). */
  | 'configuring'
  /** A destination has been saved to session state. */
  | 'configured'
  /** User is confirming a destination removal. */
  | 'removing';

function deriveVisualState({
  viewModel,
  installState,
  messagingSetup,
  isConfiguring,
  isRemoving,
  awaitingInstall,
}: {
  awaitingInstall: boolean;
  installState: ReturnType<typeof useAddIntegration>['state'];
  isConfiguring: boolean;
  isRemoving: boolean;
  messagingSetup: ScmMessagingSetup;
  viewModel: ScmMessagingProviderViewModel;
}): RowVisualState {
  // `installState` is local to this row's `useAddIntegration`, so it always
  // refers to this provider's flow.
  if (installState.status === 'installing') {
    return 'installing';
  }
  // Only surface an install error while still uninstalled; a shared-query
  // refetch may reveal the integration after a local error.
  if (viewModel.status === 'installable') {
    if (installState.status === 'error') {
      return 'install-error';
    }
    if (installState.status === 'cancelled' && installState.lastError) {
      return 'install-error';
    }
  }
  // Hold the spinner only while waiting for the just-installed integration to
  // surface. Once the view model settles to anything other than `installable`
  // (connected or permission-limited) that state is terminal, so falling
  // through avoids spinning forever on an ineligible or vanished integration.
  if (
    installState.status === 'complete' &&
    awaitingInstall &&
    viewModel.status === 'installable'
  ) {
    return 'loading';
  }

  if (viewModel.status === 'installable') {
    return 'installable';
  }

  if (viewModel.status === 'permission-limited') {
    return 'permission-limited';
  }

  // status === 'connected'
  const isConfigured =
    messagingSetup.mode === 'selected' &&
    messagingSetup.providerKey === viewModel.providerKey &&
    messagingSetup.integrationId === viewModel.integration?.id;

  // Configuring takes priority so Edit can open the picker even when a
  // destination is already saved.
  if (isConfiguring) {
    return 'configuring';
  }
  if (isConfigured && isRemoving) {
    return 'removing';
  }
  if (isConfigured) {
    return 'configured';
  }
  return 'connected';
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
  messagingSetup: ScmMessagingSetup;
  onInstallComplete: () => void;
  onMessagingSetupChange: (setup: ScmMessagingSetup) => void;
  viewModel: ScmMessagingProviderViewModel;
  /**
   * Render prop for the inline channel picker.
   *
   * When the user opens the configuring state this is called with the active
   * integration and two callbacks: `onConfigured` (save the chosen destination
   * to session state) and `onCancel` (close without saving).
   *
   * Omitting this prop leaves the configuring state with an empty body.
   */
  renderChannelPicker?: (props: {
    integration: OrganizationIntegration;
    onCancel: () => void;
    onConfigured: (setup: ScmMessagingSetup & {mode: 'selected'}) => void;
  }) => ReactNode;
}

export function ScmMessagingProviderRow({
  viewModel,
  messagingSetup,
  onMessagingSetupChange,
  onInstallComplete,
  renderChannelPicker,
}: ScmMessagingProviderRowProps) {
  const organization = useOrganization();
  const {startFlow, state: installState} = useAddIntegration();
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  // `useAddIntegration` never leaves `complete`, so latch the post-install wait
  // ourselves and release it once the integration surfaces.
  const [awaitingInstall, setAwaitingInstall] = useState(false);

  const isConfigured =
    messagingSetup.mode === 'selected' &&
    messagingSetup.providerKey === viewModel.providerKey &&
    messagingSetup.integrationId === viewModel.integration?.id;

  const visualState = deriveVisualState({
    viewModel,
    installState,
    messagingSetup,
    isConfiguring,
    isRemoving,
    awaitingInstall,
  });

  // When the integration goes away (e.g. removed externally), close any
  // expanded state so the row does not get stuck showing a stale UI.
  useEffect(() => {
    if (viewModel.status !== 'connected') {
      setIsConfiguring(false);
      setIsRemoving(false);
    }
  }, [viewModel.status]);

  // Release the post-install latch once the integration surfaces (connected or
  // permission-limited), so a later external removal cannot re-trigger loading.
  useEffect(() => {
    if (viewModel.status !== 'installable') {
      setAwaitingInstall(false);
    }
  }, [viewModel.status]);

  // If the configured destination is cleared externally (validation reset),
  // exit the removing confirmation.
  useEffect(() => {
    if (!isConfigured) {
      setIsRemoving(false);
    }
  }, [isConfigured]);

  const handleConnect = useCallback(() => {
    setAwaitingInstall(true);
    startFlow({
      provider: viewModel.provider,
      organization,
      onInstall: (_integration: IntegrationWithConfig) => {
        onInstallComplete();
      },
      suppressSuccessMessage: true,
      analyticsParams: {
        view: MessagingIntegrationAnalyticsView.ONBOARDING,
        already_installed: false,
        variant: 'scm',
      },
    });
  }, [startFlow, viewModel.provider, organization, onInstallComplete]);

  const handleAddDestination = () => setIsConfiguring(true);
  const handleEditDestination = () => setIsConfiguring(true);
  const handleCancelConfiguring = () => setIsConfiguring(false);
  const handleStartRemoving = () => setIsRemoving(true);
  const handleCancelRemoving = () => setIsRemoving(false);
  const handleConfirmRemove = () => {
    onMessagingSetupChange({mode: 'unconfigured'});
    setIsRemoving(false);
  };

  const handleConfigured = useCallback(
    (setup: ScmMessagingSetup & {mode: 'selected'}) => {
      onMessagingSetupChange(setup);
      setIsConfiguring(false);
    },
    [onMessagingSetupChange]
  );

  const errorMessage = getInstallErrorMessage(installState);

  const showRowContent =
    visualState !== 'loading' &&
    visualState !== 'installing' &&
    visualState !== 'install-error';

  const showChannelPicker = visualState === 'configuring' && viewModel.integration;

  return (
    <ScmSelectableContainer isSelected={isConfigured}>
      <Stack>
        {(visualState === 'loading' || visualState === 'installing') && (
          <Flex justify="center" align="center" padding="lg">
            <LoadingIndicator mini style={{margin: 0}} />
          </Flex>
        )}

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

        {showRowContent && (
          <Flex padding="lg" gap="md" align="start" justify="between">
            <Flex gap="md" align="start" style={{flex: 1, minWidth: 0}}>
              <Container flexShrink={0} paddingTop="2xs">
                <PluginIcon pluginId={viewModel.providerKey} size={24} />
              </Container>
              <Stack gap="xs">
                <Text bold size="sm">
                  {viewModel.provider.name}
                </Text>
                <RowSubtitle
                  visualState={visualState}
                  viewModel={viewModel}
                  messagingSetup={messagingSetup}
                />
              </Stack>
            </Flex>

            <Flex gap="sm" align="center" style={{flexShrink: 0}}>
              <RowActions
                visualState={visualState}
                viewModel={viewModel}
                onConnect={handleConnect}
                onAddDestination={handleAddDestination}
                onEditDestination={handleEditDestination}
                onStartRemoving={handleStartRemoving}
                onCancelRemoving={handleCancelRemoving}
                onConfirmRemove={handleConfirmRemove}
              />
            </Flex>
          </Flex>
        )}

        {showChannelPicker && (
          <Container borderTop="primary" padding="lg">
            {renderChannelPicker ? (
              renderChannelPicker({
                integration: showChannelPicker,
                onCancel: handleCancelConfiguring,
                onConfigured: handleConfigured,
              })
            ) : (
              <ScmMessagingChannelPicker
                integration={showChannelPicker}
                onCancel={handleCancelConfiguring}
                onConfigured={handleConfigured}
                existingSetup={isConfigured ? messagingSetup : undefined}
              />
            )}
          </Container>
        )}
      </Stack>
    </ScmSelectableContainer>
  );
}

function RowSubtitle({
  visualState,
  viewModel,
  messagingSetup,
}: {
  messagingSetup: ScmMessagingSetup;
  viewModel: ScmMessagingProviderViewModel;
  visualState: RowVisualState;
}) {
  if (visualState === 'installable') {
    return (
      <Text variant="muted" size="sm">
        {SCM_MESSAGING_PROVIDER_DESCRIPTIONS[viewModel.providerKey]}
      </Text>
    );
  }

  if (visualState === 'permission-limited') {
    return (
      <Stack gap="2xs">
        <Text size="sm">{viewModel.integration?.name}</Text>
        <Text variant="muted" size="sm">
          {t(
            'This Microsoft Teams workspace uses a tenant-level connection and cannot receive issue alerts directly. Reinstall with a team-level connection to enable destinations.'
          )}
        </Text>
      </Stack>
    );
  }

  if (visualState === 'connected') {
    return <Text size="sm">{viewModel.integration?.name}</Text>;
  }

  if (visualState === 'configured' && messagingSetup.mode === 'selected') {
    return (
      <Flex gap="xs" align="center">
        <Text size="sm">{viewModel.integration?.name}</Text>
        <Text variant="muted" size="sm" aria-hidden>
          ·
        </Text>
        <Text size="sm">{messagingSetup.channelName}</Text>
      </Flex>
    );
  }

  if (visualState === 'removing' && messagingSetup.mode === 'selected') {
    return (
      <Text variant="muted" size="sm">
        {t(
          'Remove %s from your destinations? The %s workspace will remain connected.',
          messagingSetup.channelName,
          viewModel.integration?.name ?? viewModel.provider.name
        )}
      </Text>
    );
  }

  return null;
}

interface RowActionsProps {
  onAddDestination: () => void;
  onCancelRemoving: () => void;
  onConfirmRemove: () => void;
  onConnect: () => void;
  onEditDestination: () => void;
  onStartRemoving: () => void;
  viewModel: ScmMessagingProviderViewModel;
  visualState: RowVisualState;
}

function RowActions({
  visualState,
  viewModel,
  onConnect,
  onAddDestination,
  onEditDestination,
  onStartRemoving,
  onCancelRemoving,
  onConfirmRemove,
}: RowActionsProps) {
  if (visualState === 'installable') {
    return (
      <Button
        size="sm"
        disabled={!viewModel.provider.canAdd}
        onClick={onConnect}
        aria-label={t('Connect %s', viewModel.provider.name)}
      >
        {t('Connect')}
      </Button>
    );
  }

  if (visualState === 'permission-limited') {
    return (
      <Button size="sm" disabled>
        {t('Add destination')}
      </Button>
    );
  }

  if (visualState === 'connected') {
    return (
      <Button size="sm" onClick={onAddDestination}>
        {t('Add destination')}
      </Button>
    );
  }

  if (visualState === 'configured') {
    return (
      <Fragment>
        <Button size="sm" variant="secondary" onClick={onEditDestination}>
          {t('Edit')}
        </Button>
        <Button size="sm" variant="danger" onClick={onStartRemoving}>
          {t('Remove')}
        </Button>
      </Fragment>
    );
  }

  if (visualState === 'removing') {
    return (
      <Fragment>
        <Button size="sm" onClick={onCancelRemoving}>
          {t('Cancel')}
        </Button>
        <Button size="sm" variant="danger" onClick={onConfirmRemove}>
          {t('Remove')}
        </Button>
      </Fragment>
    );
  }

  return null;
}
