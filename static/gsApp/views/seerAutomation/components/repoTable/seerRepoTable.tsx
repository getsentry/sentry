import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';
import {debounce, parseAsString, useQueryState} from 'nuqs';

import {LinkButton} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Grid, Stack} from '@sentry/scraps/layout';

import {organizationRepositoriesInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconAdd} from 'sentry/icons';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import type {RepositoryWithSettings} from 'sentry/types/integrations';
import type {Sort} from 'sentry/utils/discover/fields';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {useInfiniteQuery, useQueryClient} from 'sentry/utils/queryClient';
import parseAsSort from 'sentry/utils/url/parseAsSort';
import useOrganization from 'sentry/utils/useOrganization';

import SeerRepoTableHeader from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTableHeader';
import SeerRepoTableRow from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTableRow';
import {useBulkUpdateRepositorySettings} from 'getsentry/views/seerAutomation/onboarding/hooks/useBulkUpdateRepositorySettings';
import {getRepositoryWithSettingsQueryKey} from 'getsentry/views/seerAutomation/onboarding/hooks/useRepositoryWithSettings';

export default function SeerRepoTable() {
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const [searchTerm, setSearchTerm] = useQueryState(
    'query',
    parseAsString.withDefault('')
  );

  const [sort, setSort] = useQueryState(
    'sort',
    parseAsSort.withDefault({field: 'name', kind: 'asc'})
  );

  const queryOptions = organizationRepositoriesInfiniteOptions({
    organization,
    query: {per_page: 100, query: searchTerm, sort},
  });
  const {
    data: repositories,
    hasNextPage,
    isError,
    isPending,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    ...queryOptions,
    select: ({pages}) =>
      uniqBy(
        pages.flatMap(page => page.json),
        'externalId'
      )
        .filter(
          repository =>
            repository.externalId && isSupportedAutofixProvider(repository.provider)
        )
        .sort((a, b) => {
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
        }),
  });

  // Auto-fetch each page, one at a time
  useEffect(() => {
    if (!isError && !isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, isError, isFetchingNextPage]);

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

  if (isPending) {
    return (
      <RepoTable
        mutateRepositorySettings={mutateRepositorySettings}
        onSortClick={setSort}
        isLoading={isPending || isFetchingNextPage}
        isLoadingMore={false /* prevent redundant spinners */}
        repositories={[]}
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

  if (isError) {
    return (
      <RepoTable
        mutateRepositorySettings={mutateRepositorySettings}
        onSortClick={setSort}
        isLoading={isPending || isFetchingNextPage}
        isLoadingMore={hasNextPage || isFetchingNextPage}
        repositories={[]}
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
      hits={repositories.length}
      knownIds={repositories.map(repository => repository.id)}
      queryKey={queryOptions.queryKey}
    >
      <RepoTable
        mutateRepositorySettings={mutateRepositorySettings}
        onSortClick={setSort}
        isLoading={isPending || isFetchingNextPage}
        isLoadingMore={hasNextPage || isFetchingNextPage}
        repositories={repositories}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        sort={sort}
      >
        {repositories.length === 0 ? (
          <SimpleTable.Empty>
            {searchTerm
              ? tct('No repositories found matching [searchTerm]', {
                  searchTerm: <code>{searchTerm}</code>,
                })
              : t('No repositories found')}
          </SimpleTable.Empty>
        ) : (
          repositories.map(repository => (
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
  isLoading,
  isLoadingMore,
  mutateRepositorySettings,
  onSortClick,
  repositories,
  searchTerm,
  setSearchTerm,
  sort,
}: {
  children: React.ReactNode;
  isLoading: boolean;
  isLoadingMore: boolean;
  mutateRepositorySettings: ReturnType<typeof useBulkUpdateRepositorySettings>['mutate'];
  onSortClick: (sort: Sort) => void;
  repositories: RepositoryWithSettings[];
  searchTerm: string;
  setSearchTerm: ReturnType<typeof useQueryState<string>>[1];
  sort: Sort;
}) {
  const organization = useOrganization();
  const hasData = repositories.length > 0;
  return (
    <Stack gap="lg">
      <Grid
        minWidth="0"
        gap="md"
        columns={hasData ? '1fr max-content' : '1fr max-content max-content'}
      >
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

        {hasData ? null : <LoadingIndicator mini />}

        <LinkButton
          priority="primary"
          icon={<IconAdd />}
          to={{
            pathname: `/settings/${organization.slug}/integrations/`,
            query: {
              category: 'source code management',
            },
          }}
        >
          {t('Add Repository')}
        </LinkButton>
      </Grid>

      <SimpleTableWithColumns>
        <SeerRepoTableHeader
          mutateRepositorySettings={mutateRepositorySettings}
          onSortClick={onSortClick}
          disabled={isLoading}
          repositories={repositories}
          sort={sort}
        />
        {children}
        {isLoadingMore ? (
          <SimpleTable.Row key="loading-row">
            <SimpleTable.RowCell
              align="center"
              justify="center"
              style={{gridColumn: '1 / -1'}}
            >
              <LoadingIndicator mini />
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ) : null}
      </SimpleTableWithColumns>
    </Stack>
  );
}

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: max-content 1fr repeat(2, max-content);
`;
