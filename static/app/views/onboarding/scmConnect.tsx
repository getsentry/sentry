import {useCallback, useEffect} from 'react';
import {LayoutGroup, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {IconCheckmark, IconClose, IconLock} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ScmProviderPills} from './components/scmProviderPills';
import {ScmRepoSelector} from './components/scmRepoSelector';
import {ScmStepHeader} from './components/scmStepHeader';
import {useScmPlatformDetection} from './components/useScmPlatformDetection';
import {useScmProviders} from './components/useScmProviders';
import {SCM_STEP_CONTENT_WIDTH} from './consts';
import type {StepProps} from './types';

const SCM_INFO_SECTIONS = [
  {
    title: t('What we use it for'),
    icon: <IconCheckmark size="sm" variant="success" />,
    variant: 'success' as const,
    items: [
      t('Stack trace context: shows lines around the error'),
      t('Suspect commits: git blame on stack trace files'),
      t('CODEOWNERS: for routing and assigning issues'),
    ],
  },
  {
    title: t('What we don’t do'),
    icon: <IconClose size="sm" variant="danger" />,
    variant: 'danger' as const,
    items: [
      t('Train AI on your code'),
      t('Read unrelated code: only what’s tied to your issues'),
      t('Push code without your permission'),
    ],
  },
];

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
    <Flex direction="column" align="center" gap="3xl" flexGrow={1}>
      <ScmStepHeader
        heading={t('Connect your code')}
        subtitle={t(
          'Linking a repo auto-detects your platform and unlocks stack trace linking, suspect commits, suggested assignees, and Seer.'
        )}
      />

      <LayoutGroup>
        {isPending ? (
          <Flex justify="center" align="center">
            <LoadingIndicator mini />
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
            <Stack gap="md" paddingTop="2xl">
              <Text variant="secondary" bold size="sm" density="compressed" uppercase>
                {t(
                  'Connected to %s / %s',
                  effectiveIntegration.provider.name,
                  effectiveIntegration.name
                )}
              </Text>
              <ScmRepoSelector integration={effectiveIntegration} />
            </Stack>
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
        <MotionFlex
          layout="position"
          gap="sm"
          align="center"
          width="100%"
          maxWidth={SCM_STEP_CONTENT_WIDTH}
        >
          <IconLock size="sm" variant="secondary" locked />
          <Text variant="secondary" size="md" density="comfortable">
            {t('Your code stays yours. We don’t share, sell, or train on it.')}
          </Text>
        </MotionFlex>

        <MotionGrid
          columns={{xs: '1fr', md: '1fr 1fr'}}
          width="100%"
          maxWidth={SCM_STEP_CONTENT_WIDTH}
          background="secondary"
          radius="lg"
          border="secondary"
          layout="position"
        >
          {SCM_INFO_SECTIONS.map(section => (
            <Stack key={section.title} gap="xl" padding="2xl">
              <Text
                bold
                size="sm"
                density="comfortable"
                variant={section.variant}
                uppercase
              >
                {section.title}
              </Text>
              <Stack gap="lg">
                {section.items.map(item => (
                  <Grid key={item} columns="max-content 1fr" gap="sm">
                    {section.icon}
                    <Text variant="secondary" size="md" density="comfortable">
                      {item}
                    </Text>
                  </Grid>
                ))}
              </Stack>
            </Stack>
          ))}
        </MotionGrid>

        <MotionFlex
          layout="position"
          align="center"
          justify="between"
          width="100%"
          maxWidth={SCM_STEP_CONTENT_WIDTH}
          paddingTop="3xl"
        >
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
                variant="transparent"
              >
                {t('Continue without a repo')}
              </Button>
            )}

            <Button
              variant="primary"
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
        </MotionFlex>
      </LayoutGroup>
    </Flex>
  );
}

const MotionStack = motion.create(Stack);
const MotionFlex = motion.create(Flex);
const MotionGrid = motion.create(Grid);
