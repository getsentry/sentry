import {useCallback} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';

import {ConnectedView} from './components/scmConnectedView';
import {ProviderPills} from './components/scmProviderPills';
import type {StepProps} from './types';
import {useScmProviders} from './useScmProviders';

export function ScmConnect({onComplete}: StepProps) {
  const onboardingContext = useOnboardingContext();
  const {scmProviders, isPending, refetchIntegrations, activeIntegrationExisting} =
    useScmProviders();

  const effectiveIntegration =
    onboardingContext.selectedIntegration ?? activeIntegrationExisting;

  const handleInstall = useCallback(
    (data: Integration) => {
      onboardingContext.setSelectedIntegration(data);
      onboardingContext.setSelectedRepository(undefined);
      refetchIntegrations();
    },
    [onboardingContext, refetchIntegrations]
  );

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

      <Stack gap="lg" width="100%" maxWidth="600px">
        {effectiveIntegration ? (
          <ConnectedView
            integration={effectiveIntegration}
            selectedRepo={onboardingContext.selectedRepository ?? null}
            onSelectRepo={repo =>
              onboardingContext.setSelectedRepository(repo ?? undefined)
            }
          />
        ) : (
          <ProviderPills providers={scmProviders} onInstall={handleInstall} />
        )}
      </Stack>

      <Flex gap="md" align="center">
        <Button onClick={() => onComplete()}>{t('Skip for now')}</Button>
        <Button
          priority="primary"
          onClick={() => onComplete()}
          disabled={!onboardingContext.selectedRepository}
        >
          {t('Continue')}
        </Button>
      </Flex>
    </Flex>
  );
}
