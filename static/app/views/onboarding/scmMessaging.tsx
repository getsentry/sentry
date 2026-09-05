import {useCallback, useMemo, useState} from 'react';
import {AnimatePresence, LayoutGroup, motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

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
import {useScmMessagingProviders} from 'sentry/components/onboarding/scm/useScmMessagingProviders';
import {
  isEligibleForIssueAlerts,
  isIntegrationActive,
  useScmMessagingSetupValidation,
} from 'sentry/components/onboarding/scm/useScmMessagingSetupValidation';
import {useScmProjectCreation} from 'sentry/components/onboarding/scm/useScmProjectCreation';
import {IconMail} from 'sentry/icons/iconMail';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';
import {
  buildIntegrationAction,
  providerDetails,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {
  getRequestDataFragment,
  type RequestDataFragment,
} from 'sentry/views/projectInstall/issueAlertOptions';

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
  onCreatedProjectChange: (createdProject: CreatedProject) => void;
  onMessagingSetupChange: (messagingSetup: ScmMessagingSetup) => void;
  selectedFeatures: ProductSolution[] | undefined;
  selectedPlatform: OnboardingSelectedSDK;
  selectedRepository: Repository | undefined;
  genBackButton?: StepProps['genBackButton'];
  onComplete?: StepProps['onComplete'];
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
  const {createOrReuseProject, isCreating, isDataPending} = useScmProjectCreation({
    createdProject,
    onCreatedProjectChange,
    selectedRepository,
  });
  const [submissionMode, setSubmissionMode] = useState<'continue' | 'setup-later'>();
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
      onSuccess: () => {
        // Record the skip only on success: a failed creation keeps the staged
        // destination (and the Continue button) intact on the step.
        if (!includeMessagingRule) {
          onMessagingSetupChange({mode: 'skipped'});
        }
        onComplete?.(selectedPlatform, {
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
    // Drop exclusive if the install never surfaced a usable integration.
    if (result.isLoadingError || !connected) {
      setActiveRow(null);
    }
  };

  const hasValidationAlert = !!validation.staleReason || validation.isError;

  return (
    // The onboarding flow has no page-level query container (project creation
    // resolves against `#main`), and the flow's fixed footers preclude one
    // higher up, so each SCM step declares its own.
    <Stack align="center" gap="2xl" flexGrow={1} containerType="inline-size">
      <Stack gap="2xl" maxWidth={`min(${SCM_STEP_CONTENT_WIDTH}, 100%)`} width="100%">
        <Stack gap="lg">
          <Heading as="h2" size="3xl">
            {SCM_MESSAGING_TITLE}
          </Heading>
          <Text variant="muted" size="md" density="comfortable">
            {t(
              "Choose where to send alerts for your %s project. We'll create the project and its alert rules when you continue.",
              selectedPlatform.name
            )}
          </Text>
        </Stack>

        <LayoutGroup>
          {hasValidationAlert && (
            <MotionStack layout="position" gap="sm" paddingBottom="sm">
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

          <MotionFlex layout="position" align="center" gap="sm">
            <IconMail size="sm" variant="muted" />
            <Text variant="muted">{t('Email alerts will be included by default')}</Text>
          </MotionFlex>

          <AnimatePresence mode="wait" initial={false}>
            {isPending ? (
              <MotionStack
                key="pending"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                transition={{duration: 0.15}}
              >
                <Flex justify="center">
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
                  trailingItems={
                    <Alert.Button onClick={retry}>{t('Retry')}</Alert.Button>
                  }
                >
                  {t('Failed to load integrations.')}
                </Alert>
              </MotionStack>
            ) : providers.length > 0 ? (
              <MotionStack
                key="list"
                layout="position"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                transition={{duration: 0.15}}
                gap="lg"
              >
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
                  />
                ))}
              </MotionStack>
            ) : null}
          </AnimatePresence>

          {validatedActiveRow === null && (
            <MotionFlex
              layout="position"
              align="center"
              justify="between"
              width="100%"
              paddingTop="sm"
            >
              <Flex align="center">{genBackButton?.()}</Flex>
              <Flex align="center" gap="md">
                <Button
                  size="sm"
                  variant="secondary"
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
                    size="sm"
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
      </Stack>
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
