import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {addRepository, migrateRepository} from 'sentry/actionCreators/integrations';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import {t} from 'sentry/locale';
import RepositoryStore from 'sentry/stores/repositoryStore';
import type {
  Integration,
  IntegrationRepository,
  Repository,
} from 'sentry/types/integrations';
import {fetchDataQuery, useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import useOrganization from 'sentry/utils/useOrganization';

interface IntegrationReposAddRepositoryProps {
  currentRepositories: Repository[];
  integration: Integration;
  onAddRepository: (repo: Repository) => void;
  onSearchError: (errorStatus: number | null | undefined) => void;
}

interface IntegrationRepoSearchResult {
  repos: IntegrationRepository[];
}

const defaultSearchResult: IntegrationRepoSearchResult = {repos: []};

export function IntegrationReposAddRepository({
  integration,
  currentRepositories,
  onSearchError,
  onAddRepository,
}: IntegrationReposAddRepositoryProps) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState<string>();
  const debouncedSearch = useDebouncedValue(search, 200);

  const query = useQuery({
    queryKey: [
      `/organizations/${organization.slug}/integrations/${integration.id}/repos/`,
      {method: 'GET', query: {search: debouncedSearch}},
    ] as const,
    queryFn: async context => {
      try {
        onSearchError(null);
        return await fetchDataQuery<IntegrationRepoSearchResult>(context);
      } catch (error) {
        onSearchError(error?.status);
        throw error;
      }
    },
    retry: 0,
    staleTime: 20_000,
    enabled: !!debouncedSearch,
  });

  const searchResult = query.data?.[0] ?? defaultSearchResult;

  const addRepo = async (selection: {value: string}) => {
    setAdding(true);

    const migratableRepo = currentRepositories.find(item => {
      if (!(selection.value && item.externalSlug)) {
        return false;
      }
      return selection.value === item.externalSlug;
    });

    let promise: Promise<Repository>;
    if (migratableRepo) {
      promise = migrateRepository(api, organization.slug, migratableRepo.id, integration);
    } else {
      promise = addRepository(api, organization.slug, selection.value, integration);
    }

    try {
      const repo = await promise;
      onAddRepository(repo);
      addSuccessMessage(t('Repository added'));
      RepositoryStore.resetRepositories();
    } catch (error) {
      addErrorMessage(t('Unable to add repository.'));
    } finally {
      setAdding(false);
    }
  };

  const dropdownItems = useMemo(() => {
    const repositories = new Set(
      currentRepositories.filter(item => item.integrationId).map(i => i.externalSlug)
    );
    const repositoryOptions = searchResult.repos.filter(
      repo => !repositories.has(repo.identifier)
    );
    return repositoryOptions.map(repo => ({
      searchKey: repo.name,
      value: repo.identifier,
      label: <RepoName>{repo.name}</RepoName>,
    }));
  }, [currentRepositories, searchResult]);

  if (
    !['github', 'gitlab'].includes(integration.provider.key) &&
    !organization.access.includes('org:integrations')
  ) {
    return (
      <DropdownButton
        disabled
        title={t(
          'You must be an organization owner, manager or admin to add repositories'
        )}
        isOpen={false}
        size="xs"
      >
        {t('Add Repository')}
      </DropdownButton>
    );
  }

  return (
    <DropdownWrapper>
      <DropdownAutoComplete
        items={dropdownItems}
        onSelect={addRepo}
        onChange={e => setSearch(e.target.value)}
        emptyMessage={t('Please enter a repository name')}
        noResultsMessage={t('No repositories found')}
        searchPlaceholder={t('Search Repositories')}
        busy={query.isFetching}
        alignMenu="right"
      >
        {({isOpen}) => (
          <DropdownButton isOpen={isOpen} size="xs" busy={adding}>
            {t('Add Repository')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    </DropdownWrapper>
  );
}

const DropdownWrapper = styled('div')`
  text-transform: none;
`;

const RepoName = styled('div')`
  font-weight: ${p => p.theme.fontWeightNormal};
`;
