import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';
import {useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';

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
import {InboxFilterMenu, InboxFilterPills} from './inboxFilters';
import {InboxItemList} from './inboxItemList';
import {InboxItemPreview} from './inboxItemPreview';
import type {InboxFilters, InboxItem, InboxSubject} from './types';
import {useInboxFilters} from './useInboxFilters';
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
  // Last activity seen per subject when it was marked read, so a failed request is not
  // retried in a loop. Undefined means it was marked before its item was loaded.
  const attemptedRef = useRef(new Map<string, string | undefined>());

  const isUnread = item?.isUnread;
  const lastActivityAt = item?.lastActivityAt;

  useEffect(() => {
    if (!subject || isPending || isUnread === false) {
      return;
    }
    const subjectKey = `${subject.subjectType}:${subject.subjectId}`;
    const attemptedActivity = attemptedRef.current.get(subjectKey);
    const alreadyAttempted =
      attemptedRef.current.has(subjectKey) &&
      (attemptedActivity === undefined || attemptedActivity === lastActivityAt);

    attemptedRef.current.set(subjectKey, lastActivityAt);
    if (!alreadyAttempted) {
      updateInboxItems({subject, update: {isRead: true}});
    }
  }, [subject, isPending, isUnread, lastActivityAt, updateInboxItems]);
}

interface InboxListBodyProps {
  filters: InboxFilters;
  onClearFilters: () => void;
  selectedSubject: InboxSubject | null;
}

function InboxListBody({filters, onClearFilters, selectedSubject}: InboxListBodyProps) {
  const organization = useOrganization();
  const queryOptions = inboxItemsApiOptions(organization, filters);
  const {
    data,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(queryOptions);
  const items = data?.pages.flatMap(page => page.json) ?? [];

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
    isPending,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError && items.length === 0) {
    return <LoadingError onRetry={refetch} />;
  }

  if (items.length === 0) {
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
    <ListItemCheckboxProvider
      hits={items.length}
      knownIds={items.map(item => item.id)}
      endpointOptions={safeParseQueryKey(queryOptions.queryKey)?.options}
    >
      <InboxItemList
        items={items}
        selectedItemId={selectedItem?.id ?? null}
        filters={filters}
      />
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
    </ListItemCheckboxProvider>
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
        <Stack gap="md" padding="md xl" borderBottom="primary">
          <Flex justify="end">
            <InboxFilterMenu filters={filters} setFilters={setFilters} />
          </Flex>
          <InboxFilterPills filters={filters} setFilters={setFilters} />
        </Stack>
        <Container flex={1} overflowY="auto" minHeight={0}>
          <InboxListBody
            filters={filters}
            onClearFilters={() => void setFilters({subjectType: null, eventType: null})}
            selectedSubject={selectedSubject}
          />
        </Container>
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
      <Container
        key={
          selectedSubject
            ? `${selectedSubject.subjectType}:${selectedSubject.subjectId}`
            : undefined
        }
        overflowY="auto"
        minHeight={0}
      >
        <InboxItemPreview subject={selectedSubject} />
      </Container>
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
      <TopBar.Slot name="breadcrumbs" title={{type: 'page-title', label: t('Inbox')}} />
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
