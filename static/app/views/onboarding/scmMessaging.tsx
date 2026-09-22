import {useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {ScmMessagingProviderKey} from 'sentry/components/onboarding/scm/messagingProviders';
import {ScmMessagingProviderRow} from 'sentry/components/onboarding/scm/scmMessagingProviderRow';
import type {
  ScmMessagingActiveRow,
  ScmMessagingSetup,
} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import {ScmStepLayout} from 'sentry/components/onboarding/scm/scmStepLayout';
import {useScmMessagingProviders} from 'sentry/components/onboarding/scm/useScmMessagingProviders';
import {
  isEligibleForIssueAlerts,
  isIntegrationActive,
  useScmMessagingSetupValidation,
} from 'sentry/components/onboarding/scm/useScmMessagingSetupValidation';
import {t} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';

import {
  ONBOARDING_ENTER,
  ONBOARDING_STAGGER,
  ONBOARDING_STAGGER_CHILDREN,
} from './animations';
import type {StepProps} from './types';

/**
 * Shared by the step descriptor's `title` (document title / stepper) and the
 * step's own heading so the two cannot drift apart.
 */
export const SCM_MESSAGING_TITLE = t('Get alerts where your team works');

type MessagingProviderList = ReturnType<typeof useScmMessagingProviders>['providers'];

interface ScmMessagingProps {
  messagingSetup: ScmMessagingSetup;
  onComplete: StepProps['onComplete'];
  onMessagingSetupChange: (messagingSetup: ScmMessagingSetup) => void;
  /**
   * Not rendered, but the step only exists once a platform is chosen: hosts
   * narrow on this before mounting, and the created project depends on it.
   */
  selectedPlatform: OnboardingSelectedSDK;
  genBackButton?: StepProps['genBackButton'];
}

export function ScmMessaging({
  messagingSetup,
  genBackButton,
  onMessagingSetupChange,
  onComplete,
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
  const visibleProviders = listedProviders(providers, validatedActiveRow, messagingSetup);

  // The step offers exactly one way forward: Set up later until a destination is
  // selected, then Continue, which creates the project and its alert rules and
  // stays disabled until that destination is conclusively revalidated.
  const showContinue = messagingSetup.mode === 'selected';
  const canContinue = validation.isValid;

  const handleContinue = () => onComplete();

  const handleSetupLater = () => {
    onMessagingSetupChange({mode: 'skipped'});
    onComplete();
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
    <Stack containerType="inline-size">
      <ScmStepLayout>
        <MotionStack gap="lg" paddingBottom="2xl" {...ONBOARDING_STAGGER}>
          <MotionContainer {...ONBOARDING_ENTER}>
            <Heading as="h2" size="3xl" align="center">
              {SCM_MESSAGING_TITLE}
            </Heading>
          </MotionContainer>
          <MotionContainer {...ONBOARDING_ENTER}>
            <Text align="center" variant="muted" size="lg" density="comfortable">
              {t(
                'Send high priority issue alerts to Slack, Discord, or Teams. Email alerts stay on even if you skip. You can change this anytime.'
              )}
            </Text>
          </MotionContainer>
        </MotionStack>

        {hasValidationAlert && (
          <MotionStack gap="sm" paddingBottom="sm" {...ONBOARDING_ENTER}>
            {validation.staleReason === 'integration' && (
              <Alert variant="warning" showIcon>
                {t("We couldn't find the saved integration. Choose a destination again.")}
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
              {...ONBOARDING_ENTER}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Flex justify="center">
                <LoadingIndicator />
              </Flex>
            </MotionStack>
          ) : isError ? (
            <MotionStack
              key="error"
              {...ONBOARDING_ENTER}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Alert
                variant="warning"
                trailingItems={<Alert.Button onClick={retry}>{t('Retry')}</Alert.Button>}
              >
                {t('Failed to load integrations.')}
              </Alert>
            </MotionStack>
          ) : providers.length > 0 ? (
            <MotionStack
              key="list"
              {...ONBOARDING_STAGGER_CHILDREN}
              initial="initial"
              animate="animate"
              exit="exit"
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
                  onContinue={handleContinue}
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
              {showContinue ? (
                <Button
                  variant="primary"
                  disabled={!canContinue}
                  analyticsEventKey="onboarding.scm_messaging_continue_clicked"
                  analyticsEventName="Onboarding: SCM Messaging Continue Clicked"
                  onClick={handleContinue}
                >
                  {t('Continue')}
                </Button>
              ) : (
                <Button
                  variant="transparent"
                  analyticsEventKey="onboarding.scm_messaging_setup_later_clicked"
                  analyticsEventName="Onboarding: SCM Messaging Setup Later Clicked"
                  onClick={handleSetupLater}
                >
                  {t('Set up later')}
                </Button>
              )}
            </Flex>
          </MotionFlex>
        )}
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
const MotionContainer = motion.create(Container);
