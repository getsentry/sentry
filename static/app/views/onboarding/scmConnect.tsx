import {useCallback} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ScmProviderPills} from './components/scmProviderPills';
import {ScmRepoSelector} from './components/scmRepoSelector';
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

  // Derive integration from explicit selection, falling back to existing
  const effectiveIntegration = selectedIntegration ?? activeIntegrationExisting;

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
        {effectiveIntegration ? (
          <Stack gap="lg">
            <Flex align="center" justify="between">
              <Flex align="center" gap="sm">
                <IconCheckmark variant="success" size="sm" />
                <Text bold variant="success">
                  {t(
                    'Connected to %s',
                    effectiveIntegration.domainName || effectiveIntegration.provider.name
                  )}
                </Text>
              </Flex>
              <Link to={normalizeUrl(`/settings/${organization.slug}/integrations/`)}>
                {t('Manage in Settings')}
              </Link>
            </Flex>
            <ScmRepoSelector integration={effectiveIntegration} />
          </Stack>
        ) : (
          <ScmProviderPills providers={scmProviders} onInstall={handleInstall} />
        )}
      </Stack>

      <Flex gap="md" align="center">
        <Button onClick={() => onComplete()}>{t('Skip for now')}</Button>
        <Button
          priority="primary"
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
