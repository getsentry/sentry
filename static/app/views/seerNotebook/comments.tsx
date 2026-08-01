import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {CompactNoteInput} from 'sentry/components/activity/note/compact';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconAdd, IconChat, IconClose, IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useMembers} from 'sentry/utils/members/useMembers';
import {useTeams} from 'sentry/utils/useTeams';
import {useUser} from 'sentry/utils/useUser';

import {
  createComment,
  deleteComment,
  investigationCommentsQueryOptions,
  setCommentReaction,
  updateComment,
} from './api';
import type {
  InvestigationCell,
  InvestigationReaction,
  InvestigationReactionName,
} from './types';
import {INVESTIGATION_REACTIONS} from './types';

type ReactionBarProps = {
  disabled: boolean;
  onToggle: (reaction: InvestigationReactionName, enabled: boolean) => Promise<void>;
  reactions: InvestigationReaction[];
};

export function ReactionBar({disabled, onToggle, reactions}: ReactionBarProps) {
  const byName = new Map(reactions.map(reaction => [reaction.reaction, reaction]));

  return (
    <Flex align="center" gap="xs" wrap="wrap">
      {reactions.map(reaction => {
        const definition = INVESTIGATION_REACTIONS.find(
          item => item.value === reaction.reaction
        );
        return (
          <Button
            key={reaction.reaction}
            size="xs"
            variant={reaction.reactedByMe ? 'primary' : 'transparent'}
            disabled={disabled}
            aria-label={t(
              '%s reaction, %s',
              definition?.label ?? reaction.reaction,
              reaction.count
            )}
            onClick={() => onToggle(reaction.reaction, !reaction.reactedByMe)}
          >
            {definition?.emoji ?? reaction.reaction} {reaction.count}
          </Button>
        );
      })}
      {disabled ? null : (
        <DropdownMenu
          items={INVESTIGATION_REACTIONS.map(reaction => ({
            key: reaction.value,
            label: `${reaction.emoji} ${reaction.label}`,
            onAction: () =>
              onToggle(reaction.value, !byName.get(reaction.value)?.reactedByMe),
          }))}
          position="bottom-end"
          trigger={triggerProps => (
            <Button
              {...triggerProps}
              size="xs"
              variant="transparent"
              icon={<IconAdd />}
              aria-label={t('Add reaction')}
            />
          )}
        />
      )}
    </Flex>
  );
}

type Props = {
  canManage: boolean;
  cell: InvestigationCell;
  disabled: boolean;
  investigationId: string;
  onCommentCountChange: (delta: number) => void;
  organizationSlug: string;
};

export function CellComments({
  cell,
  disabled,
  investigationId,
  organizationSlug,
  canManage,
  onCommentCountChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleToggle = async () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      await queryClient.fetchInfiniteQuery(
        investigationCommentsQueryOptions({
          cellId: cell.id,
          investigationId,
          organizationSlug,
        })
      );
      setIsOpen(true);
    } catch {
      addErrorMessage(t('Unable to load comments.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Fragment>
      <CommentTrigger>
        <Button
          size="xs"
          variant="transparent"
          icon={isLoading ? <LoadingIndicator size={14} /> : <IconChat />}
          disabled={isLoading}
          aria-label={t('Comments, %s', cell.commentCount)}
          onClick={handleToggle}
        />
        {cell.commentCount ? <CommentCount>{cell.commentCount}</CommentCount> : null}
      </CommentTrigger>
      {isOpen ? (
        <CommentPopover
          cell={cell}
          disabled={disabled}
          investigationId={investigationId}
          organizationSlug={organizationSlug}
          canManage={canManage}
          onClose={() => setIsOpen(false)}
          onCommentCountChange={onCommentCountChange}
        />
      ) : null}
    </Fragment>
  );
}

const CommentTrigger = styled('span')`
  position: relative;
  display: inline-flex;
`;

const CommentCount = styled('span')`
  position: absolute;
  top: -4px;
  right: -5px;
  display: grid;
  min-width: 14px;
  height: 14px;
  place-items: center;
  padding: 0 3px;
  border: 2px solid ${p => p.theme.tokens.border.primary};
  border-radius: 999px;
  background: ${p => p.theme.tokens.background.accent.vibrant};
  color: ${p => p.theme.tokens.content.onVibrant.light};
  font-size: 9px;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1;
  pointer-events: none;
`;

function CommentPopover({
  cell,
  disabled,
  investigationId,
  organizationSlug,
  canManage,
  onClose,
  onCommentCountChange,
}: Props & {onClose: () => void}) {
  const [editingId, setEditingId] = useState<string>();
  const [commentReactionOverrides, setCommentReactionOverrides] = useState<
    Record<string, InvestigationReaction[]>
  >({});
  const user = useUser();
  const {teams} = useTeams();
  const commentsOptions = investigationCommentsQueryOptions({
    organizationSlug,
    investigationId,
    cellId: cell.id,
  });
  const commentsQuery = useInfiniteQuery(commentsOptions);
  const comments = useMemo(
    () => commentsQuery.data?.pages.flatMap(page => page.json) ?? [],
    [commentsQuery.data?.pages]
  );
  const memberIds = useMemo(
    () =>
      comments.flatMap(comment => [
        ...(comment.author ? [comment.author] : []),
        ...comment.mentions.flatMap(mention =>
          mention.type === 'user' ? [mention.id] : []
        ),
      ]),
    [comments]
  );
  const {data: members = []} = useMembers({
    ids: memberIds,
    enabled: memberIds.length > 0,
  });
  const memberById = new Map(members.map(member => [String(member.id), member]));
  const teamById = new Map(teams.map(team => [String(team.id), team]));

  const refresh = async () => {
    await commentsQuery.refetch();
  };

  const createMutation = useMutation({
    mutationFn: (data: {text: string; mentions?: string[]}) =>
      createComment(organizationSlug, investigationId, cell.id, {
        body: data.text,
        mentions: data.mentions ?? [],
      }),
    onSuccess: async () => {
      onCommentCountChange(1);
      await refresh();
    },
    onError: () => addErrorMessage(t('Unable to add the comment.')),
  });
  const updateMutation = useMutation({
    mutationFn: ({
      commentId,
      text,
      mentions,
    }: {
      commentId: string;
      text: string;
      mentions?: string[];
    }) =>
      updateComment(organizationSlug, investigationId, commentId, {
        body: text,
        mentions: mentions ?? [],
      }),
    onSuccess: async () => {
      setEditingId(undefined);
      await refresh();
    },
    onError: () => addErrorMessage(t('Unable to update the comment.')),
  });
  const deleteMutation = useMutation({
    mutationFn: (commentId: string) =>
      deleteComment(organizationSlug, investigationId, commentId),
    onSuccess: async () => {
      onCommentCountChange(-1);
      await refresh();
    },
    onError: () => addErrorMessage(t('Unable to delete the comment.')),
  });

  return (
    <PopoverPanel role="dialog" aria-label={t('Cell comments')}>
      <PopoverHeader align="center" justify="between" gap="sm">
        <Text bold>{t('Comments')}</Text>
        <Button
          size="xs"
          variant="transparent"
          icon={<IconClose />}
          aria-label={t('Close comments')}
          onClick={onClose}
        />
      </PopoverHeader>
      <PopoverBody>
        {commentsQuery.isPending ? (
          <Text variant="muted">{t('Loading comments…')}</Text>
        ) : null}
        {commentsQuery.isError ? (
          <Button size="xs" onClick={() => commentsQuery.refetch()}>
            {t('Retry loading comments')}
          </Button>
        ) : null}
        {comments.map(comment => {
          const author = comment.author ? memberById.get(comment.author) : undefined;
          const mayEdit = comment.author === String(user.id) && !comment.deletedAt;
          const mayDelete = (mayEdit || canManage) && !comment.deletedAt;
          const initialMentions = comment.mentions.map(mention => {
            const display =
              mention.type === 'team'
                ? `#${teamById.get(mention.id)?.slug ?? mention.id}`
                : (memberById.get(mention.id)?.name ?? mention.id);
            return [`${mention.type}:${mention.id}`, display] as [string, string];
          });

          return (
            <Comment key={comment.id}>
              {editingId === comment.id && comment.body ? (
                <CompactNoteInput
                  noteId={comment.id}
                  text={comment.body}
                  mentioned={initialMentions}
                  onCancel={() => setEditingId(undefined)}
                  onUpdate={async data => {
                    await updateMutation.mutateAsync({
                      commentId: comment.id,
                      ...data,
                    });
                  }}
                />
              ) : (
                <CommentContent>
                  <Flex align="center" justify="between" gap="xs">
                    <CommentAuthor>{author?.name ?? t('Former member')}</CommentAuthor>
                    <CommentActions gap="xs">
                      {mayEdit ? (
                        <Button
                          size="xs"
                          variant="transparent"
                          icon={<IconEdit />}
                          aria-label={t('Edit comment')}
                          onClick={() => setEditingId(comment.id)}
                        />
                      ) : null}
                      {mayDelete ? (
                        <Button
                          size="xs"
                          variant="transparent"
                          icon={<IconDelete />}
                          aria-label={t('Delete comment')}
                          onClick={() =>
                            openConfirmModal({
                              message: t('Delete this comment?'),
                              confirmText: t('Delete'),
                              priority: 'danger',
                              onConfirm: () => deleteMutation.mutateAsync(comment.id),
                            })
                          }
                        />
                      ) : null}
                    </CommentActions>
                  </Flex>
                  {comment.body ? (
                    <CommentText>{comment.body}</CommentText>
                  ) : (
                    <Text size="sm" variant="muted">
                      {t('This comment was deleted.')}
                    </Text>
                  )}
                  <ReactionBar
                    reactions={commentReactionOverrides[comment.id] ?? comment.reactions}
                    disabled={disabled || Boolean(comment.deletedAt)}
                    onToggle={async (reaction, enabled) => {
                      const previous =
                        commentReactionOverrides[comment.id] ?? comment.reactions;
                      setCommentReactionOverrides(current => ({
                        ...current,
                        [comment.id]: toggleReaction(previous, reaction, enabled),
                      }));
                      try {
                        await setCommentReaction(
                          organizationSlug,
                          investigationId,
                          comment.id,
                          reaction,
                          enabled
                        );
                        await refresh();
                        setCommentReactionOverrides(current => {
                          const next = {...current};
                          delete next[comment.id];
                          return next;
                        });
                      } catch {
                        setCommentReactionOverrides(current => ({
                          ...current,
                          [comment.id]: previous,
                        }));
                        addErrorMessage(t('Unable to update the reaction.'));
                      }
                    }}
                  />
                </CommentContent>
              )}
            </Comment>
          );
        })}
        {comments.length === 0 && !commentsQuery.isPending ? (
          <EmptyComments>
            <Text size="sm" variant="muted">
              {t('No comments yet.')}
            </Text>
          </EmptyComments>
        ) : null}
        {commentsQuery.hasNextPage ? (
          <Button
            size="xs"
            busy={commentsQuery.isFetchingNextPage}
            onClick={() => commentsQuery.fetchNextPage()}
          >
            {t('Load more comments')}
          </Button>
        ) : null}
        {disabled ? null : (
          <CommentComposer>
            <CompactNoteInput
              placeholder={t('Write a comment… Tag with @ or #')}
              onCreate={async data => {
                await createMutation.mutateAsync(data);
              }}
            />
          </CommentComposer>
        )}
      </PopoverBody>
    </PopoverPanel>
  );
}

function toggleReaction(
  reactions: InvestigationReaction[],
  name: InvestigationReactionName,
  enabled: boolean
): InvestigationReaction[] {
  const existing = reactions.find(reaction => reaction.reaction === name);
  if (!existing) {
    return enabled
      ? [...reactions, {reaction: name, count: 1, reactedByMe: true}]
      : reactions;
  }

  const count = Math.max(0, existing.count + (enabled ? 1 : -1));
  return reactions
    .map(reaction =>
      reaction.reaction === name ? {...reaction, count, reactedByMe: enabled} : reaction
    )
    .filter(reaction => reaction.count > 0);
}

const PopoverPanel = styled('section')`
  position: absolute;
  z-index: 20;
  top: 0;
  right: 44px;
  width: min(310px, calc(100vw - 32px));
  max-height: min(560px, calc(100vh - 100px));
  overflow: auto;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
  box-shadow: ${p => p.theme.shadow.high};
`;

const PopoverHeader = styled(Flex)`
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const PopoverBody = styled(Stack)`
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.sm};
`;

const Comment = styled('article')`
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
`;

const CommentContent = styled(Stack)`
  gap: ${p => p.theme.space.xs};
`;

const CommentActions = styled(Flex)`
  opacity: 0.56;
  transition: opacity 120ms ease;

  ${Comment}:hover &,
  &:focus-within {
    opacity: 1;
  }
`;

const CommentAuthor = styled('span')`
  padding: 1px 6px;
  border-radius: 999px;
  background: ${p => p.theme.tokens.background.secondary};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1.4;
`;

const CommentText = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.45;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
`;

const EmptyComments = styled('div')`
  display: grid;
  min-height: 72px;
  place-items: center;
  padding: ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.secondary};
  text-align: center;
`;

const CommentComposer = styled('div')`
  padding-top: ${p => p.theme.space.sm};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
`;
