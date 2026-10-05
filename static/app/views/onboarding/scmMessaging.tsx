import {useCallback, useEffect, useEffectEvent, useMemo, useState} from 'react';
import {AnimatePresence, LayoutGroup, motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import type {ScmMessagingProviderKey} from 'sentry/components/onboarding/scm/messagingProviders';
import {ScmMessagingProviderRow} from 'sentry/components/onboarding/scm/scmMessagingProviderRow';
import type {
  CreatedProject,
  ScmMessagingActiveRow,
  ScmMessagingSetup,
} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import {DEFAULT_SCM_FEATURES} from 'sentry/components/onboarding/scm/scmPlatformHelpers';
import {ScmStepHeader} from 'sentry/components/onboarding/scm/scmStepHeader';
import {ScmStepLayout} from 'sentry/components/onboarding/scm/scmStepLayout';
import {useScmMessagingProviders} from 'sentry/components/onboarding/scm/useScmMessagingProviders';
import {
  isEligibleForIssueAlerts,
  isIntegrationActive,
  useScmMessagingSetupValidation,
} from 'sentry/components/onboarding/scm/useScmMessagingSetupValidation';
import {useScmProjectCreation} from 'sentry/components/onboarding/scm/useScmProjectCreation';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  buildIntegrationAction,
  providerDetails,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {
  getRequestDataFragment,
  type RequestDataFragment,
} from 'sentry/views/projectInstall/issueAlertOptions';

import {ONBOARDING_ENTER, ONBOARDING_STAGGER} from './animations';
import type {StepProps} from './types';

/**
 * Shared by the step descriptor's `title` (document title / stepper) and the
 * step's own heading so the two cannot drift apart.
 */
export const SCM_MESSAGING_TITLE = t('Get alerts where your team works');

type MessagingProviderList = ReturnType<typeof useScmMessagingProviders>['providers'];

interface ScmMessagingProps {
  createdProject: CreatedProject | undefined;
  messagingSetup: ScmMessagingSetup;
  onComplete: StepProps['onComplete'];
  onCreatedProjectChange: (createdProject: CreatedProject) => void;
  onMessagingSetupChange: (messagingSetup: ScmMessagingSetup) => void;
  selectedFeatures: ProductSolution[] | undefined;
  selectedPlatform: OnboardingSelectedSDK;
  selectedRepository: Repository | undefined;
  genBackButton?: StepProps['genBackButton'];
}

export function ScmMessaging({
  createdProject,
  genBackButton,
  messagingSetup,
  onCreatedProjectChange,
  onMessagingSetupChange,
  onComplete,
  selectedFeatures,
  selectedPlatform,
  selectedRepository,
}: ScmMessagingProps) {
  const organization = useOrganization();
  const {createOrReuseProject, isCreating, isDataPending} = useScmProjectCreation({
    createdProject,
    onCreatedProjectChange,
    selectedRepository,
  });
  const [submissionMode, setSubmissionMode] = useState<'continue' | 'setup-later'>();
  // Confirm and continue in the picker saves the destination and asks to
  // continue in the same tick, before this render has the new setup or its
  // revalidation. The request waits until Continue itself would be enabled.
  const [continueRequested, setContinueRequested] = useState(false);
  const validation = useScmMessagingSetupValidation({
    messagingSetup,
    onMessagingSetupChange,
  });

  const {
    providers,
    isPending,
    isError,
    isRefetchingIntegrations,
    refetchIntegrations,
    retry,
  } = useScmMessagingProviders();

  const [activeRow, setActiveRow] = useState<ScmMessagingActiveRow>(null);

  useEffect(() => {
    trackAnalytics('onboarding.scm_messaging_step_viewed', {organization});
  }, [organization]);

  const validatedActiveRow = validateActiveRow(activeRow, providers, messagingSetup);
  const visibleProviders = listedProviders(providers, validatedActiveRow, messagingSetup);
  // The destination as the creation snapshot records it, so the reuse check
  // can compare it against what the project was created with.
  const selection = useMemo(
    () =>
      messagingSetup.mode === 'selected'
        ? {
            provider: messagingSetup.providerKey,
            integrationId: messagingSetup.integrationId,
            channel:
              messagingSetup[
                providerDetails[messagingSetup.providerKey].channelTargetedBy
              ],
          }
        : undefined,
    [messagingSetup]
  );
  const getIntegrationAction = useCallback(
    ({shouldCreateRule}: Partial<RequestDataFragment>) => {
      if (!shouldCreateRule) {
        return;
      }
      return buildIntegrationAction(selection ?? {});
    },
    [selection]
  );

  const isSubmitting = isCreating || submissionMode !== undefined;
  // The picker stays open through revalidation and create, so it must spin
  // from the click — not only after submissionMode is set.
  const isContinuing = continueRequested || submissionMode === 'continue';

  // Continue creates the project and alert rules, so it must wait for a
  // conclusively revalidated destination — not merely the absence of a
  // problem, which is briefly true before the stale-check effect runs.
  const canContinue = validation.isValid && !isDataPending && !isSubmitting;
  const showContinue = messagingSetup.mode === 'selected';

  const submitProject = async ({
    includeMessagingRule,
  }: {
    includeMessagingRule: boolean;
  }) => {
    // Gated on the submission intent, not on the selection alone: Set up
    // later can submit with a staged destination still in the closure, which
    // must read as undefined — the same subtlety the includeMessagingRule
    // split guards.
    const stagedSelection = includeMessagingRule ? selection : undefined;

    await createOrReuseProject({
      platform: selectedPlatform,
      alertRuleConfig: includeMessagingRule
        ? getRequestDataFragment()
        : {defaultRules: true},
      getIntegrationAction: includeMessagingRule ? getIntegrationAction : undefined,
      stagedSelection,
      onSuccess: ({reused, notificationRule}) => {
        // Record the skip only on success: a failed creation keeps the staged
        // destination (and the Continue button) intact on the step.
        if (!includeMessagingRule) {
          onMessagingSetupChange({mode: 'skipped'});
        }
        // An unchanged Back-navigation reuse completes the step again but
        // creates nothing, so it is not a second completion.
        if (!reused) {
          trackAnalytics('onboarding.scm_messaging_completed', {
            organization,
            // Read from the created rule, the same source
            // scm_project_created reads, so the two events cannot disagree
            // about one submission. `includeMessagingRule` is the intent, and
            // an intent that builds no integration action creates no rule.
            notification: notificationRule ? 'integration' : 'email_only',
          });
        }
        onComplete(selectedPlatform, {
          product: selectedFeatures ?? DEFAULT_SCM_FEATURES,
        });
      },
    });
  };

  const handleContinue = async () => {
    if (messagingSetup.mode !== 'selected' || !canContinue) {
      return;
    }

    setSubmissionMode('continue');
    try {
      await submitProject({includeMessagingRule: true});
    } finally {
      setSubmissionMode(undefined);
    }
  };

  const handleSetupLater = async () => {
    setContinueRequested(false);
    setSubmissionMode('setup-later');
    try {
      await submitProject({includeMessagingRule: false});
    } finally {
      setSubmissionMode(undefined);
    }
  };

  const handleInstallComplete = async (providerKey: ScmMessagingProviderKey) => {
    // Exclusive immediately so Set up later cannot be clicked during the refetch.
    setActiveRow({providerKey, mode: 'configuring'});
    const result = await refetchIntegrations();
    const connected = (result.data ?? []).some(
      integration =>
        integration.provider.key === providerKey &&
        isIntegrationActive(integration) &&
        isEligibleForIssueAlerts(integration)
    );
    trackAnalytics('onboarding.scm_messaging_install_returned', {
      organization,
      provider: providerKey,
      outcome: connected ? 'connected' : 'not_connected',
    });
    // Drop exclusive if the install never surfaced a usable integration.
    if (result.isLoadingError || !connected) {
      setActiveRow(null);
    }
  };

  const handleRetryProviders = () => {
    trackAnalytics('onboarding.scm_messaging_providers_retry_clicked', {organization});
    retry();
  };

  const hasValidationAlert = !!validation.staleReason || validation.isError;

  const requestContinue = useCallback(() => setContinueRequested(true), []);
  const continueWhenReady = useEffectEvent(() => {
    setContinueRequested(false);
    handleContinue();
  });

  useEffect(() => {
    if (!continueRequested) {
      return;
    }
    if (messagingSetup.mode !== 'selected') {
      // oxlint-disable-next-line react/set-state-in-effect
      setContinueRequested(false);
      return;
    }
    if (canContinue) {
      continueWhenReady();
      return;
    }
    // Revalidation rejected the destination: keep the warning and the footer
    // rather than continuing later with whatever is chosen next.
    if (!validation.isPending && hasValidationAlert) {
      setContinueRequested(false);
    }
  }, [
    canContinue,
    continueRequested,
    hasValidationAlert,
    messagingSetup.mode,
    validation.isPending,
  ]);

  return (
    // The onboarding flow has no page-level query container (project creation
    // resolves against `#main`), and the flow's fixed footers preclude one
    // higher up, so each SCM step declares its own.
    <Stack containerType="inline-size">
      <ScmStepLayout>
        <ScmStepHeader
          heading={SCM_MESSAGING_TITLE}
          subtitle={t(
            'Send high priority issue alerts to Slack, Discord, or Microsoft Teams. Email alerts stay on even if you skip. You can change this anytime.'
          )}
        />

        <LayoutGroup>
          {hasValidationAlert && (
            <MotionStack layout="position" gap="sm" paddingBottom="sm" role="alert">
              {validation.staleReason === 'integration' && (
                <Alert variant="warning" showIcon>
                  {t(
                    "We couldn't find the saved integration. Choose a destination again."
                  )}
                </Alert>
              )}
              {validation.staleReason === 'inactiveIntegration' && (
                <Alert variant="warning" showIcon>
                  {t(
                    'The saved integration is no longer active. Choose a destination again.'
                  )}
                </Alert>
              )}
              {validation.staleReason === 'ineligibleIntegration' && (
                <Alert variant="warning" showIcon>
                  {t(
                    'The saved workspace can no longer receive issue alerts. Choose a destination again.'
                  )}
                </Alert>
              )}
              {validation.staleReason === 'channel' && (
                <Alert variant="warning" showIcon>
                  {t("We couldn't verify the saved channel. Choose a destination again.")}
                </Alert>
              )}
              {validation.isError && (
                <Alert variant="danger" showIcon>
                  {t(
                    "We couldn't check the saved destination. Reload the page to try again."
                  )}
                </Alert>
              )}
            </MotionStack>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {isPending ? (
              <MotionStack
                key="pending"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                transition={{duration: 0.15}}
              >
                <Flex
                  justify="center"
                  role="status"
                  aria-label={t('Loading integrations')}
                >
                  <LoadingIndicator />
                </Flex>
              </MotionStack>
            ) : isError ? (
              <MotionStack
                key="error"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                transition={{duration: 0.15}}
              >
                <Alert
                  variant="warning"
                  role="alert"
                  trailingItems={
                    <Alert.Button onClick={handleRetryProviders}>
                      {t('Retry')}
                    </Alert.Button>
                  }
                >
                  {t('Failed to load integrations.')}
                </Alert>
              </MotionStack>
            ) : providers.length > 0 ? (
              // Drives its own entry: the providers usually land after the step
              // has entered, and rows mounting that late would otherwise wait
              // on the step's signal and stay hidden.
              <MotionStack key="list" layout="position" {...ONBOARDING_STAGGER} gap="lg">
                {visibleProviders.map(resolvedProvider => (
                  <ScmMessagingProviderRow
                    key={resolvedProvider.providerKey}
                    resolvedProvider={resolvedProvider}
                    messagingSetup={messagingSetup}
                    onMessagingSetupChange={onMessagingSetupChange}
                    onInstallComplete={handleInstallComplete}
                    activeRow={validatedActiveRow}
                    onActiveRowChange={setActiveRow}
                    isRefetchingIntegrations={isRefetchingIntegrations}
                    isContinuing={isContinuing}
                    onContinue={requestContinue}
                  />
                ))}
              </MotionStack>
            ) : null}
          </AnimatePresence>

          {validatedActiveRow === null && (
            <MotionFlex
              {...ONBOARDING_ENTER}
              align="center"
              justify="between"
              gap="md"
              width="100%"
              paddingTop="2xl"
            >
              <Flex align="center">{genBackButton?.()}</Flex>
              <Flex align="center" gap="md">
                <Button
                  variant="transparent"
                  analyticsEventKey="onboarding.scm_messaging_setup_later_clicked"
                  analyticsEventName="Onboarding: SCM Messaging Setup Later Clicked"
                  busy={submissionMode === 'setup-later'}
                  disabled={isDataPending || isSubmitting}
                  onClick={handleSetupLater}
                >
                  {t('Set up later')}
                </Button>
                {showContinue && (
                  <Button
                    variant="primary"
                    analyticsEventKey="onboarding.scm_messaging_continue_clicked"
                    analyticsEventName="Onboarding: SCM Messaging Continue Clicked"
                    busy={submissionMode === 'continue'}
                    disabled={!canContinue}
                    onClick={handleContinue}
                  >
                    {t('Continue')}
                  </Button>
                )}
              </Flex>
            </MotionFlex>
          )}
        </LayoutGroup>
      </ScmStepLayout>
    </Stack>
  );
}

/**
 * Returns `activeRow` when it is still usable, or `null` when it is stale:
 * - The provider is missing from the list (e.g. a refetch error unmounted it).
 * - The row is in removing mode but the destination was cleared externally.
 * - The row is in configuring mode but the provider is neither connected nor
 *   still installable (the post-install snapshot before refetch settles).
 */
function validateActiveRow(
  activeRow: ScmMessagingActiveRow,
  providers: MessagingProviderList,
  messagingSetup: ScmMessagingSetup
): ScmMessagingActiveRow {
  if (!activeRow) {
    return null;
  }
  const resolvedProvider = providers.find(p => p.providerKey === activeRow.providerKey);
  if (!resolvedProvider) {
    return null;
  }
  if (resolvedProvider.status === 'connected') {
    if (activeRow.mode === 'removing') {
      const isConfigured =
        messagingSetup.mode === 'selected' &&
        messagingSetup.providerKey === activeRow.providerKey &&
        resolvedProvider.eligibleIntegrations.some(
          i => i.id === messagingSetup.integrationId
        );
      if (!isConfigured) {
        return null;
      }
    }
    return activeRow;
  }
  // Post-install: configuring is set before the refetch promotes installable
  // to connected. Keep exclusive so the footer cannot be clicked in between.
  if (activeRow.mode === 'configuring' && resolvedProvider.status === 'installable') {
    return activeRow;
  }
  return null;
}

/**
 * Rows shown in the provider list. Exclusive while a row is being configured
 * or removed, and while a destination is saved — other providers stay hidden
 * until the destination is cleared. Falls back to the full list when the
 * exclusive provider is missing so a stale selection cannot blank the step.
 */
function listedProviders(
  providers: MessagingProviderList,
  exclusiveRow: ScmMessagingActiveRow,
  messagingSetup: ScmMessagingSetup
): MessagingProviderList {
  const exclusiveKey =
    exclusiveRow?.providerKey ??
    (messagingSetup.mode === 'selected' ? messagingSetup.providerKey : undefined);
  if (exclusiveKey === undefined) {
    return providers;
  }
  const exclusive = providers.filter(provider => provider.providerKey === exclusiveKey);
  return exclusive.length > 0 ? exclusive : providers;
}

const MotionFlex = motion.create(Flex);
const MotionStack = motion.create(Stack);
