import {useCallback, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {t} from 'sentry/locale';
import type {
  Integration,
  IntegrationRepository,
  Repository,
} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';

import {ConnectedView} from './components/scmConnectedView';
import {ProviderPills} from './components/scmProviderPills';
import type {StepProps} from './types';
import {useScmProviders} from './useScmProviders';

/**
 * Convert context-stored Repository[] back to IntegrationRepository[] so the
 * RepoSelector can display previously selected repos on mount.
 */
function contextReposToIntegrationRepos(repos?: Repository[]): IntegrationRepository[] {
  if (!repos) {
    return [];
  }
  return repos.map(r => ({
    identifier: r.externalSlug || r.name,
    name: r.name,
    isInstalled: false,
  }));
}

export function ScmConnect({onComplete}: StepProps) {
  const onboardingContext = useOnboardingContext();
  const {scmProviders, scmIntegrations, isPending, refetchIntegrations} =
    useScmProviders();

  const [activeIntegration, setActiveIntegration] = useState<Integration | null>(
    () => onboardingContext.selectedIntegration ?? null
  );
  const [selectedRepos, setSelectedRepos] = useState<IntegrationRepository[]>(() =>
    contextReposToIntegrationRepos(onboardingContext.selectedRepositories)
  );
  const [hasAutoSelected, setHasAutoSelected] = useState(
    () => !!onboardingContext.selectedIntegration
  );

  // Auto-select an existing SCM integration so returning users see the
  // connected view instead of the provider pills.
  if (
    !hasAutoSelected &&
    !isPending &&
    scmIntegrations.length > 0 &&
    !activeIntegration
  ) {
    setActiveIntegration(scmIntegrations[0]!);
    setHasAutoSelected(true);
  }

  const handleInstall = useCallback(
    (data: Integration) => {
      setActiveIntegration(data);
      setSelectedRepos([]);
      refetchIntegrations();
    },
    [refetchIntegrations]
  );

  const handleDisconnect = useCallback(() => {
    setActiveIntegration(null);
    setSelectedRepos([]);
  }, []);

  const handleSelectProvider = useCallback((installation: Integration) => {
    setActiveIntegration(installation);
    setSelectedRepos([]);
  }, []);

  const handleContinue = useCallback(() => {
    if (activeIntegration) {
      onboardingContext.setSelectedIntegration(activeIntegration);
      if (selectedRepos.length > 0) {
        onboardingContext.setSelectedRepositories(
          selectedRepos.map(repo => ({
            id: '',
            externalId: repo.identifier,
            name: repo.identifier,
            externalSlug: repo.identifier,
            url: '',
            provider: {
              id: activeIntegration.provider.key,
              name: activeIntegration.provider.name,
            },
            status: RepositoryStatus.ACTIVE,
            dateCreated: '',
            integrationId: activeIntegration.id,
          }))
        );
      }
    }
    onComplete();
  }, [activeIntegration, selectedRepos, onboardingContext, onComplete]);

  const addRepo = useCallback((repo: IntegrationRepository) => {
    setSelectedRepos(prev => {
      if (prev.some(r => r.identifier === repo.identifier)) {
        return prev;
      }
      return [...prev, repo];
    });
  }, []);

  const removeRepo = useCallback((identifier: string) => {
    setSelectedRepos(prev => prev.filter(r => r.identifier !== identifier));
  }, []);

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
            selectedRepos={selectedRepos}
            onDisconnect={handleDisconnect}
            onAddRepo={addRepo}
            onRemoveRepo={removeRepo}
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
