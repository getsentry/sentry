import {useCallback, useEffect} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ScmBenefitsCard} from './components/scmBenefitsCard';
import {ScmProviderPills} from './components/scmProviderPills';
import {ScmRepoSelector} from './components/scmRepoSelector';
import {useScmPlatformDetection} from './components/useScmPlatformDetection';
import {useScmProviders} from './components/useScmProviders';
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

  const handleDisconnect = useCallback(() => {
    setSelectedIntegration(undefined);
    setSelectedRepository(undefined);
  }, [setSelectedIntegration, setSelectedRepository]);

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
    <Flex direction="column" align="center" gap="xl" flexGrow={1}>
      <Stack align="center" gap="md">
        <Flex align="center" gap="lg">
          <Text variant="muted" size="lg">
            {t('Step 1 of 3')}
          </Text>
          <Tag variant="muted">{t('Optional')}</Tag>
        </Flex>
        <Heading as="h2">{t('Connect a repository')}</Heading>
        <Text variant="muted">
          {t('Link your source control for enhanced debugging features')}
        </Text>
      </Stack>

      <Stack gap="lg" width="100%" maxWidth="600px">
        {effectiveIntegration ? (
          <Stack gap="lg">
            <Flex align="center" justify="between">
              <Tag variant="success" icon={<IconCheckmark />}>
                {t(
                  'Connected to %s',
                  effectiveIntegration.domainName || effectiveIntegration.provider.name
                )}
              </Tag>
              <Button size="xs" icon={<IconClose size="xs" />} onClick={handleDisconnect}>
                {t('Disconnect')}
              </Button>
            </Flex>
            <ScmRepoSelector integration={effectiveIntegration} />
            {selectedRepository && <ScmBenefitsCard />}
          </Stack>
        ) : (
          <Stack gap="lg">
            <ScmProviderPills providers={scmProviders} onInstall={handleInstall} />
            <ScmBenefitsCard showTitle />
          </Stack>
        )}
      </Stack>

      <Flex gap="md" align="center">
        {!selectedRepository && (
          <Button
            analyticsEventKey="onboarding.scm_connect_skip_clicked"
            analyticsEventName="Onboarding: SCM Connect Skip Clicked"
            analyticsParams={{
              has_integration: !!effectiveIntegration,
              has_repo: !!selectedRepository,
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
    </Flex>
  );
}
