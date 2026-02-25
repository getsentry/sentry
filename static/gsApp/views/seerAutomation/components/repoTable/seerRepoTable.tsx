import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';
import uniqBy from 'lodash/uniqBy';
import {debounce, parseAsString, useQueryState} from 'nuqs';

import {LinkButton} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {organizationRepositoriesInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {IconAdd} from 'sentry/icons';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import type {RepositoryWithSettings} from 'sentry/types/integrations';
import {
  ListItemCheckboxProvider,
  useListItemCheckboxContext,
} from 'sentry/utils/list/useListItemCheckboxState';
import {useInfiniteQuery, useQueryClient} from 'sentry/utils/queryClient';
import parseAsSort from 'sentry/utils/url/parseAsSort';
import useOrganization from 'sentry/utils/useOrganization';

import SeerRepoTableHeader from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTableHeader';
import SeerRepoTableRow from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTableRow';
import {useBulkUpdateRepositorySettings} from 'getsentry/views/seerAutomation/onboarding/hooks/useBulkUpdateRepositorySettings';
import {getRepositoryWithSettingsQueryKey} from 'getsentry/views/seerAutomation/onboarding/hooks/useRepositoryWithSettings';

const GRID_COLUMNS = '40px 1fr 76px 150px';
const SELECTED_ROW_HEIGHT = 44;
const BOTTOM_PADDING = 24; // px gap between table bottom and viewport edge
const estimateSize = () => 60;

export default function SeerRepoTable() {
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

  const knownIds = useMemo(
    () => repositories?.map(repository => repository.id) ?? [],
    [repositories]
  );

  return (
    <ListItemCheckboxProvider
      hits={repositories?.length ?? 0}
      knownIds={knownIds}
      queryKey={queryOptions.queryKey}
    >
      <Stack gap="lg">
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
        <TablePanel>
          <SeerRepoTableHeader
            gridColumns={GRID_COLUMNS}
            mutateRepositorySettings={mutateRepositorySettings}
            onSortClick={setSort}
            isPending={isPending}
            isFetchingNextPage={isFetchingNextPage}
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
              mutationData={mutationData}
              repositories={repositories}
              scrollBodyRef={scrollBodyRef}
            />
          )}
        </TablePanel>
      </Stack>
    </ListItemCheckboxProvider>
  );
}

function VirtualizedRepoTable({
  hasNextPage,
  isFetchingNextPage,
  mutateRepositorySettings,
  mutationData,
  repositories,
  scrollBodyRef,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  mutateRepositorySettings: ReturnType<typeof useBulkUpdateRepositorySettings>['mutate'];
  mutationData: Record<string, RepositoryWithSettings>;
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
        minHeight: 0,
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
              mutationData={mutationData}
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
