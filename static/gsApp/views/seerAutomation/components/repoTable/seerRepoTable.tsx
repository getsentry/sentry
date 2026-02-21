import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';
import uniqBy from 'lodash/uniqBy';
import {debounce, parseAsString, useQueryState} from 'nuqs';

import {LinkButton} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';

import {organizationRepositoriesInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {IconAdd} from 'sentry/icons';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import type {RepositoryWithSettings} from 'sentry/types/integrations';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {useInfiniteQuery, useQueryClient} from 'sentry/utils/queryClient';
import parseAsSort from 'sentry/utils/url/parseAsSort';
import useOrganization from 'sentry/utils/useOrganization';

import SeerRepoTableHeader from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTableHeader';
import SeerRepoTableRow from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTableRow';
import {useBulkUpdateRepositorySettings} from 'getsentry/views/seerAutomation/onboarding/hooks/useBulkUpdateRepositorySettings';
import {getRepositoryWithSettingsQueryKey} from 'getsentry/views/seerAutomation/onboarding/hooks/useRepositoryWithSettings';

const GRID_COLUMNS = '40px 1fr 76px 150px';
const BOTTOM_PADDING = 24; // px gap between table bottom and viewport edge
const estimateSize = () => 60;

export default function SeerRepoTable() {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollBodyHeight, setScrollBodyHeight] = useState<string | undefined>(undefined);

  useLayoutEffect(() => {
    const update = () => {
      if (parentRef.current) {
        const top = parentRef.current.getBoundingClientRect().top;
        setScrollBodyHeight(`calc(100vh - ${top + BOTTOM_PADDING}px)`);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

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
        'id'
      )
        .filter(repository => isSupportedAutofixProvider(repository.provider))
        .toSorted((a, b) => {
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
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, isFetchingNextPage]);

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

  const virtualizer = useVirtualizer({
    count: repositories?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize,
  });

  const hits = repositories?.length ?? 0;
  const hasData = hits > 0;

  return (
    <ListItemCheckboxProvider
      hits={repositories?.length ?? 0}
      knownIds={repositories?.map(repository => repository.id) ?? []}
      queryKey={queryOptions.queryKey}
    >
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
              disabled={!hasData}
              placeholder={t('Search')}
              value={searchTerm ?? ''}
              onChange={e =>
                setSearchTerm(e.target.value, {limitUrlUpdates: debounce(125)})
              }
            />
          </InputGroup>

          {hits > 0 ? null : <LoadingIndicator mini />}

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
            disabled={isPending || isFetchingNextPage}
            hits={hits}
            sort={sort}
          />
          {isPending ? (
            <EmptyMessage>
              <LoadingIndicator />
            </EmptyMessage>
          ) : isError ? (
            <EmptyMessage>
              <LoadingError />
            </EmptyMessage>
          ) : repositories.length === 0 ? (
            <EmptyMessage>
              {searchTerm
                ? tct('No repositories found matching [searchTerm]', {
                    searchTerm: <code>{searchTerm}</code>,
                  })
                : t('No repositories found')}
            </EmptyMessage>
          ) : (
            <ScrollableBody ref={parentRef} style={{height: scrollBodyHeight}}>
              <VirtualInner style={{height: virtualizer.getTotalSize()}}>
                {virtualizer.getVirtualItems().map(virtualItem => {
                  const repository = repositories[virtualItem.index]!;
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
                <StickyLoadingRow
                  align="center"
                  justify="center"
                  padding="md"
                  borderTop="muted"
                >
                  <LoadingIndicator mini />
                </StickyLoadingRow>
              ) : null}
            </ScrollableBody>
          )}
        </TablePanel>
      </Stack>
    </ListItemCheckboxProvider>
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

const EmptyMessage = styled('div')`
  min-height: 200px;
  padding: ${p => p.theme.space.xl};
  display: flex;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
`;

const StickyLoadingRow = styled(Flex)`
  position: sticky;
  bottom: 0;
  background: ${p => p.theme.tokens.background.primary};
`;
