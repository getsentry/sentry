import {useCallback, useMemo, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import Access from 'sentry/components/acl/access';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {IconCheckmark, IconClose} from 'sentry/icons';
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
        {genSkipOnboardingLink()}
        <Button priority="primary" onClick={handleContinue}>
          {t('Continue')}
        </Button>
      </Flex>
    </Flex>
  );
}

interface ProviderPillsProps {
  integrations: Integration[];
  onInstall: (data: Integration) => void;
  onSelect: (installation: Integration) => void;
  providers: IntegrationProvider[];
}

function ProviderPills({
  providers,
  integrations,
  onInstall,
  onSelect,
}: ProviderPillsProps) {
  const organization = useOrganization();

  return (
    <Flex gap="md" wrap="wrap" justify="center">
      {providers.map(provider => {
        const installation = integrations.find(i => i.provider.key === provider.key);

        if (installation) {
          return (
            <Button
              key={provider.key}
              size="sm"
              icon={getIntegrationIcon(provider.key, 'sm')}
              onClick={() => onSelect(installation)}
            >
              {provider.name}
            </Button>
          );
        }

        return (
          <IntegrationContext
            key={provider.key}
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
                    icon: getIntegrationIcon(provider.key, 'sm'),
                    buttonText: provider.name,
                  }}
                />
              )}
            </Access>
          </IntegrationContext>
        );
      })}
    </Flex>
  );
}

interface ConnectedViewProps {
  integration: Integration;
  onAddRepo: (repo: IntegrationRepository) => void;
  onDisconnect: () => void;
  onRemoveRepo: (identifier: string) => void;
  selectedRepos: IntegrationRepository[];
}

function ConnectedView({
  integration,
  selectedRepos,
  onDisconnect,
  onAddRepo,
  onRemoveRepo,
}: ConnectedViewProps) {
  return (
    <Stack gap="lg">
      <Flex align="center" justify="between">
        <Flex align="center" gap="sm">
          <IconCheckmark variant="success" size="sm" />
          <Text bold variant="success">
            {t('Connected to %s', integration.domainName ?? integration.provider.name)}
          </Text>
        </Flex>
        <Button
          size="sm"
          priority="link"
          icon={<IconClose size="xs" />}
          onClick={onDisconnect}
        >
          {t('Disconnect')}
        </Button>
      </Flex>
      <RepoSelector
        integration={integration}
        selectedRepos={selectedRepos}
        onAddRepo={onAddRepo}
        onRemoveRepo={onRemoveRepo}
      />
    </Stack>
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
    <Stack gap="md">
      <CompactSelect
        menuWidth="100%"
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
            {selectedRepos.length > 0
              ? t('%d selected', selectedRepos.length)
              : t('Search repositories')}
          </OverlayTrigger.Button>
        )}
      />
      {selectedRepos.length > 0 && (
        <Stack gap="sm">
          {selectedRepos.map(repo => (
            <Flex key={repo.identifier} align="center" gap="sm">
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
          ))}
        </Stack>
      )}
    </Stack>
  );
}
