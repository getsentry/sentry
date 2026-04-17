import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';
import uniqBy from 'lodash/uniqBy';
import {debounce, parseAsString, useQueryState} from 'nuqs';

import {LinkButton} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  isSeerSupportedProvider,
  useSeerSupportedProviderIds,
} from 'sentry/components/events/autofix/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {useBulkUpdateRepositorySettings} from 'sentry/components/repositories/useBulkUpdateRepositorySettings';
import {getRepositoryWithSettingsQueryKey} from 'sentry/components/repositories/useRepositoryWithSettings';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import type {RepositoryWithSettings} from 'sentry/types/integrations';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {getSeerOnboardingCheckQueryOptions} from 'sentry/utils/getSeerOnboardingCheckQueryOptions';
import {
  ListItemCheckboxProvider,
  useListItemCheckboxContext,
} from 'sentry/utils/list/useListItemCheckboxState';
import {useInfiniteQuery, useQueryClient} from 'sentry/utils/queryClient';
import {organizationRepositoriesWithSettingsInfiniteOptions} from 'sentry/utils/repositories/repoQueryOptions';
import {parseAsSort} from 'sentry/utils/url/parseAsSort';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SeerRepoTableHeader} from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTableHeader';
import {SeerRepoTableRow} from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTableRow';

const GRID_COLUMNS = '40px 1fr 138px 150px';
const SELECTED_ROW_HEIGHT = 44;
const BOTTOM_PADDING = 24; // px gap between table bottom and viewport edge
const estimateSize = () => 68;

export function SeerRepoTable() {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const scrollBodyRef = useRef<HTMLDivElement>(null);

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
      <Grid
        minWidth="0"
        gap="md"
        columns={isFetchingNextPage ? '1fr max-content max-content' : '1fr max-content'}
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

        {isFetchingNextPage ? <LoadingIndicator mini /> : null}

        <LinkButton
          priority="primary"
          size="sm"
          to={`/settings/${organization.slug}/repos/`}
          icon={<IconOpen />}
        >
          {t('Manage Repositories')}
        </LinkButton>
      </Grid>
      <ListItemCheckboxProvider
        hits={repositories?.length ?? 0}
        knownIds={knownIds}
        queryKey={queryOptions.queryKey}
      >
        <TablePanel>
          <SeerRepoTableHeader
            gridColumns={GRID_COLUMNS}
            isFetchingNextPage={isFetchingNextPage}
            isPending={isPending}
            mutateRepositorySettings={mutateRepositorySettingsAsync}
            onSortClick={setSort}
            repositories={repositories ?? []}
            sort={sort}
          />
          {isPending ? (
            <Flex justify="center" align="center" padding="xl" style={{minHeight: 200}}>
              <LoadingIndicator />
            </Flex>
          ) : isError ? (
            <Flex justify="center" align="center" padding="xl" style={{minHeight: 200}}>
              <LoadingError />
            </Flex>
          ) : repositories.length === 0 ? (
            <Flex justify="center" align="center" padding="xl" style={{minHeight: 200}}>
              <Text variant="muted" size="md">
                {searchTerm
                  ? tct('No repositories found matching [searchTerm]', {
                      searchTerm: <code>{searchTerm}</code>,
                    })
                  : t('No repositories found')}
              </Text>
            </Flex>
          ) : (
            <VirtualizedRepoTable
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              mutateRepositorySettings={mutateRepositorySettings}
              repositories={repositories}
              scrollBodyRef={scrollBodyRef}
            />
          )}
        </TablePanel>
      </ListItemCheckboxProvider>
    </Fragment>
  );
}

function VirtualizedRepoTable({
  hasNextPage,
  isFetchingNextPage,
  mutateRepositorySettings,
  repositories,
  scrollBodyRef,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  mutateRepositorySettings: ReturnType<typeof useBulkUpdateRepositorySettings>['mutate'];
  repositories: RepositoryWithSettings[];
  scrollBodyRef: React.RefObject<HTMLDivElement | null>;
}) {
  const virtualizer = useVirtualizer({
    count: repositories?.length ?? 0,
    getScrollElement: () => scrollBodyRef.current,
    estimateSize,
  });

  const [scrollBodyHeight, setScrollBodyHeight] = useState<number | undefined>(undefined);

  const setScrollBodyRef = useCallback(
    (el: HTMLDivElement | null) => {
      scrollBodyRef.current = el;
      if (el) {
        const measure = () => {
          const top = el.getBoundingClientRect().top;
          setScrollBodyHeight(Math.round(top + BOTTOM_PADDING));
        };
        requestAnimationFrame(measure);
      }
    },
    [scrollBodyRef]
  );

  const {isAnySelected} = useListItemCheckboxContext();

  const maxHeight = scrollBodyHeight
    ? isAnySelected
      ? SELECTED_ROW_HEIGHT + scrollBodyHeight
      : scrollBodyHeight
    : undefined;
  return (
    <ScrollableBody
      ref={setScrollBodyRef}
      style={{
        minHeight: Math.min(10, repositories.length) * estimateSize(),
        maxHeight: maxHeight ? `calc(100vh - ${Math.round(maxHeight)}px)` : undefined,
      }}
    >
      <VirtualInner style={{height: virtualizer.getTotalSize()}}>
        {virtualizer.getVirtualItems().map(virtualItem => {
          const repository = repositories[virtualItem.index];
          if (!repository) {
            return null;
          }
          return (
            <SeerRepoTableRow
              key={repository.id}
              gridColumns={GRID_COLUMNS}
              style={{transform: `translateY(${virtualItem.start}px)`}}
              mutateRepositorySettings={mutateRepositorySettings}
              repository={repository}
            />
          );
        })}
      </VirtualInner>
      {hasNextPage || isFetchingNextPage ? (
        <StickyLoadingRow align="center" justify="center" padding="md" borderTop="muted">
          <LoadingIndicator mini />
        </StickyLoadingRow>
      ) : null}
    </ScrollableBody>
  );
}

const TablePanel = styled(Panel)`
  margin: 0;
  width: 100%;
  overflow: hidden;
`;

const ScrollableBody = styled('div')`
  position: relative;
  overflow-y: auto;
`;

const VirtualInner = styled('div')`
  position: relative;
  width: 100%;
`;

const StickyLoadingRow = styled(Flex)`
  position: sticky;
  bottom: 0;
  background: ${p => p.theme.tokens.background.primary};
`;
