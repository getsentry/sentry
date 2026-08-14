import {Fragment, useCallback, useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
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
import {MessagingIntegrationAnalyticsView} from 'sentry/views/alerts/rules/issue/setupMessagingIntegrationButton';

import {
  SCM_MESSAGING_PROVIDER_DESCRIPTIONS,
  SCM_MESSAGING_PROVIDER_TOOLTIPS,
} from './messagingProviders';
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
}: {
  hasInstallAccess: boolean;
  installState: ReturnType<typeof useAddIntegration>['state'];
  isConfiguring: boolean;
  isRemoving: boolean;
  messagingSetup: ScmMessagingSetup;
  viewModel: ScmMessagingProviderViewModel;
}): RowVisualState {
  const forThisProvider =
    installState.status !== 'idle' && installState.providerKey === viewModel.providerKey;

  if (forThisProvider) {
    if (installState.status === 'installing') {
      return 'installing';
    }
    if (installState.status === 'error') {
      return 'install-error';
    }
    if (installState.status === 'cancelled' && installState.lastError) {
      return 'install-error';
    }
    // Install confirmed — stay in loading until the view model catches up.
    if (installState.status === 'complete' && viewModel.status !== 'connected') {
      return 'loading';
    }
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
  // Auto-expand the form immediately when connected but not yet configured.
  return 'configuring';
}

export interface ScmMessagingProviderRowProps {
  messagingSetup: ScmMessagingSetup;
  onInstallComplete: () => void;
  onMessagingSetupChange: (setup: ScmMessagingSetup) => void;
  viewModel: ScmMessagingProviderViewModel;
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
    onCancel: (() => void) | undefined;
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

  const errorMessage =
    installState.status === 'error'
      ? installState.error
      : installState.status === 'cancelled' && installState.lastError
        ? installState.lastError
        : undefined;

  return (
    <ScmSelectableContainer isSelected={isConfigured}>
      <RowBody>
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
              <IconWrapper>
                <PluginIcon pluginId={viewModel.providerKey} size={24} />
              </IconWrapper>
              <Stack gap="xs">
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
                      {t('Connected')}
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
                onEditDestination={handleEditDestination}
                onStartRemoving={handleStartRemoving}
                onCancelRemoving={handleCancelRemoving}
                onConfirmRemove={handleConfirmRemove}
              />
            </Flex>
          </Flex>
        )}

        {visualState === 'configuring' && (
          <ChannelPickerSlot>
            {renderChannelPicker ? (
              renderChannelPicker({
                integrations: viewModel.eligibleIntegrations,
                onCancel: isConfigured ? handleCancelConfiguring : undefined,
                onConfigured: handleConfigured,
              })
            ) : (
              <ScmMessagingChannelPicker
                integrations={viewModel.eligibleIntegrations}
                onCancel={isConfigured ? handleCancelConfiguring : undefined}
                onConfigured={handleConfigured}
                existingSetup={isConfigured ? messagingSetup : undefined}
              />
            )}
          </ChannelPickerSlot>
        )}
      </RowBody>
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
  if (
    visualState === 'installable' ||
    visualState === 'loading' ||
    visualState === 'installing'
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
          {t('Remove destination')}
        </Button>
      </Fragment>
    );
  }

  return null;
}

const RowBody = styled('div')`
  display: flex;
  flex-direction: column;
`;

const IconWrapper = styled('div')`
  flex-shrink: 0;
  margin-top: 2px;
`;

const ChannelPickerSlot = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  padding: ${p => p.theme.space.lg};
`;
