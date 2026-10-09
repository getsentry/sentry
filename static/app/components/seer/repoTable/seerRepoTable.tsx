import {Fragment, useCallback, useMemo} from 'react';
import {useInfiniteQuery, useQueryClient} from '@tanstack/react-query';
import uniqBy from 'lodash/uniqBy';
import {debounce, parseAsString, useQueryState} from 'nuqs';

import {LinkButton} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Grid, Stack} from '@sentry/scraps/layout';
import {useTableElement, type TableColumnConfig} from '@sentry/scraps/table';

import {
  isSeerSupportedProvider,
  useSeerSupportedProviderIds,
} from 'sentry/components/events/autofix/utils';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useBulkUpdateRepositorySettings} from 'sentry/components/repositories/useBulkUpdateRepositorySettings';
import {getRepositoryWithSettingsQueryKey} from 'sentry/components/repositories/useRepositoryWithSettings';
import {SeerRepoTableHeader} from 'sentry/components/seer/repoTable/seerRepoTableHeader';
import {SeerRepoTableRow} from 'sentry/components/seer/repoTable/seerRepoTableRow';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {useVirtualRows} from 'sentry/components/tables/useVirtualRows';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import type {RepositoryWithSettings} from 'sentry/types/integrations';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getSeerOnboardingCheckQueryOptions} from 'sentry/utils/getSeerOnboardingCheckQueryOptions';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {organizationRepositoriesWithSettingsInfiniteOptions} from 'sentry/utils/repositories/repoQueryOptions';
import {parseAsSort} from 'sentry/utils/url/parseAsSort';
import {useOrganization} from 'sentry/utils/useOrganization';

const COLUMNS: TableColumnConfig[] = [
  {key: 'select', width: 'max-content'},
  {key: 'name', width: 'minmax(0, 1fr)'},
  {key: 'code_review', width: '138px'},
  {key: 'trigger', width: '150px'},
];

const estimateSize = () => 68;

export function SeerRepoTable() {
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

  const supportedProviderIds = useSeerSupportedProviderIds();

  const queryOptions = organizationRepositoriesWithSettingsInfiniteOptions({
    organization,
    query: {per_page: 100, query: searchTerm, sort},
  });
  const result = useInfiniteQuery({
    ...queryOptions,
    select: ({pages}) =>
      uniqBy(
        pages.flatMap(page => page.json),
        'externalId'
      )
        .filter(
          repository =>
            repository.externalId &&
            isSeerSupportedProvider(repository.provider, supportedProviderIds)
        )
        .sort((a, b): number => {
          if (sort.field === 'name') {
            return sort.kind === 'asc'
              ? a.name.localeCompare(b.name)
              : b.name.localeCompare(a.name);
          }

          if (sort.field === 'enabled') {
            if (
              (a.settings?.enabledCodeReview ?? false) ===
              (b.settings?.enabledCodeReview ?? false)
            ) {
              return sort.kind === 'asc'
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name);
            }
            return sort.kind === 'asc'
              ? a.settings?.enabledCodeReview
                ? -1
                : 1
              : b.settings?.enabledCodeReview
                ? -1
                : 1;
          }

          if (sort.field === 'triggers') {
            if (
              a.settings?.codeReviewTriggers?.length ===
              b.settings?.codeReviewTriggers?.length
            ) {
              return sort.kind === 'asc'
                ? (a.settings?.codeReviewTriggers[0]?.localeCompare(
                    b.settings?.codeReviewTriggers[0] ?? ''
                  ) ?? 0)
                : (b.settings?.codeReviewTriggers[0]?.localeCompare(
                    a.settings?.codeReviewTriggers[0] ?? ''
                  ) ?? 0);
            }
            return sort.kind === 'asc'
              ? (a.settings?.codeReviewTriggers?.length ?? 0) -
                  (b.settings?.codeReviewTriggers?.length ?? 0)
              : (b.settings?.codeReviewTriggers?.length ?? 0) -
                  (a.settings?.codeReviewTriggers?.length ?? 0);
          }
          return 0;
        }),
  });

  useFetchAllPages({result});

  const {
    data: repositories,
    hasNextPage,
    isError,
    isPending,
    isFetchingNextPage,
  } = result;
  const isFetchingAllPages = !isError && (hasNextPage || isFetchingNextPage);

  const {mutate: mutateRepositorySettings, mutateAsync: mutateRepositorySettingsAsync} =
    useBulkUpdateRepositorySettings({
      onSuccess: mutations => {
        const mutationMap = new Map(mutations.map(m => [m.id, m]));
        queryClient.setQueryData(queryOptions.queryKey, prev => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            pages: prev.pages.map(page => ({
              ...page,
              json: page.json.map(repo => mutationMap.get(repo.id) ?? repo),
            })),
          };
        });
      },
      onSettled: mutations => {
        queryClient.invalidateQueries({
          queryKey: getSeerOnboardingCheckQueryOptions({organization}).queryKey,
        });
        (mutations ?? []).forEach(mutation => {
          queryClient.invalidateQueries({
            queryKey: getRepositoryWithSettingsQueryKey(organization, mutation.id),
          });
        });
      },
    });

  const knownIds = useMemo(
    () => repositories?.map(repository => repository.id) ?? [],
    [repositories]
  );

  return (
    <Fragment>
      <Stack>
        <Grid
          minWidth="0"
          gap="md"
          columns={isFetchingAllPages ? '1fr max-content max-content' : '1fr max-content'}
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

          {isFetchingAllPages ? <LoadingIndicator mini /> : null}

          <LinkButton
            variant="primary"
            size="sm"
            to={`/settings/${organization.slug}/repos/`}
            icon={<IconOpen />}
          >
            {t('Manage Repositories')}
          </LinkButton>
        </Grid>
      </Stack>
      <ListItemCheckboxProvider
        hits={repositories?.length ?? 0}
        knownIds={knownIds}
        endpointOptions={safeParseQueryKey(queryOptions.queryKey)?.options}
      >
        <SimpleTable
          aria-label={t('Repositories')}
          columns={COLUMNS}
          customSections
          maxHeight="100%"
          scrollable
        >
          <SeerRepoTableHeader
            isFetchingNextPage={isFetchingAllPages}
            isPending={isPending}
            mutateRepositorySettings={mutateRepositorySettingsAsync}
            onSortClick={setSort}
            repositories={repositories ?? []}
            sort={sort}
          />
          {isPending ? (
            <SimpleTable.Body>
              <SimpleTable.Loading />
            </SimpleTable.Body>
          ) : isError ? (
            <SimpleTable.Body>
              <SimpleTable.Error />
            </SimpleTable.Body>
          ) : repositories.length === 0 ? (
            <SimpleTable.Body>
              <SimpleTable.Empty>
                {searchTerm
                  ? tct('No repositories found matching [searchTerm]', {
                      searchTerm: <code>{searchTerm}</code>,
                    })
                  : t('No repositories found')}
              </SimpleTable.Empty>
            </SimpleTable.Body>
          ) : (
            <VirtualizedRepoTableBody
              mutateRepositorySettings={mutateRepositorySettings}
              repositories={repositories}
            />
          )}
        </SimpleTable>
      </ListItemCheckboxProvider>
    </Fragment>
  );
}

function VirtualizedRepoTableBody({
  mutateRepositorySettings,
  repositories,
}: {
  mutateRepositorySettings: ReturnType<typeof useBulkUpdateRepositorySettings>['mutate'];
  repositories: RepositoryWithSettings[];
}) {
  const tableRef = useTableElement();

  const getItemKey = useCallback(
    (index: number) => repositories[index]?.id ?? index,
    [repositories]
  );

  const {paddingBottom, paddingTop, virtualItems, virtualizer} = useVirtualRows({
    count: repositories.length,
    estimateSize,
    getItemKey,
    getScrollElement: () => tableRef.current,
  });

  return (
    <SimpleTable.Body style={{paddingBottom, paddingTop}}>
      {virtualItems.map(virtualItem => {
        const repository = repositories[virtualItem.index];
        if (!repository) {
          return null;
        }
        return (
          <SeerRepoTableRow
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            mutateRepositorySettings={mutateRepositorySettings}
            repository={repository}
          />
        );
      })}
    </SimpleTable.Body>
  );
}
