import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {NoteBody} from 'sentry/components/activity/note/body';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {ProgressState} from 'sentry/types/group';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useLocation} from 'sentry/utils/useLocation';
import {useUser} from 'sentry/utils/useUser';
import {INVESTIGATION_COMMENTS_PAGE_SIZE} from 'sentry/views/investigations/api';
import {CommentActions} from 'sentry/views/investigations/comments/commentActions';
import {
  CommentComposer,
  EditCommentForm,
} from 'sentry/views/investigations/comments/commentComposer';
import {useInvestigationComments} from 'sentry/views/investigations/comments/useInvestigationComments';
import {isCommentEdited} from 'sentry/views/investigations/comments/utils';
import {getBlockDisplayTitle} from 'sentry/views/investigations/detail/cell';
import type {
  InvestigationComment,
  InvestigationDetail,
} from 'sentry/views/investigations/types';
import {
  ActivityLineContent,
  ActivityLineHeadline,
  ActivityLineList,
  ActivityLineRow,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/layout';
import {ActivityProgressMarker} from 'sentry/views/issueDetails/activitySection/activityLineItem/progressMarker/progressMarker';

export function InvestigationActivity({
  investigation,
  composerRef,
  ref,
}: {
  investigation: InvestigationDetail;
  composerRef?: React.RefObject<HTMLDivElement | null>;
  ref?: React.Ref<HTMLElement>;
}) {
  const {data, isPending, refetch} = useInvestigationComments(investigation.id, {
    archived: investigation.status === 'archived',
  });
  const blockTitles = useMemo(
    () =>
      new Map(
        (investigation.blocks ?? []).map(block => [block.id, getBlockDisplayTitle(block)])
      ),
    [investigation.blocks]
  );
  const comments = data?.json ?? [];
  const hasOlder = parseLinkHeader(data?.headers.Link ?? null).next?.results === true;

  return (
    <Stack ref={ref} as="section" gap="lg" paddingTop="2xl" borderTop="primary">
      <Heading as="h2" size="lg">
        {t('Activity')}
      </Heading>
      {investigation.status === 'archived' ? null : (
        <CommentComposer investigationId={investigation.id} inputRef={composerRef} />
      )}
      {isPending ? (
        <LoadingIndicator mini />
      ) : data === undefined ? (
        <LoadingError onRetry={refetch} />
      ) : (
        <ActivityList as="ol" aria-label={t('Activity')}>
          {comments.map(comment => (
            <CommentRow
              key={comment.id}
              comment={comment}
              investigationId={investigation.id}
              readOnly={investigation.status === 'archived'}
              blockTitle={comment.blockId ? blockTitles.get(comment.blockId) : undefined}
              onDeleted={() => composerRef?.current?.focus()}
            />
          ))}
          {hasOlder ? (
            <ActivityLineRow as="li">
              <Grid column={1} row={1} flow="column" autoColumns="22px" gap="sm">
                <ActivityProgressMarker state="activity" label={t('Older comments')} />
              </Grid>
              <Text variant="muted" density="comfortable">
                {t('Showing the latest %s comments.', INVESTIGATION_COMMENTS_PAGE_SIZE)}
              </Text>
            </ActivityLineRow>
          ) : null}
          <ActivityLineRow as="li">
            <Grid column={1} row={1} flow="column" autoColumns="22px" gap="sm">
              <ActivityProgressMarker
                state={ProgressState.IDENTIFIED}
                label={t('Created')}
              />
            </Grid>
            <ActivityLineHeadline
              title={t('Investigation first created')}
              timestamp={<TimeSince date={investigation.dateCreated} />}
            />
          </ActivityLineRow>
        </ActivityList>
      )}
    </Stack>
  );
}

function CommentRow({
  comment,
  investigationId,
  readOnly,
  blockTitle,
  onDeleted,
}: {
  comment: InvestigationComment;
  investigationId: string;
  onDeleted: () => void;
  readOnly: boolean;
  blockTitle?: string;
}) {
  const actionsRef = useRef<HTMLButtonElement>(null);
  const user = useUser();
  const location = useLocation();
  const [editing, setEditing] = useState(false);

  const isAuthor = comment.author?.id === user.id;
  const edited = isCommentEdited(comment);

  return (
    <ActivityLineRow as="li">
      <Grid column={1} row={1} flow="column" autoColumns="22px" gap="sm">
        {comment.author ? (
          <UserAvatar user={comment.author} size={22} hasTooltip />
        ) : (
          <ActivityProgressMarker state="activity" label={t('Comment')} />
        )}
      </Grid>
      <Flex
        column={2}
        row={1}
        align="center"
        wrap="wrap"
        gap="xs"
        minHeight="22px"
        minWidth={0}
      >
        <Text bold density="comfortable">
          {tct('[author] commented', {
            author: comment.author
              ? comment.author.name || comment.author.email
              : t('Unknown user'),
          })}
        </Text>
        {comment.blockId ? (
          <Text variant="muted" density="comfortable">
            {blockTitle
              ? tct('on [block]', {
                  block: (
                    <Link
                      data-block-comments-trigger
                      to={{
                        query: {
                          ...location.query,
                          comments: 'open',
                          commentsBlock: comment.blockId,
                          comment: comment.id,
                        },
                      }}
                    >
                      <Text variant="muted" underline>
                        {blockTitle}
                      </Text>
                    </Link>
                  ),
                })
              : t('on a deleted block')}
          </Text>
        ) : null}
        <Text variant="muted" density="comfortable">
          &bull;
        </Text>
        <Text variant="muted" density="comfortable" wrap="nowrap">
          <TimeSince date={comment.dateCreated} />
        </Text>
        {edited ? (
          <Text variant="muted" density="comfortable">
            {t('(edited)')}
          </Text>
        ) : null}
        {isAuthor && !readOnly ? (
          <CommentActions
            comment={comment}
            investigationId={investigationId}
            editing={editing}
            onEdit={() => setEditing(true)}
            onDeleted={onDeleted}
            triggerRef={actionsRef}
          />
        ) : null}
      </Flex>
      <ActivityLineContent>
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
          <Container
            background="secondary"
            border="primary"
            radius="lg"
            padding="sm md"
            marginTop="xs"
          >
            <NoteBody text={comment.body} />
          </Container>
        )}
      </ActivityLineContent>
    </ActivityLineRow>
  );
}

const ActivityList = styled(ActivityLineList)`
  margin: 0;
  padding: 0;
  list-style: none;
`;
