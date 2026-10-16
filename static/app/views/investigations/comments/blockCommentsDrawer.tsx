import {useEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useQueryStates} from 'nuqs';

import {UserAvatar} from '@sentry/scraps/avatar';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {NoteBody} from 'sentry/components/activity/note/body';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {
  getInvestigationDetailQueryOptions,
  INVESTIGATION_COMMENTS_PAGE_SIZE,
  investigationCommentsQueryOptions,
} from 'sentry/views/investigations/api';
import {CommentActions} from 'sentry/views/investigations/comments/commentActions';
import {
  CommentComposer,
  EditCommentForm,
} from 'sentry/views/investigations/comments/commentComposer';
import {
  COMMENTS_DRAWER_PARSERS,
  isCommentEdited,
} from 'sentry/views/investigations/comments/utils';
import {getBlockDisplayTitle} from 'sentry/views/investigations/detail/cell';
import type {InvestigationComment} from 'sentry/views/investigations/types';

export function BlockCommentsDrawer({investigationId}: {investigationId: string}) {
  const [{commentsBlock: blockId, comment: highlightedId}] = useQueryStates(
    COMMENTS_DRAWER_PARSERS
  );
  if (!blockId) {
    return null;
  }
  return (
    <BlockThread
      key={blockId}
      investigationId={investigationId}
      blockId={blockId}
      highlightedId={highlightedId}
    />
  );
}

function BlockThread({
  investigationId,
  blockId,
  highlightedId,
}: {
  blockId: string;
  highlightedId: string | null;
  investigationId: string;
}) {
  const organization = useOrganization();
  const {data: investigation} = useQuery(
    getInvestigationDetailQueryOptions(organization.slug, investigationId)
  );
  const {data, isPending, refetch} = useQuery({
    ...investigationCommentsQueryOptions({
      organizationSlug: organization.slug,
      investigationId,
      blockId,
    }),
    refetchInterval: investigation?.status === 'archived' ? false : 10_000,
    select: selectJsonWithHeaders,
  });

  const block = investigation?.blocks?.find(b => b.id === blockId);
  const blockMissing = !!investigation && !block;
  const readOnly = investigation?.status === 'archived';
  const comments = data ? [...data.json].reverse() : [];
  const hasOlder = parseLinkHeader(data?.headers.Link ?? null).next?.results === true;

  // Open at the newest comment, then follow only your own new comments, so
  // polls don't move the reader.
  const userId = useUser().id;
  const listRef = useRef<HTMLUListElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const seenNewestId = useRef<string | null>(null);
  useEffect(() => {
    if (!data) {
      return;
    }
    const newest = data.json[0];
    const newestId = newest?.id ?? '';
    if (newestId === seenNewestId.current) {
      return;
    }
    const isFirstLoad = seenNewestId.current === null;
    seenNewestId.current = newestId;
    if (isFirstLoad ? !highlightedId : newest?.author?.id === userId) {
      (composerRef.current ?? listRef.current?.lastElementChild)?.scrollIntoView?.({
        block: 'end',
      });
    }
  }, [data, highlightedId, userId]);

  return (
    <Stack height="100%">
      <DrawerHeader>
        <Heading as="h2" size="md">
          {block ? t('Comments on %s', getBlockDisplayTitle(block)) : t('Comments')}
        </Heading>
      </DrawerHeader>
      <DrawerBody>
        <Stack gap="lg">
          {blockMissing ? (
            <Text variant="muted">{t('This block no longer exists.')}</Text>
          ) : isPending ? (
            <LoadingIndicator />
          ) : data === undefined ? (
            <LoadingError onRetry={refetch} />
          ) : comments.length === 0 ? (
            <Text variant="muted">{t('No comments on this block yet.')}</Text>
          ) : (
            <Stack
              as="ul"
              ref={listRef}
              aria-label={t('Block comments')}
              gap="md"
              margin="0"
              padding="0"
            >
              {hasOlder ? (
                <Container as="li">
                  <Text variant="muted" size="sm">
                    {t(
                      'Showing the latest %s comments.',
                      INVESTIGATION_COMMENTS_PAGE_SIZE
                    )}
                  </Text>
                </Container>
              ) : null}
              {comments.map(comment => (
                <ThreadComment
                  key={comment.id}
                  comment={comment}
                  investigationId={investigationId}
                  highlighted={comment.id === highlightedId}
                  readOnly={readOnly}
                  onDeleted={() => inputRef.current?.focus()}
                />
              ))}
            </Stack>
          )}
          {readOnly || blockMissing ? null : (
            <Container ref={composerRef} paddingTop="lg" borderTop="primary">
              <CommentComposer
                key={blockId}
                investigationId={investigationId}
                blockId={blockId}
                inputRef={inputRef}
                alwaysShowButton
              />
            </Container>
          )}
        </Stack>
      </DrawerBody>
    </Stack>
  );
}

function ThreadComment({
  comment,
  investigationId,
  highlighted,
  readOnly,
  onDeleted,
}: {
  comment: InvestigationComment;
  highlighted: boolean;
  investigationId: string;
  onDeleted: () => void;
  readOnly: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const actionsRef = useRef<HTMLButtonElement>(null);
  const user = useUser();
  const [editing, setEditing] = useState(false);

  const isAuthor = comment.author?.id === user.id;
  const edited = isCommentEdited(comment);

  useEffect(() => {
    if (highlighted) {
      ref.current?.scrollIntoView?.({block: 'center'});
    }
  }, [highlighted]);

  return (
    <Stack
      as="li"
      ref={ref}
      gap="xs"
      padding="sm"
      radius="md"
      background={highlighted ? 'secondary' : undefined}
      aria-current={highlighted || undefined}
    >
      <Flex align="center" gap="sm">
        {comment.author ? <UserAvatar user={comment.author} size={20} /> : null}
        <Text bold>
          {comment.author
            ? comment.author.name || comment.author.email
            : t('Unknown user')}
        </Text>
        <Text variant="muted" size="sm">
          <TimeSince date={comment.dateCreated} />
        </Text>
        {edited ? (
          <Text variant="muted" size="sm">
            {t('(edited)')}
          </Text>
        ) : null}
        {isAuthor && !readOnly ? (
          <Flex flex="1" justify="end">
            <CommentActions
              comment={comment}
              investigationId={investigationId}
              editing={editing}
              onEdit={() => setEditing(true)}
              onDeleted={onDeleted}
              triggerRef={actionsRef}
            />
          </Flex>
        ) : null}
      </Flex>
      {editing ? (
        <EditCommentForm
          comment={comment}
          investigationId={investigationId}
          onDone={() => {
            setEditing(false);
            actionsRef.current?.focus();
          }}
        />
      ) : (
        <NoteBody text={comment.body} />
      )}
    </Stack>
  );
}
