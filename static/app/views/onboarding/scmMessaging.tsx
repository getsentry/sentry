import {useState} from 'react';
import {AnimatePresence, LayoutGroup, motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {ScmMessagingProviderKey} from 'sentry/components/onboarding/scm/messagingProviders';
import {ScmMessagingProviderRow} from 'sentry/components/onboarding/scm/scmMessagingProviderRow';
import type {
  ScmMessagingActiveRow,
  ScmMessagingSetup,
} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import {useScmMessagingProviders} from 'sentry/components/onboarding/scm/useScmMessagingProviders';
import {
  isEligibleForIssueAlerts,
  isIntegrationActive,
  useScmMessagingSetupValidation,
} from 'sentry/components/onboarding/scm/useScmMessagingSetupValidation';
import {IconMail} from 'sentry/icons/iconMail';
import {t} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {SCM_STEP_CONTENT_WIDTH} from 'sentry/views/onboarding/consts';

import type {StepProps} from './types';

/**
 * Shared by the step descriptor's `title` (document title / stepper) and the
 * step's own heading so the two cannot drift apart.
 */
export const SCM_MESSAGING_TITLE = t('Get alerts where your team works');

interface ScmMessagingProps {
  messagingSetup: ScmMessagingSetup;
  onMessagingSetupChange: (messagingSetup: ScmMessagingSetup) => void;
  selectedPlatform: OnboardingSelectedSDK;
  genBackButton?: StepProps['genBackButton'];
  onComplete?: StepProps['onComplete'];
}

export function ScmMessaging({
  genBackButton,
  messagingSetup,
  onMessagingSetupChange,
  onComplete,
  selectedPlatform,
}: ScmMessagingProps) {
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

  // Continue creates the project and alert rules. It renders as soon as a
  // destination is selected so Set up later does not shift, but stays disabled
  // until the destination is conclusively revalidated.
  const canContinue = validation.isValid;
  const showContinue = messagingSetup.mode === 'selected';

  const handleContinue = () => onComplete?.();

  const handleSetupLater = () => {
    onMessagingSetupChange({mode: 'skipped'});
    onComplete?.();
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
    if (result.isError || !connected) {
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
                {providers.map(viewModel =>
                  validatedActiveRow === null ||
                  validatedActiveRow.providerKey === viewModel.providerKey ? (
                    <ScmMessagingProviderRow
                      key={viewModel.providerKey}
                      viewModel={viewModel}
                      messagingSetup={messagingSetup}
                      onMessagingSetupChange={onMessagingSetupChange}
                      onInstallComplete={handleInstallComplete}
                      activeRow={validatedActiveRow}
                      onActiveRowChange={setActiveRow}
                      isRefetchingIntegrations={isRefetchingIntegrations}
                    />
                  ) : null
                )}
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
                  onClick={handleSetupLater}
                >
                  {t('Set up later')}
                </Button>
                {showContinue && (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!canContinue}
                    analyticsEventKey="onboarding.scm_messaging_continue_clicked"
                    analyticsEventName="Onboarding: SCM Messaging Continue Clicked"
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
  providers: ReturnType<typeof useScmMessagingProviders>['providers'],
  messagingSetup: ScmMessagingSetup
): ScmMessagingActiveRow {
  if (!activeRow) {
    return null;
  }
  const viewModel = providers.find(p => p.providerKey === activeRow.providerKey);
  if (!viewModel) {
    return null;
  }
  if (viewModel.status === 'connected') {
    if (activeRow.mode === 'removing') {
      const isConfigured =
        messagingSetup.mode === 'selected' &&
        messagingSetup.providerKey === activeRow.providerKey &&
        viewModel.eligibleIntegrations.some(i => i.id === messagingSetup.integrationId);
      if (!isConfigured) {
        return null;
      }
    }
    return activeRow;
  }
  // Post-install: configuring is set before the refetch promotes installable
  // to connected. Keep exclusive so the footer cannot be clicked in between.
  if (activeRow.mode === 'configuring' && viewModel.status === 'installable') {
    return activeRow;
  }
  return null;
}

const MotionFlex = motion.create(Flex);
const MotionStack = motion.create(Stack);
