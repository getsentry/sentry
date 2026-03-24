import {useCallback, useEffect} from 'react';
import {motion} from 'framer-motion';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ScmBenefitsCard} from './components/scmBenefitsCard';
import {ScmProviderPills} from './components/scmProviderPills';
import {ScmRepoSelector} from './components/scmRepoSelector';
import {ScmStepContent} from './components/scmStepContent';
import {ScmStepFooter} from './components/scmStepFooter';
import {ScmStepHeader} from './components/scmStepHeader';
import {useScmPlatformDetection} from './components/useScmPlatformDetection';
import {useScmProviders} from './components/useScmProviders';
import {SCM_STEP_FADE_IN, scmStepFadeIn} from './consts';
import type {StepProps} from './types';

export function ScmConnect({onComplete}: StepProps) {
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
  useScmPlatformDetection(selectedRepository?.id);

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

  if (isPending) {
    return (
      <Flex justify="center" align="center" flexGrow={1}>
        <LoadingIndicator />
      </Flex>
    );
  }

  if (isError) {
    return (
      <Flex direction="column" align="center" gap="lg" flexGrow={1}>
        <Text variant="muted">{t('Failed to load integrations.')}</Text>
        <Button onClick={() => refetch()}>{t('Retry')}</Button>
      </Flex>
    );
  }

  return (
    <Flex direction="column" align="center" gap="2xl" flexGrow={1}>
      <ScmStepHeader
        stepNumber={1}
        heading={t('Connect a repository')}
        subtitle={t('Link your source control for enhanced debugging features')}
        tag={t('Optional')}
      />

      <ScmStepContent>
        {effectiveIntegration ? (
          <Stack gap="xl">
            <motion.div {...SCM_STEP_FADE_IN}>
              <Tag variant="success" icon={<IconCheckmark />}>
                {t(
                  'Connected to %s',
                  effectiveIntegration.domainName || effectiveIntegration.provider.name
                )}
              </Tag>
            </motion.div>
            <motion.div {...scmStepFadeIn(0.1)}>
              <ScmRepoSelector integration={effectiveIntegration} />
            </motion.div>
            {selectedRepository && (
              <motion.div {...SCM_STEP_FADE_IN}>
                <ScmBenefitsCard />
              </motion.div>
            )}
          </Stack>
        ) : (
          <Stack gap="2xl">
            <motion.div {...SCM_STEP_FADE_IN}>
              <ScmProviderPills providers={scmProviders} onInstall={handleInstall} />
            </motion.div>
            <motion.div {...scmStepFadeIn(0.15)}>
              <ScmBenefitsCard showTitle />
            </motion.div>
          </Stack>
        )}
      </ScmStepContent>

      <ScmStepFooter>
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
      </ScmStepFooter>
    </Flex>
  );
}
