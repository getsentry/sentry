import {useCallback, useEffect, useRef} from 'react';
import type {ReactNode} from 'react';
import {motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

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
import {t} from 'sentry/locale';
import type {
  IntegrationWithConfig,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useAddIntegration} from 'sentry/utils/integrations/useAddIntegration';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ONBOARDING_ENTER} from 'sentry/views/onboarding/animations';

import {RowActions} from './action';
import {ProviderLogo} from './logo';
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

  const rowEventParams = {organization, provider: resolvedProvider.providerKey};

  const handleConnectClick = () => {
    trackAnalytics('onboarding.scm_messaging_connect_clicked', rowEventParams);
    handleConnect();
  };
  const handleRetryInstall = () => {
    trackAnalytics('onboarding.scm_messaging_install_retry_clicked', rowEventParams);
    handleConnect();
  };

  const activateRow = (mode: 'configuring' | 'removing') =>
    onActiveRowChange({providerKey: resolvedProvider.providerKey, mode});
  const handleChooseDestination = () => {
    trackAnalytics('onboarding.scm_messaging_choose_destination_clicked', rowEventParams);
    activateRow('configuring');
  };
  const handleEditDestination = () => {
    trackAnalytics('onboarding.scm_messaging_destination_edit_clicked', rowEventParams);
    activateRow('configuring');
  };
  const handleCancelConfiguring = () => {
    // The same Cancel closes a first-time pick and an edit of a staged
    // destination; only the latter restores a previous choice.
    trackAnalytics(
      isConfigured
        ? 'onboarding.scm_messaging_destination_edit_cancelled'
        : 'onboarding.scm_messaging_choose_destination_cancelled',
      rowEventParams
    );
    onActiveRowChange(null);
  };
  const handleCancelRemoving = () => {
    trackAnalytics(
      'onboarding.scm_messaging_destination_remove_cancelled',
      rowEventParams
    );
    onActiveRowChange(null);
  };
  const handleConfirmRemove = () => {
    trackAnalytics(
      'onboarding.scm_messaging_destination_remove_confirmed',
      rowEventParams
    );
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

  // Every row transition swaps the actions in place, so the control the user
  // activated unmounts and the browser drops focus to the body. Move it to the
  // first control of the new state instead. The picker takes focus itself.
  // Only transitions the user starts in this row are listed: a background
  // refetch can promote installable to choose-destination on its own, and that
  // must not pull focus from wherever the user is.
  const focusRef = useRef<HTMLButtonElement>(null);
  const previousVisualStateRef = useRef(visualState);
  useEffect(() => {
    const previous = previousVisualStateRef.current;
    previousVisualStateRef.current = visualState;
    if (previous === visualState || visualState === 'configuring') {
      return;
    }
    const previousUnmountedControl =
      previous === 'configuring' ||
      previous === 'removing' ||
      previous === 'installing' ||
      previous === 'loading';
    if (previousUnmountedControl || visualState === 'removing') {
      focusRef.current?.focus();
    }
  }, [visualState]);

  return (
    <MotionContainer
      background="primary"
      border={visualState === 'removing' ? 'danger' : 'primary'}
      radius="xl"
      {...ONBOARDING_ENTER}
    >
      <Stack>
        {visualState === 'install-error' && (
          <Stack padding="lg xl" gap="md" align="start">
            <Alert
              variant="danger"
              role="alert"
              trailingItems={
                <Alert.Button ref={focusRef} onClick={handleRetryInstall}>
                  {t('Try again')}
                </Alert.Button>
              }
            >
              {errorMessage || t('Installation failed. Please try again.')}
            </Alert>
          </Stack>
        )}

        {visualState !== 'install-error' && (
          <Flex padding="lg xl" gap="xl" align="center" justify="between">
            <Flex gap="xl" align="center" style={{flex: 1, minWidth: 0}}>
              <Container
                flexShrink={0}
                paddingTop="2xs"
                // The confirmation replaces the provider name, so the logo
                // names the provider for screen readers. Elsewhere the name is
                // adjacent text, and the logo stays decorative.
                role={visualState === 'removing' ? 'img' : undefined}
                aria-label={
                  visualState === 'removing' ? resolvedProvider.provider.name : undefined
                }
              >
                <ProviderLogo providerKey={resolvedProvider.providerKey} />
              </Container>
              <Stack gap="sm">
                <Flex gap="md" align="center">
                  <Text bold size="lg">
                    {visualState === 'removing'
                      ? t('Remove this destination?')
                      : resolvedProvider.provider.name}
                  </Text>
                  {resolvedProvider.status !== 'connected' &&
                    visualState !== 'removing' && (
                      <InfoTip
                        title={
                          SCM_MESSAGING_PROVIDER_TOOLTIPS[resolvedProvider.providerKey]
                        }
                        size="xs"
                        variant="muted"
                      />
                    )}
                </Flex>
                <RowSubtitle
                  visualState={visualState}
                  resolvedProvider={resolvedProvider}
                  messagingSetup={messagingSetup}
                />
              </Stack>
            </Flex>

            <Flex gap="md" align="center" style={{flexShrink: 0}}>
              <RowActions
                focusRef={focusRef}
                visualState={visualState}
                resolvedProvider={resolvedProvider}
                onConnect={handleConnectClick}
                onChooseDestination={handleChooseDestination}
                onEditDestination={handleEditDestination}
                onStartRemoving={() => activateRow('removing')}
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
    </MotionContainer>
  );
}

const MotionContainer = motion.create(Container);
