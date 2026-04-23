import {useCallback, useEffect} from 'react';
import {LayoutGroup, motion} from 'framer-motion';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {GenericFooter} from 'sentry/views/onboarding/components/genericFooter';

import {ScmProviderPills} from './components/scmProviderPills';
import {ScmRepoSelector} from './components/scmRepoSelector';
import {ScmStepHeader} from './components/scmStepHeader';
import {useScmPlatformDetection} from './components/useScmPlatformDetection';
import {useScmProviders} from './components/useScmProviders';
import {SCM_STEP_CONTENT_WIDTH} from './consts';
import type {StepProps} from './types';

export function ScmConnect({onComplete, genBackButton}: StepProps) {
  const organization = useOrganization();
  const {
    selectedIntegration,
    setSelectedIntegration,
    selectedRepository,
    setSelectedRepository,
  } = useOnboardingContext();
  const {
    scmProviders,
    isPending,
    isError,
    refetch,
    refetchIntegrations,
    activeIntegrationExisting,
  } = useScmProviders();

  // Pre-warm platform detection so results are cached when the user advances
  useScmPlatformDetection(selectedRepository);

  // Derive integration from explicit selection, falling back to existing
  const effectiveIntegration = selectedIntegration ?? activeIntegrationExisting;

  useEffect(() => {
    trackAnalytics('onboarding.scm_connect_step_viewed', {organization});
  }, [organization]);

  const handleInstall = useCallback(
    (data: Integration) => {
      setSelectedIntegration(data);
      setSelectedRepository(undefined);
      refetchIntegrations();
    },
    [setSelectedIntegration, setSelectedRepository, refetchIntegrations]
  );

  return (
    <Flex direction="column" align="center" gap="2xl" flexGrow={1}>
      <ScmStepHeader
        heading={t('Connect a repo')}
        subtitle={t(
          'Connect a repo to auto-detect your platform and unlock stack trace linking, suspect commits, suggested assignees, and Seer.'
        )}
      />

      <LayoutGroup>
        {isPending ? (
          <Flex justify="center" align="center">
            <LoadingIndicator size={24} />
          </Flex>
        ) : isError ? (
          <Stack gap="lg" align="center">
            <Text variant="muted">{t('Failed to load integrations.')}</Text>
            <Button onClick={() => refetch()}>{t('Retry')}</Button>
          </Stack>
        ) : effectiveIntegration ? (
          <MotionStack
            key="with-integration"
            gap="xl"
            width="100%"
            maxWidth={SCM_STEP_CONTENT_WIDTH}
          >
            <Container>
              <Tag variant="success" icon={<IconCheckmark />}>
                {t(
                  'Connected to %s org %s',
                  effectiveIntegration.provider.name,
                  effectiveIntegration.name
                )}
              </Tag>
            </Container>
            <ScmRepoSelector integration={effectiveIntegration} />
          </MotionStack>
        ) : (
          <MotionStack
            key="without-integration"
            gap="2xl"
            width="100%"
            maxWidth={SCM_STEP_CONTENT_WIDTH}
          >
            <ScmProviderPills providers={scmProviders} onInstall={handleInstall} />
          </MotionStack>
        )}
      </LayoutGroup>

      <GenericFooter gap="3xl" padding="0 3xl">
        <Flex align="center">{genBackButton?.()}</Flex>
        <Flex align="center" gap="md">
          {!selectedRepository && (
            <Button
              analyticsEventKey="onboarding.scm_connect_skip_clicked"
              analyticsEventName="Onboarding: SCM Connect Skip Clicked"
              analyticsParams={{
                has_integration: !!effectiveIntegration,
              }}
              onClick={() => onComplete()}
            >
              {t('Skip for now')}
            </Button>
          )}

          <Button
            priority="primary"
            analyticsEventKey="onboarding.scm_connect_continue_clicked"
            analyticsEventName="Onboarding: SCM Connect Continue Clicked"
            analyticsParams={{
              provider: effectiveIntegration?.provider.key ?? '',
              repo: selectedRepository?.name ?? '',
            }}
            onClick={() => {
              if (effectiveIntegration && !selectedIntegration) {
                setSelectedIntegration(effectiveIntegration);
              }
              onComplete();
            }}
            disabled={!selectedRepository?.id}
          >
            {t('Continue')}
          </Button>
        </Flex>
      </GenericFooter>
    </Flex>
  );
}

const MotionStack = motion.create(Stack);
