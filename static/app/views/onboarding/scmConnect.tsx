import {useCallback, useEffect} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';

import {ScmProviderPills} from './components/scmProviderPills';
import {ScmView} from './components/scmView';
import type {StepProps} from './types';
import {useScmProviders} from './useScmProviders';

export function ScmConnect({onComplete}: StepProps) {
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

  // If an existing SCM integration is detected and context doesn't have one
  // yet, persist it to context so downstream steps and child components can
  // read it without prop drilling.
  const hasSelectedIntegration = !!selectedIntegration;
  useEffect(() => {
    if (!hasSelectedIntegration && activeIntegrationExisting) {
      setSelectedIntegration(activeIntegrationExisting);
    }
  }, [hasSelectedIntegration, setSelectedIntegration, activeIntegrationExisting]);

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
    <Flex direction="column" align="center" gap="xl" flexGrow={1}>
      <Stack align="center" gap="md">
        <Heading as="h2">{t('Connect a repository')}</Heading>
        <Text variant="muted">
          {t('Link your source control for enhanced debugging features')}
        </Text>
      </Stack>

      <Stack gap="lg" width="100%" maxWidth="600px">
        {selectedIntegration ? (
          <ScmView />
        ) : (
          <ScmProviderPills providers={scmProviders} onInstall={handleInstall} />
        )}
      </Stack>

      <Flex gap="md" align="center">
        <Button onClick={() => onComplete()}>{t('Skip for now')}</Button>
        <Button
          priority="primary"
          onClick={() => onComplete()}
          disabled={!selectedRepository?.id}
        >
          {t('Continue')}
        </Button>
      </Flex>
    </Flex>
  );
}
