import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ScmMessagingProviderRow} from 'sentry/components/onboarding/scm/scmMessagingProviderRow';
import type {ScmMessagingSetup} from 'sentry/components/onboarding/scm/scmMessagingSetup';
import {useScmMessagingProviders} from 'sentry/components/onboarding/scm/useScmMessagingProviders';
import {useScmMessagingSetupValidation} from 'sentry/components/onboarding/scm/useScmMessagingSetupValidation';
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

  // Continue creates the project and alert rules, so it must wait for a
  // conclusively revalidated destination — not merely the absence of a
  // problem, which is briefly true before the stale-check effect runs.
  const canContinue = validation.isValid;

  const handleContinue = () => onComplete?.();

  const handleSetupLater = () => {
    onMessagingSetupChange({mode: 'skipped'});
    onComplete?.();
  };

  return (
    <Stack align="center" gap="2xl" flexGrow={1}>
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

        {validation.staleReason === 'integration' && (
          <Alert variant="warning" showIcon>
            {t("We couldn't find the saved integration. Choose a destination again.")}
          </Alert>
        )}
        {validation.staleReason === 'inactiveIntegration' && (
          <Alert variant="warning" showIcon>
            {t('The saved integration is no longer active. Choose a destination again.')}
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
            {t("We couldn't check the saved destination. Reload the page to try again.")}
          </Alert>
        )}

        <Flex align="center" gap="sm">
          <IconMail size="sm" variant="muted" />
          <Text variant="muted">{t('Email alerts will be included by default')}</Text>
        </Flex>

        {isPending && (
          <Flex justify="center">
            <LoadingIndicator />
          </Flex>
        )}

        {isError && !isPending && (
          <Alert
            variant="warning"
            trailingItems={<Alert.Button onClick={retry}>{t('Retry')}</Alert.Button>}
          >
            {t('Failed to load integrations.')}
          </Alert>
        )}

        {!isPending && !isError && providers.length > 0 && (
          <Stack gap="md">
            {providers.map(viewModel => (
              <ScmMessagingProviderRow
                key={viewModel.providerKey}
                viewModel={viewModel}
                messagingSetup={messagingSetup}
                onMessagingSetupChange={onMessagingSetupChange}
                onInstallComplete={refetchIntegrations}
                isRefetchingIntegrations={isRefetchingIntegrations}
              />
            ))}
          </Stack>
        )}

        <Flex align="center" justify="between" width="100%" paddingTop="sm">
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
            <Button
              size="sm"
              variant="primary"
              analyticsEventKey="onboarding.scm_messaging_continue_clicked"
              analyticsEventName="Onboarding: SCM Messaging Continue Clicked"
              disabled={!canContinue}
              onClick={handleContinue}
            >
              {t('Continue')}
            </Button>
          </Flex>
        </Flex>
      </Stack>
    </Stack>
  );
}
