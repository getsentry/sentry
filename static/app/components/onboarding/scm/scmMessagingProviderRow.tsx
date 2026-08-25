import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {MessagingIntegrationAnalyticsView} from 'sentry/components/messagingIntegrations/setupMessagingIntegrationButton';
import {IconAdd} from 'sentry/icons/iconAdd';
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

import {
  SCM_MESSAGING_PROVIDER_DESCRIPTIONS,
  SCM_MESSAGING_PROVIDER_TOOLTIPS,
} from './messagingProviders';
import type {ScmMessagingProviderKey} from './messagingProviders';
import {ScmCollapsibleReveal} from './scmCollapsibleReveal';
import {ScmMessagingChannelPicker} from './scmMessagingChannelPicker';
import type {ScmMessagingSetup} from './scmMessagingSetup';
import type {ScmMessagingProviderViewModel} from './useScmMessagingProviders';

/**
 * The visual state of a single provider row. Derived from the view model,
 * the install-flow state machine, and the current messaging setup in session
 * storage.
 */
type RowVisualState =
  | 'installable'
  /**
   * User lacks org:integrations so they cannot start an installation.
   * Distinct from 'permission-limited', which describes a tenant-level MS Teams
   * integration that is ineligible for Issue Alert actions regardless of user scope.
   */
  | 'install-forbidden'
  /** OAuth modal is open / install in progress. */
  | 'installing'
  /** Install attempt ended with an error (or was closed after one). */
  | 'install-error'
  /** Install confirmed; waiting for the integrations query to re-settle. */
  | 'loading'
  /** Active integration exists but is ineligible for Issue Alert actions. */
  | 'permission-limited'
  /**
   * Integration is connected but no destination has been saved yet, and the
   * user has not explicitly opened the picker. Shows the Connected pill and a
   * "+ Choose destination" CTA.
   */
  | 'choose-destination'
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
  hasInstallAccess,
  isRefetchingIntegrations,
}: {
  hasInstallAccess: boolean;
  installState: ReturnType<typeof useAddIntegration>['state'];
  isConfiguring: boolean;
  isRefetchingIntegrations: boolean;
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
  // Show the spinner only while the shared integrations query is actively
  // refetching after install. Once it settles — whether or not the integration
  // surfaced — isRefetchingIntegrations becomes false and the row falls back to
  // installable (Connect), so it can never spin forever.
  if (
    installState.status === 'complete' &&
    isRefetchingIntegrations &&
    viewModel.status === 'installable'
  ) {
    return 'loading';
  }

  if (viewModel.status === 'installable') {
    return hasInstallAccess ? 'installable' : 'install-forbidden';
  }

  if (viewModel.status === 'permission-limited') {
    return 'permission-limited';
  }

  // status === 'connected'
  const isConfigured =
    messagingSetup.mode === 'selected' &&
    messagingSetup.providerKey === viewModel.providerKey &&
    viewModel.eligibleIntegrations.some(i => i.id === messagingSetup.integrationId);

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
  messagingSetup: ScmMessagingSetup;
  onInstallComplete: () => void;
  onMessagingSetupChange: (setup: ScmMessagingSetup) => void;
  viewModel: ScmMessagingProviderViewModel;
  /**
   * True while the parent's integrations query is actively refetching (e.g.
   * after a fresh install). Drives the post-install loading spinner; scoped to
   * this prop so the spinner clears as soon as the refetch settles even if no
   * integration surfaced, preventing an infinite spin.
   */
  isRefetchingIntegrations?: boolean;
  /**
   * Called with this row's providerKey when it enters configuring or removing
   * mode, and with null when it leaves. The parent uses this to hide sibling
   * rows so only the active row is visible during exclusive modes.
   */
  onExclusiveModeChange?: (providerKey: ScmMessagingProviderKey | null) => void;
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
  viewModel,
  messagingSetup,
  onMessagingSetupChange,
  onInstallComplete,
  onExclusiveModeChange,
  renderChannelPicker,
  isRefetchingIntegrations = false,
}: ScmMessagingProviderRowProps) {
  const organization = useOrganization();
  const {startFlow, state: installState} = useAddIntegration();
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const hasInstallAccess = hasEveryAccess(['org:integrations'], {organization});

  const isConfigured =
    messagingSetup.mode === 'selected' &&
    messagingSetup.providerKey === viewModel.providerKey &&
    viewModel.eligibleIntegrations.some(i => i.id === messagingSetup.integrationId);

  const visualState = deriveVisualState({
    viewModel,
    installState,
    messagingSetup,
    isConfiguring,
    isRemoving,
    hasInstallAccess,
    isRefetchingIntegrations,
  });

  // When the integration goes away (e.g. removed externally), close any
  // expanded state so the row does not get stuck showing a stale UI.
  useEffect(() => {
    if (viewModel.status !== 'connected') {
      setIsConfiguring(false);
      setIsRemoving(false);
    }
  }, [viewModel.status]);

  // If the configured destination is cleared externally (validation reset),
  // exit the removing confirmation.
  useEffect(() => {
    if (!isConfigured) {
      setIsRemoving(false);
    }
  }, [isConfigured]);

  // Auto-open the destination picker immediately after a fresh install in this
  // session. Guarded by a ref so navigating away and back, or a second refetch,
  // does not re-open the picker unexpectedly.
  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (
      installState.status === 'complete' &&
      viewModel.status === 'connected' &&
      !isRefetchingIntegrations &&
      !hasAutoOpenedRef.current
    ) {
      hasAutoOpenedRef.current = true;
      setIsConfiguring(true);
    }
  }, [installState.status, viewModel.status, isRefetchingIntegrations]);

  // Notify the parent when this row enters or leaves an exclusive mode so it
  // can hide sibling rows.
  useEffect(() => {
    const isExclusive = visualState === 'configuring' || visualState === 'removing';
    onExclusiveModeChange?.(isExclusive ? viewModel.providerKey : null);
  }, [visualState, viewModel.providerKey, onExclusiveModeChange]);

  const handleConnect = useCallback(() => {
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

  const handleChooseDestination = () => setIsConfiguring(true);
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
                <PluginIcon pluginId={viewModel.providerKey} size={28} />
              </Container>
              <Stack gap="sm">
                <Flex gap="xs" align="center">
                  <Text bold size="md">
                    {visualState === 'removing'
                      ? t('Remove this destination?')
                      : viewModel.provider.name}
                  </Text>
                  {viewModel.status !== 'connected' && visualState !== 'removing' && (
                    <Tooltip
                      title={SCM_MESSAGING_PROVIDER_TOOLTIPS[viewModel.providerKey]}
                    >
                      <Flex align="center">
                        <IconInfo size="xs" variant="muted" />
                      </Flex>
                    </Tooltip>
                  )}
                  {viewModel.status === 'connected' && visualState !== 'removing' && (
                    <Tag variant="success" icon={<IconCheckmark />}>
                      {isConfigured ? t('Destination added') : t('Connected')}
                    </Tag>
                  )}
                </Flex>
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
                onChooseDestination={handleChooseDestination}
                onEditDestination={handleEditDestination}
                onStartRemoving={handleStartRemoving}
                onCancelRemoving={handleCancelRemoving}
                onConfirmRemove={handleConfirmRemove}
              />
            </Flex>
          </Flex>
        )}

        <ScmCollapsibleReveal
          open={
            visualState === 'configuring' && viewModel.eligibleIntegrations.length > 0
          }
        >
          <Container borderTop="primary" padding="lg">
            {renderChannelPicker ? (
              renderChannelPicker({
                integrations: viewModel.eligibleIntegrations,
                onCancel: handleCancelConfiguring,
                onConfigured: handleConfigured,
              })
            ) : (
              <ScmMessagingChannelPicker
                eligibleIntegrations={viewModel.eligibleIntegrations}
                providerKey={viewModel.providerKey}
                onCancel={handleCancelConfiguring}
                onConfigured={handleConfigured}
                existingSetup={isConfigured ? messagingSetup : undefined}
              />
            )}
          </Container>
        </ScmCollapsibleReveal>
      </Stack>
    </Container>
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
  if (
    visualState === 'installable' ||
    visualState === 'loading' ||
    visualState === 'installing' ||
    visualState === 'choose-destination'
  ) {
    return (
      <Text variant="muted" size="sm">
        {SCM_MESSAGING_PROVIDER_DESCRIPTIONS[viewModel.providerKey]}
      </Text>
    );
  }

  if (visualState === 'install-forbidden') {
    return (
      <Stack gap="2xs">
        <Text variant="muted" size="sm">
          {SCM_MESSAGING_PROVIDER_DESCRIPTIONS[viewModel.providerKey]}
        </Text>
        <Text variant="muted" size="sm">
          {t('Ask an organization admin to connect %s.', viewModel.provider.name)}
        </Text>
      </Stack>
    );
  }

  if (visualState === 'permission-limited') {
    return (
      <Stack gap="2xs">
        <Text size="sm">{viewModel.permissionLimitedIntegration?.name}</Text>
        <Text variant="muted" size="sm">
          {t(
            'This Microsoft Teams workspace uses a tenant-level connection and cannot receive issue alerts directly. Reinstall with a team-level connection to enable destinations.'
          )}
        </Text>
      </Stack>
    );
  }

  if (visualState === 'configured' && messagingSetup.mode === 'selected') {
    return (
      <Flex gap="xs" align="center">
        <Text size="sm">
          {
            viewModel.eligibleIntegrations.find(
              i => i.id === messagingSetup.integrationId
            )?.name
          }
        </Text>
        <Text variant="muted" size="sm" aria-hidden>
          /
        </Text>
        <Text size="sm">{messagingSetup.channelName}</Text>
      </Flex>
    );
  }

  if (visualState === 'removing' && messagingSetup.mode === 'selected') {
    return (
      <Text variant="muted" size="sm">
        {t(
          'This removes the destination from project setup. The integration stays connected to your organization.'
        )}
      </Text>
    );
  }

  return null;
}

interface RowActionsProps {
  onCancelRemoving: () => void;
  onChooseDestination: () => void;
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
  onChooseDestination,
  onEditDestination,
  onStartRemoving,
  onCancelRemoving,
  onConfirmRemove,
}: RowActionsProps) {
  if (visualState === 'loading' || visualState === 'installing') {
    return (
      <Flex justify="center" align="center" style={{minWidth: 88}}>
        <LoadingIndicator mini style={{margin: 0}} />
      </Flex>
    );
  }

  if (visualState === 'installable') {
    return (
      <Button
        size="sm"
        icon={<IconAdd size="xs" />}
        disabled={!viewModel.provider.canAdd}
        onClick={onConnect}
        aria-label={t('Connect %s', viewModel.provider.name)}
      >
        {t('Connect')}
      </Button>
    );
  }

  if (visualState === 'install-forbidden') {
    return (
      <Button size="sm" disabled aria-label={t('Connect %s', viewModel.provider.name)}>
        {t('Connect')}
      </Button>
    );
  }

  if (visualState === 'permission-limited') {
    return (
      <Button size="sm" disabled>
        {t('Connect')}
      </Button>
    );
  }

  if (visualState === 'choose-destination') {
    return (
      <Button
        size="sm"
        icon={<IconAdd size="xs" />}
        onClick={onChooseDestination}
        aria-label={t('Choose destination for %s', viewModel.provider.name)}
      >
        {t('Choose destination')}
      </Button>
    );
  }

  if (visualState === 'configured') {
    return (
      <Fragment>
        <Button size="sm" variant="link" onClick={onEditDestination}>
          {t('Edit')}
        </Button>
        <Button size="sm" variant="link" onClick={onStartRemoving}>
          {t('Remove')}
        </Button>
      </Fragment>
    );
  }

  if (visualState === 'removing') {
    return (
      <Fragment>
        <Button size="sm" variant="link" onClick={onCancelRemoving}>
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
