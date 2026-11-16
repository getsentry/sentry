import {Fragment, useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';

import {NotFound} from 'sentry/components/errors/notFound';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useResizable} from 'sentry/utils/useResizable';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {TopBar} from 'sentry/views/navigation/topBar';

import {inboxItemsApiOptions, updateInboxItemsMutationOptions} from './inboxApiOptions';
import {InboxItemList} from './inboxItemList';
import {InboxItemPreview} from './inboxItemPreview';
import {InboxListHeader} from './inboxListHeader';
import type {InboxFilters, InboxItem, InboxSubject} from './types';
import {useInboxFilters, type SetInboxFilters} from './useInboxFilters';
import {getInboxSubjectFromPath, hasInboxFilters} from './utils';

const INBOX_LIST_SIZE_STORAGE_KEY = 'universal-inbox-list-size';
const INBOX_LIST_DEFAULT_SIZE = 480;
const INBOX_LIST_MIN_SIZE = 320;
const INBOX_LIST_MAX_SIZE = 640;

interface UseMarkInboxItemReadOnViewOptions {
  isPending: boolean;
  item: InboxItem | undefined;
  subject: InboxSubject | null;
}

function useMarkInboxItemReadOnView({
  subject,
  item,
  isPending,
}: UseMarkInboxItemReadOnViewOptions) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {mutate: updateInboxItems} = useMutation(
    updateInboxItemsMutationOptions({organization, queryClient})
  );
  // Last activity seen during the current visit, so a failed request is not retried
  // in a loop. Undefined means it was marked before its item was loaded.
  const attemptedRef = useRef<{
    lastActivityAt: string | undefined;
    subjectKey: string;
  } | null>(null);

  const isUnread = item?.isUnread;
  const lastActivityAt = item?.lastActivityAt;

  useEffect(() => {
    const subjectKey = subject ? `${subject.subjectType}:${subject.subjectId}` : null;
    if (attemptedRef.current?.subjectKey !== subjectKey) {
      attemptedRef.current = null;
    }
    if (!subject || !subjectKey || isPending) {
      return;
    }
    const attemptedActivity = attemptedRef.current?.lastActivityAt;
    const alreadyAttempted =
      attemptedRef.current !== null &&
      (attemptedActivity === undefined || attemptedActivity === lastActivityAt);

    attemptedRef.current = {subjectKey, lastActivityAt};
    // Remember already-read items too, so explicitly marking the open item unread
    // does not immediately mark it read again without new activity.
    if (!alreadyAttempted && isUnread !== false) {
      updateInboxItems({subject, update: {isRead: true}});
    }
  }, [subject, isPending, isUnread, lastActivityAt, updateInboxItems]);
}

interface InboxListProps {
  filters: InboxFilters;
  selectedSubject: InboxSubject | null;
  setFilters: SetInboxFilters;
}

function InboxList({filters, setFilters, selectedSubject}: InboxListProps) {
  const organization = useOrganization();
  const queryOptions = inboxItemsApiOptions(organization, filters);
  const query = useInfiniteQuery(queryOptions);
  const items = query.data?.pages.flatMap(page => page.json) ?? [];

  const selectedItem = selectedSubject
    ? items.find(
        item =>
          item.subjectType === selectedSubject.subjectType &&
          item.subjectId === selectedSubject.subjectId
      )
    : undefined;
  useMarkInboxItemReadOnView({
    subject: selectedSubject,
    item: selectedItem,
    isPending: query.isPending,
  });

  return (
    <ListItemCheckboxProvider
      hits={items.length}
      knownIds={items.map(item => item.id)}
      endpointOptions={safeParseQueryKey(queryOptions.queryKey)?.options}
    >
      <InboxListHeader filters={filters} setFilters={setFilters} />
      <Container flex={1} overflowY="auto" minHeight={0}>
        <InboxListBody
          query={query}
          items={items}
          filters={filters}
          onClearFilters={() =>
            void setFilters({subjectType: null, eventType: null, recipient: null})
          }
          selectedItemId={selectedItem?.id ?? null}
        />
      </Container>
    </ListItemCheckboxProvider>
  );
}

interface InboxListBodyProps {
  filters: InboxFilters;
  items: InboxItem[];
  onClearFilters: () => void;
  query: UseInfiniteQueryResult;
  selectedItemId: string | null;
}

function InboxListBody({
  query,
  items,
  filters,
  onClearFilters,
  selectedItemId,
}: InboxListBodyProps) {
  const {isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage} =
    query;

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError && items.length === 0) {
    return <LoadingError onRetry={refetch} />;
  }

  // Loaded pages can be emptied by removals while later pages still have items
  if (items.length === 0 && !hasNextPage) {
    return hasInboxFilters(filters) ? (
      <EmptyState
        padding="2xl"
        title={t('No items match these filters')}
        action={
          <Button size="sm" onClick={onClearFilters}>
            {t('Clear filters')}
          </Button>
        }
      />
    ) : (
      <EmptyState
        padding="2xl"
        title={t('Your inbox is empty')}
        description={t('Assignments, mentions and other updates will show up here.')}
      />
    );
  }

  return (
    <Fragment>
      <InboxItemList items={items} selectedItemId={selectedItemId} filters={filters} />
      {hasNextPage && (
        <Flex justify="center" padding="md xl">
          <Button
            size="sm"
            busy={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
            icon={<IconChevron direction="down" />}
          >
            {t('Show more')}
          </Button>
        </Flex>
      )}
    </Fragment>
  );
}

function InboxContent() {
  const [filters, setFilters] = useInboxFilters();
  const {id} = useParams<{id?: string}>();
  const location = useLocation();
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [storedSize, setStoredSize] = useSyncedLocalStorageState(
    INBOX_LIST_SIZE_STORAGE_KEY,
    INBOX_LIST_DEFAULT_SIZE
  );
  const {onMouseDown: handleStartResize, size} = useResizable({
    ref: listContainerRef,
    initialSize: storedSize,
    minWidth: INBOX_LIST_MIN_SIZE,
    maxWidth: INBOX_LIST_MAX_SIZE,
    onResizeEnd: setStoredSize,
  });

  const selectedSubject = getInboxSubjectFromPath(location.pathname, id);

  return (
    <Grid columns="max-content minmax(0, 1fr)" flex={1} minHeight={0}>
      <Stack
        ref={listContainerRef}
        position="relative"
        // useResizable writes an inline width, so the initial width is also set inline.
        style={{width: `${storedSize}px`}}
        minWidth={0}
        minHeight={0}
        borderRight="primary"
      >
        <InboxList
          filters={filters}
          setFilters={setFilters}
          selectedSubject={selectedSubject}
        />
        <Container top="0" right="0" bottom="0" width="8px" position="absolute">
          {props => (
            <ResizeHandle
              {...props}
              onMouseDown={handleStartResize}
              onDoubleClick={() => setStoredSize(INBOX_LIST_DEFAULT_SIZE)}
              atMinWidth={size === INBOX_LIST_MIN_SIZE}
              atMaxWidth={size === INBOX_LIST_MAX_SIZE}
            />
          )}
        </Container>
      </Stack>
      {/* Keyed so that selecting another item starts the preview scrolled to the top */}
      <Stack
        key={
          selectedSubject
            ? `${selectedSubject.subjectType}:${selectedSubject.subjectId}`
            : undefined
        }
        overflowY="auto"
        minHeight={0}
      >
        <InboxItemPreview subject={selectedSubject} />
      </Stack>
    </Grid>
  );
}

export default function Inbox() {
  const organization = useOrganization();

  if (!organization.features.includes('universal-inbox')) {
    return <NotFound />;
  }

  return (
    <SentryDocumentTitle title={t('Inbox')} orgSlug={organization.slug}>
      <TopBar.Slot
        name="breadcrumbs"
        title={{
          type: 'page-title',
          label: t('Inbox'),
          trailingActions: {
            type: 'badge',
            element: <FeatureBadge type="alpha" />,
          },
        }}
      />
      <Stack flex={1} minHeight={0} background="primary" overflow="hidden" contain="size">
        <InboxContent />
      </Stack>
    </SentryDocumentTitle>
  );
}

const ResizeHandle = styled('div')<{atMaxWidth: boolean; atMinWidth: boolean}>`
  z-index: ${p => p.theme.zIndex.drawer + 2};
  cursor: ${p => (p.atMinWidth ? 'e-resize' : p.atMaxWidth ? 'w-resize' : 'ew-resize')};

  &:hover,
  &:active {
    &::after {
      background: ${p => p.theme.tokens.graphics.accent.vibrant};
    }
  }

  &::after {
    content: '';
    position: absolute;
    right: -2px;
    top: 0;
    bottom: 0;
    width: 4px;
    opacity: 0.8;
    background: transparent;
    transition: background ${p => p.theme.motion.smooth.slow} 0.1s;
  }
`;
