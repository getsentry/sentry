import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {debounce, parseAsString, useQueryState} from 'nuqs';

import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Stack} from '@sentry/scraps/layout/stack';

import {useOrganizationRepositoriesWithSettings} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import type {RepositoryWithSettings} from 'sentry/types/integrations';
import type {Sort} from 'sentry/utils/discover/fields';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {useQueryClient, type ApiQueryKey} from 'sentry/utils/queryClient';
import {parseAsSort} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';

import SeerRepoTableHeader from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTableHeader';
import SeerRepoTableRow from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTableRow';
import {useBulkUpdateRepositorySettings} from 'getsentry/views/seerAutomation/onboarding/hooks/useBulkUpdateRepositorySettings';
import {getRepositoryWithSettingsQueryKey} from 'getsentry/views/seerAutomation/onboarding/hooks/useRepositoryWithSettings';

export default function SeerRepoTable() {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const {
    data: repositoriesWithSettings,
    error,
    isFetching,
  } = useOrganizationRepositoriesWithSettings();

  const supportedRepositories = useMemo(
    () =>
      repositoriesWithSettings.filter(repository =>
        isSupportedAutofixProvider(repository.provider)
      ),
    [repositoriesWithSettings]
  );

  const [mutationData, setMutations] = useState<Record<string, RepositoryWithSettings>>(
    {}
  );

  const {mutate: mutateRepositorySettings} = useBulkUpdateRepositorySettings({
    onSuccess: mutations => {
      setMutations(prev => {
        const updated = {...prev};
        mutations.forEach(mutation => {
          updated[mutation.id] = mutation;
        });
        return updated;
      });
    },
    onSettled: mutations => {
      (mutations ?? []).forEach(mutation => {
        queryClient.invalidateQueries({
          queryKey: getRepositoryWithSettingsQueryKey(organization, mutation.id),
        });
      });
    },
  });

  const [searchTerm, setSearchTerm] = useQueryState(
    'query',
    parseAsString.withDefault('')
  );

  const [sort, setSort] = useQueryState(
    'sort',
    parseAsSort.withDefault({field: 'name', kind: 'asc'})
  );

  const queryKey: ApiQueryKey = ['seer-repos', {query: {query: searchTerm, sort}}];

  const sortedRepositories = useMemo(() => {
    return supportedRepositories.toSorted((a, b) => {
      if (sort.field === 'name') {
        return sort.kind === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      // TODO: if we can bulk-fetch all the preferences, then it'll be easier to sort by fixes, pr creation, and repos
      // if (sort.field === 'fixes') {
      //   return a.slug.localeCompare(b.slug);
      // }
      // if (sort.field === 'pr_creation') {
      //   return a.platform.localeCompare(b.platform);
      // }
      // if (sort.field === 'repos') {
      //   return a.status.localeCompare(b.status);
      // }
      return 0;
    });
  }, [supportedRepositories, sort]);

  const filteredRepositories = useMemo(() => {
    const lowerCase = searchTerm?.toLowerCase() ?? '';
    if (lowerCase) {
      return sortedRepositories.filter(repository =>
        repository.name.toLowerCase().includes(lowerCase)
      );
    }
    return sortedRepositories;
  }, [sortedRepositories, searchTerm]);

  if (isFetching) {
    return (
      <RepoTable
        mutateRepositorySettings={mutateRepositorySettings}
        onSortClick={setSort}
        repositories={filteredRepositories}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sort={sort}
      >
        <SimpleTable.Empty>
          <LoadingIndicator />
        </SimpleTable.Empty>
      </RepoTable>
    );
  }

  if (error) {
    return (
      <RepoTable
        mutateRepositorySettings={mutateRepositorySettings}
        onSortClick={setSort}
        repositories={filteredRepositories}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sort={sort}
      >
        <SimpleTable.Empty>
          <LoadingError />
        </SimpleTable.Empty>
      </RepoTable>
    );
  }

  return (
    <ListItemCheckboxProvider
      hits={filteredRepositories.length}
      knownIds={filteredRepositories.map(repository => repository.id)}
      queryKey={queryKey}
    >
      <RepoTable
        mutateRepositorySettings={mutateRepositorySettings}
        onSortClick={setSort}
        repositories={filteredRepositories}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sort={sort}
      >
        {filteredRepositories.length === 0 ? (
          <SimpleTable.Empty>
            {searchTerm
              ? tct('No repositories found matching [searchTerm]', {
                  searchTerm: <code>{searchTerm}</code>,
                })
              : t('No repositories found')}
          </SimpleTable.Empty>
        ) : (
          filteredRepositories.map(repository => (
            <SeerRepoTableRow
              key={repository.id}
              mutateRepositorySettings={mutateRepositorySettings}
              mutationData={mutationData}
              repository={repository}
            />
          ))
        )}
      </RepoTable>
    </ListItemCheckboxProvider>
  );
}

function RepoTable({
  children,
  mutateRepositorySettings,
  onSortClick,
  repositories,
  searchTerm,
  setSearchTerm,
  sort,
}: {
  children: React.ReactNode;
  mutateRepositorySettings: ReturnType<typeof useBulkUpdateRepositorySettings>['mutate'];
  onSortClick: (sort: Sort) => void;
  repositories: RepositoryWithSettings[];
  searchTerm: string;
  setSearchTerm: ReturnType<typeof useQueryState<string>>[1];
  sort: Sort;
}) {
  return (
    <Stack gap="lg">
      <FiltersContainer>
        <InputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch />
          </InputGroup.LeadingItems>
          <InputGroup.Input
            size="md"
            placeholder={t('Search')}
            value={searchTerm ?? ''}
            onChange={e =>
              setSearchTerm(e.target.value, {limitUrlUpdates: debounce(125)})
            }
          />
        </InputGroup>
      </FiltersContainer>

      <SimpleTableWithColumns>
        <SeerRepoTableHeader
          mutateRepositorySettings={mutateRepositorySettings}
          onSortClick={onSortClick}
          repositories={repositories}
          sort={sort}
        />
        {children}
      </SimpleTableWithColumns>
    </Stack>
  );
}

const FiltersContainer = styled('div')`
  flex-grow: 1;
  min-width: 0;
`;

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: max-content 1fr repeat(2, max-content);
`;
