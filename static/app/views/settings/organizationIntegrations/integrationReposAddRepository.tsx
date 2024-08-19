import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

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
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface IntegrationReposAddRepositoryProps {
  currentRepositories: Repository[];
  integration: Integration;
  onAddRepository: (repo: Repository) => void;
  onSearchError: (errorStatus: number | null | undefined) => void;
}

interface IntegrationRepoSearchResult {
  repos: IntegrationRepository[];
  searchable: boolean;
}

export function IntegrationReposAddRepository({
  integration,
  currentRepositories,
  onSearchError,
  onAddRepository,
}: IntegrationReposAddRepositoryProps) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const [dropdownBusy, setDropdownBusy] = useState(true);
  const [adding, setAdding] = useState(false);
  const [searchResult, setSearchResult] = useState<IntegrationRepoSearchResult>({
    repos: [],
    searchable: false,
  });

  const searchRepositoriesRequest = useCallback(
    async (searchQuery?: string) => {
      try {
        const data: IntegrationRepoSearchResult = await api.requestPromise(
          `/organizations/${organization.slug}/integrations/${integration.id}/repos/`,
          {method: 'GET', query: {search: searchQuery}}
        );
        setSearchResult(data);
      } catch (error) {
        onSearchError(error?.status);
      }
      setDropdownBusy(false);
    },
    [api, integration, organization, onSearchError]
  );

  useEffect(() => {
    // Load the repositories before the dropdown is opened
    searchRepositoriesRequest();
  }, [searchRepositoriesRequest]);

  const debouncedSearchRepositoriesRequest = useMemo(
    () => debounce(query => searchRepositoriesRequest(query), 200),
    [searchRepositoriesRequest]
  );

  const handleSearchRepositories = useCallback(
    (e?: React.ChangeEvent<HTMLInputElement>) => {
      setDropdownBusy(true);
      onSearchError(null);
      debouncedSearchRepositoriesRequest(e?.target.value);
    },
    [debouncedSearchRepositoriesRequest, onSearchError]
  );

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
        onChange={searchResult.searchable ? handleSearchRepositories : undefined}
        emptyMessage={t('No repositories available')}
        noResultsMessage={t('No repositories found')}
        searchPlaceholder={t('Search Repositories')}
        busy={dropdownBusy}
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
