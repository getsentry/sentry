import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import Access from 'sentry/components/acl/access';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {IconAdd, IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  Integration,
  IntegrationProvider,
  IntegrationRepository,
} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {fetchDataQuery, useQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IntegrationButton} from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

import type {StepProps} from './types';
import {useScmProviders} from './useScmProviders';

interface RepoSearchResult {
  repos: IntegrationRepository[];
}

export function ScmConnect({onComplete, genSkipOnboardingLink}: StepProps) {
  const onboardingContext = useOnboardingContext();
  const {scmProviders, scmIntegrations, isPending, refetchIntegrations} =
    useScmProviders();

  const [activeIntegration, setActiveIntegration] = useState<Integration | null>(null);
  const [selectedRepos, setSelectedRepos] = useState<IntegrationRepository[]>([]);

  // After integrations refetch, auto-select the first connected one if none active
  const effectiveIntegration =
    activeIntegration ?? (scmIntegrations.length > 0 ? scmIntegrations[0]! : null);

  const handleInstall = useCallback(
    (_data: Integration) => {
      refetchIntegrations();
    },
    [refetchIntegrations]
  );

  const handleContinue = useCallback(() => {
    if (effectiveIntegration) {
      onboardingContext.setSelectedIntegration(effectiveIntegration);
      if (selectedRepos.length > 0) {
        // Store repo identifiers for use in later steps
        onboardingContext.setSelectedRepositories(
          selectedRepos.map(repo => ({
            id: '',
            externalId: repo.identifier,
            name: repo.identifier,
            externalSlug: repo.identifier,
            url: '',
            provider: {
              id: effectiveIntegration.provider.key,
              name: effectiveIntegration.provider.name,
            },
            status: RepositoryStatus.ACTIVE,
            dateCreated: '',
            integrationId: effectiveIntegration.id,
          }))
        );
      }
    }
    onComplete();
  }, [effectiveIntegration, selectedRepos, onboardingContext, onComplete]);

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
        <Heading as="h2">{t('Connect your repository')}</Heading>
        <Text size="lg" variant="muted">
          {t(
            'Link your source code management tool to automatically detect platforms and set up your project.'
          )}
        </Text>
      </Stack>

      <ProviderGrid>
        {scmProviders.map(provider => {
          const installation = scmIntegrations.find(i => i.provider.key === provider.key);
          const isConnected = Boolean(installation);
          const isActive = effectiveIntegration?.provider.key === provider.key;

          return (
            <ProviderCard
              key={provider.key}
              provider={provider}
              installation={installation}
              isConnected={isConnected}
              isActive={isActive}
              onInstall={handleInstall}
              onSelect={() => {
                if (installation) {
                  setActiveIntegration(installation);
                  setSelectedRepos([]);
                }
              }}
            />
          );
        })}
      </ProviderGrid>

      {effectiveIntegration && (
        <RepoSelector
          integration={effectiveIntegration}
          selectedRepos={selectedRepos}
          onAddRepo={addRepo}
          onRemoveRepo={removeRepo}
        />
      )}

      <Flex gap="md" align="center">
        <Button
          priority="primary"
          onClick={handleContinue}
          disabled={scmIntegrations.length === 0}
        >
          {t('Continue')}
        </Button>
        {genSkipOnboardingLink()}
      </Flex>
    </Flex>
  );
}

interface ProviderCardProps {
  isActive: boolean;
  isConnected: boolean;
  onInstall: (data: Integration) => void;
  onSelect: () => void;
  provider: IntegrationProvider;
  installation?: Integration;
}

function ProviderCard({
  provider,
  installation,
  isConnected,
  isActive,
  onInstall,
  onSelect,
}: ProviderCardProps) {
  const organization = useOrganization();

  if (isConnected) {
    return (
      <StyledContainer
        border={isActive ? 'accent' : 'primary'}
        padding="lg"
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            onSelect();
          }
        }}
      >
        <Flex align="center" gap="md">
          {getIntegrationIcon(provider.key)}
          <Stack gap="xs" flexGrow={1}>
            <Text bold>{provider.name}</Text>
            <Text size="sm" variant="muted">
              {installation?.domainName ?? t('Connected')}
            </Text>
          </Stack>
          <IconCheckmark variant="success" />
        </Flex>
      </StyledContainer>
    );
  }

  return (
    <Container border="primary" padding="lg">
      <Flex align="center" gap="md">
        {getIntegrationIcon(provider.key)}
        <Flex flexGrow={1}>
          <Text bold>{provider.name}</Text>
        </Flex>
        <IntegrationContext
          value={{
            provider,
            type: 'first_party',
            installStatus: 'Not Installed',
            analyticsParams: {
              view: 'onboarding',
              already_installed: false,
            },
          }}
        >
          <Access access={['org:integrations']} organization={organization}>
            {({hasAccess}) => (
              <IntegrationButton
                userHasAccess={hasAccess}
                onAddIntegration={onInstall}
                onExternalClick={() => {}}
                buttonProps={{
                  size: 'sm',
                  icon: <IconAdd />,
                  buttonText: t('Connect'),
                }}
              />
            )}
          </Access>
        </IntegrationContext>
      </Flex>
    </Container>
  );
}

interface RepoSelectorProps {
  integration: Integration;
  onAddRepo: (repo: IntegrationRepository) => void;
  onRemoveRepo: (identifier: string) => void;
  selectedRepos: IntegrationRepository[];
}

function RepoSelector({
  integration,
  selectedRepos,
  onAddRepo,
  onRemoveRepo,
}: RepoSelectorProps) {
  const organization = useOrganization();
  const [search, setSearch] = useState<string>();
  const debouncedSearch = useDebouncedValue(search, 200);

  const query = useQuery({
    queryKey: [
      getApiUrl(
        `/organizations/$organizationIdOrSlug/integrations/$integrationId/repos/`,
        {
          path: {
            organizationIdOrSlug: organization.slug,
            integrationId: integration.id,
          },
        }
      ),
      {method: 'GET', query: {search: debouncedSearch}},
    ] as const,
    queryFn: async context => {
      return fetchDataQuery<RepoSearchResult>(context);
    },
    retry: 0,
    staleTime: 20_000,
    placeholderData: previousData => (debouncedSearch ? previousData : undefined),
    enabled: !!debouncedSearch,
  });

  const searchResult = useMemo(() => query.data?.[0] ?? {repos: []}, [query.data]);

  const selectedIdentifiers = useMemo(
    () => new Set(selectedRepos.map(r => r.identifier)),
    [selectedRepos]
  );

  const dropdownItems = useMemo(() => {
    return searchResult.repos.map(repo => ({
      value: repo.identifier,
      label: selectedIdentifiers.has(repo.identifier)
        ? `${repo.name} (Selected)`
        : repo.name,
      textValue: repo.name,
      disabled: selectedIdentifiers.has(repo.identifier),
    }));
  }, [searchResult, selectedIdentifiers]);

  return (
    <Stack gap="md" style={{width: '100%', maxWidth: 500}}>
      <Text bold>{t('Select repositories (optional)')}</Text>
      <CompactSelect
        menuWidth={400}
        disabled={false}
        options={dropdownItems}
        onChange={selection => {
          const repo = searchResult.repos.find(r => r.identifier === selection.value);
          if (repo) {
            onAddRepo(repo);
          }
        }}
        value={undefined}
        menuTitle={t('Repositories')}
        emptyMessage={
          query.isFetching
            ? t('Searching\u2026')
            : debouncedSearch
              ? t('No repositories found.')
              : t('Type to search repositories')
        }
        search={{
          placeholder: t('Search repositories'),
          filter: false,
          onChange: setSearch,
        }}
        loading={query.isFetching}
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps}>
            {t('Search and add repositories')}
          </OverlayTrigger.Button>
        )}
      />
      {selectedRepos.length > 0 && (
        <Stack gap="sm">
          {selectedRepos.map(repo => (
            <Container key={repo.identifier} border="primary" padding="sm md">
              <Flex align="center" gap="sm">
                <Flex flexGrow={1}>
                  <Text size="sm">{repo.name}</Text>
                </Flex>
                <Button
                  size="zero"
                  priority="link"
                  icon={<IconClose size="xs" />}
                  aria-label={t('Remove %s', repo.name)}
                  onClick={() => onRemoveRepo(repo.identifier)}
                />
              </Flex>
            </Container>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

const ProviderGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: ${p => p.theme.space.md};
  width: 100%;
  max-width: 600px;
`;

const StyledContainer = styled(Container)`
  cursor: pointer;

  &:hover {
    border-color: ${p => p.theme.tokens.border.accent};
  }
`;
