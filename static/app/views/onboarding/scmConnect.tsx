import {useCallback, useEffect, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {t} from 'sentry/locale';
import type {Integration, IntegrationRepository} from 'sentry/types/integrations';

import {ConnectedView} from './components/scmConnectedView';
import {ProviderPills} from './components/scmProviderPills';
import type {StepProps} from './types';
import {useScmProviders} from './useScmProviders';

export function ScmConnect({onComplete}: StepProps) {
  const onboardingContext = useOnboardingContext();
  const {scmProviders, scmIntegrations, isPending, refetchIntegrations} =
    useScmProviders();

  const [activeIntegration, setActiveIntegration] = useState<Integration | null>(
    () => onboardingContext.selectedIntegration ?? null
  );
  const [selectedRepo, setSelectedRepo] = useState<IntegrationRepository | null>(
    () => onboardingContext.selectedRepository ?? null
  );

  // Auto-select an existing SCM integration so returning users see the
  // connected view instead of the provider pills.
  useEffect(() => {
    if (!isPending && scmIntegrations.length > 0 && !activeIntegration) {
      setActiveIntegration(scmIntegrations[0]!);
    }
  }, [isPending, scmIntegrations, activeIntegration]);

  const handleInstall = useCallback(
    (data: Integration) => {
      setActiveIntegration(data);
      setSelectedRepo(null);
      refetchIntegrations();
    },
    [refetchIntegrations]
  );

  const handleDisconnect = useCallback(() => {
    setActiveIntegration(null);
    setSelectedRepo(null);
  }, []);

  const handleSelectProvider = useCallback((installation: Integration) => {
    setActiveIntegration(installation);
    setSelectedRepo(null);
  }, []);

  const handleContinue = useCallback(() => {
    if (activeIntegration) {
      onboardingContext.setSelectedIntegration(activeIntegration);
      if (selectedRepo) {
        onboardingContext.setSelectedRepository(selectedRepo);
      }
    }
    onComplete();
  }, [activeIntegration, selectedRepo, onboardingContext, onComplete]);

  if (isPending) {
    return (
      <Flex justify="center" align="center" flexGrow={1}>
        <LoadingIndicator />
      </Flex>
    );
  }

  return (
    <Flex direction="column" align="center" gap="xl" flexGrow={1}>
      <Stack align="center" gap="md">
        <Heading as="h2">{t('Connect a repository')}</Heading>
        <Text variant="muted">
          {t('Link your source control for enhanced debugging features')}
        </Text>
      </Stack>

      <Stack gap="lg" style={{width: '100%', maxWidth: 600}}>
        {activeIntegration ? (
          <ConnectedView
            integration={activeIntegration}
            selectedRepo={selectedRepo}
            onDisconnect={handleDisconnect}
            onSelectRepo={setSelectedRepo}
          />
        ) : (
          <ProviderPills
            providers={scmProviders}
            integrations={scmIntegrations}
            onInstall={handleInstall}
            onSelect={handleSelectProvider}
          />
        )}
      </Stack>

      <Flex gap="md" align="center">
        <Button onClick={() => onComplete()}>{t('Skip for now')}</Button>
        <Button priority="primary" onClick={handleContinue}>
          {t('Continue')}
        </Button>
      </Flex>
    </Flex>
  );
}
