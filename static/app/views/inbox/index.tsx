import {useRef} from 'react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';
import {useInfiniteQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';

import {NotFound} from 'sentry/components/errors/notFound';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useResizable} from 'sentry/utils/useResizable';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {inboxItemsApiOptions} from 'sentry/views/inbox/inboxApiOptions';
import {InboxItemList} from 'sentry/views/inbox/inboxItemList';
import {InboxItemPreview} from 'sentry/views/inbox/inboxItemPreview';
import {getInboxSubjectFromPath} from 'sentry/views/inbox/utils';
import {TopBar} from 'sentry/views/navigation/topBar';

const INBOX_LIST_SIZE_STORAGE_KEY = 'universal-inbox-list-size';
const INBOX_LIST_DEFAULT_SIZE = 480;
const INBOX_LIST_MIN_SIZE = 320;
const INBOX_LIST_MAX_SIZE = 640;

function InboxContent() {
  const organization = useOrganization();
  const {
    data,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(inboxItemsApiOptions(organization));
  const items = data?.pages.flatMap(page => page.json) ?? [];
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

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError && items.length === 0) {
    return <LoadingError onRetry={refetch} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        padding="2xl"
        title={t('Your inbox is empty')}
        description={t('Assignments, mentions and other updates will show up here.')}
      />
    );
  }

  const selectedSubject = getInboxSubjectFromPath(location.pathname, id);
  const selectedItem = selectedSubject
    ? items.find(
        item =>
          item.subjectType === selectedSubject.subjectType &&
          item.subjectId === selectedSubject.subjectId
      )
    : undefined;

  return (
    <ListItemCheckboxProvider
      hits={items.length}
      knownIds={items.map(item => item.id)}
      endpointOptions={undefined}
    >
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
          <Container flex={1} overflowY="auto" minHeight={0}>
            <InboxItemList items={items} selectedItemId={selectedItem?.id ?? null} />
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
        <Container key={selectedItem?.id} overflowY="auto" minHeight={0}>
          <InboxItemPreview subject={selectedSubject} />
        </Container>
      </Grid>
    </ListItemCheckboxProvider>
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
