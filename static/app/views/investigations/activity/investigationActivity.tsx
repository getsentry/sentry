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
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {
  getAppliedActivityNote,
  getAppliedActivityTitle,
} from 'sentry/views/investigations/actionRequests/actionRequestDetails';
import {INVESTIGATION_COMMENTS_PAGE_SIZE} from 'sentry/views/investigations/api';
import {CommentActions} from 'sentry/views/investigations/comments/commentActions';
import {
  CommentComposer,
  EditCommentForm,
} from 'sentry/views/investigations/comments/commentComposer';
import {useInvestigationComments} from 'sentry/views/investigations/comments/useInvestigationComments';
import {isCommentEdited} from 'sentry/views/investigations/comments/utils';
import {getBlockDisplayTitle} from 'sentry/views/investigations/detail/block';
import type {
  InvestigationActionRequest,
  InvestigationComment,
  InvestigationDetail,
} from 'sentry/views/investigations/types';
import {getActorName} from 'sentry/views/investigations/utils';
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
  id,
  ref,
}: {
  investigation: InvestigationDetail;
  composerRef?: React.RefObject<HTMLDivElement | null>;
  id?: string;
  ref?: React.Ref<HTMLElement>;
}) {
  const {data, isPending, refetch} = useInvestigationComments(investigation.id, {
    shouldPoll: investigation.status !== 'archived',
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
  const entries = getActivityEntries(
    comments,
    investigation.actionRequests ?? [],
    hasOlder
  );

  return (
    <Stack ref={ref} as="section" id={id} gap="lg" paddingTop="2xl" borderTop="primary">
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
          {entries.map(entry =>
            entry.type === 'comment' ? (
              <CommentRow
                key={`comment-${entry.comment.id}`}
                comment={entry.comment}
                investigationId={investigation.id}
                readOnly={investigation.status === 'archived'}
                blockTitle={
                  entry.comment.blockId
                    ? blockTitles.get(entry.comment.blockId)
                    : undefined
                }
                onDeleted={() => composerRef?.current?.focus()}
              />
            ) : (
              <AppliedActionRow
                key={`action-${entry.actionRequest.id}`}
                actionRequest={entry.actionRequest}
                dateApplied={entry.date}
              />
            )
          )}
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

type ActivityEntry =
  | {comment: InvestigationComment; date: string; type: 'comment'}
  | {actionRequest: InvestigationActionRequest; date: string; type: 'action'};

function getActivityEntries(
  comments: InvestigationComment[],
  actionRequests: InvestigationActionRequest[],
  hasOlderComments: boolean
): ActivityEntry[] {
  const entries: ActivityEntry[] = comments.map(comment => ({
    type: 'comment',
    date: comment.dateCreated,
    comment,
  }));
  const oldestComment = hasOlderComments
    ? Math.min(...comments.map(comment => Date.parse(comment.dateCreated)))
    : -Infinity;
  for (const actionRequest of actionRequests) {
    if (
      actionRequest.state === 'applied' &&
      actionRequest.dateApplied &&
      Date.parse(actionRequest.dateApplied) >= oldestComment
    ) {
      entries.push({type: 'action', date: actionRequest.dateApplied, actionRequest});
    }
  }
  return entries.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

function AppliedActionRow({
  actionRequest,
  dateApplied,
}: {
  actionRequest: InvestigationActionRequest;
  dateApplied: string;
}) {
  const organization = useOrganization();
  const {appliedBy} = actionRequest;

  return (
    <ActivityLineRow as="li">
      <Grid column={1} row={1} flow="column" autoColumns="22px" gap="sm">
        {appliedBy ? (
          <UserAvatar user={appliedBy} size={22} hasTooltip />
        ) : (
          <ActivityProgressMarker state="activity" label={t('Applied')} />
        )}
      </Grid>
      <ActivityLineHeadline
        title={getAppliedActivityTitle(
          actionRequest,
          appliedBy ? getActorName(appliedBy) : null,
          organization.slug
        )}
        details={getAppliedActivityNote(actionRequest)}
        timestamp={<TimeSince date={dateApplied} />}
      />
    </ActivityLineRow>
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
            author: comment.author ? getActorName(comment.author) : t('Unknown user'),
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
