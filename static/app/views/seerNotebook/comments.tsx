import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {observer} from 'mobx-react-lite';

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
import type {BlockStore} from 'sentry/views/seerNotebook/stores/blockStore';

import type {InvestigationReaction, InvestigationReactionName} from './types';
import {INVESTIGATION_REACTIONS} from './types';

type ReactionBarProps = {
  disabled: boolean;
  onToggle: (reaction: InvestigationReactionName, enabled: boolean) => Promise<void>;
  reactions: InvestigationReaction[];
};

/** @public */ export function ReactionBar({
  disabled,
  onToggle,
  reactions,
}: ReactionBarProps) {
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
              variant="secondary"
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
  block: BlockStore;
  disabled: boolean;
};

export const BlockComments = observer(({block, disabled}: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = async () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    if (block.commentsLoadState === 'loading') {
      return;
    }

    try {
      await block.loadComments();
      setIsOpen(true);
    } catch {
      addErrorMessage(t('Unable to load comments.'));
    }
  };

  const isLoading = block.commentsLoadState === 'loading';

  return (
    <Fragment>
      <CommentTrigger>
        <Button
          size="xs"
          variant="transparent"
          icon={
            isLoading ? <LoadingIndicator size={14} style={{margin: 0}} /> : <IconChat />
          }
          disabled={isLoading}
          aria-label={t('Comments, %s', block.commentCount)}
          onClick={handleToggle}
        />
        {block.commentCount ? <CommentCount>{block.commentCount}</CommentCount> : null}
      </CommentTrigger>
      {isOpen ? (
        <CommentPopover
          block={block}
          disabled={disabled}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </Fragment>
  );
});

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

const CommentPopover = observer(
  ({block, disabled, onClose}: Props & {onClose: () => void}) => {
    const [editingId, setEditingId] = useState<string>();
    const user = useUser();
    const {teams} = useTeams();
    const canManage = block.notebook.permissions.canManage;
    const comments = block.comments;
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

    return (
      <PopoverPanel role="dialog" aria-label={t('Block comments')}>
        <PopoverHeader align="center" justify="between" gap="sm">
          <Text size="sm" bold>
            {t('Comments')}
          </Text>
          <Button
            size="xs"
            variant="transparent"
            icon={<IconClose />}
            aria-label={t('Close comments')}
            onClick={onClose}
          />
        </PopoverHeader>
        <PopoverBody>
          {block.commentsLoadState === 'loading' ? (
            <Text variant="muted">{t('Loading comments…')}</Text>
          ) : null}
          {block.commentsLoadState === 'error' ? (
            <Button size="xs" onClick={() => void block.loadComments()}>
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
            const storedDraft = block.commentDrafts.get(comment.id);

            return (
              <Comment key={comment.id}>
                {editingId === comment.id && comment.body ? (
                  <CompactNoteInput
                    controlled
                    noteId={comment.id}
                    text={storedDraft?.body ?? comment.body}
                    mentioned={initialMentions}
                    onCancel={() => setEditingId(undefined)}
                    onChange={event =>
                      block.editExistingCommentDraft(
                        comment.id,
                        event.target.value,
                        storedDraft?.mentions ?? initialMentions.map(([id]) => id)
                      )
                    }
                    onUpdate={async data => {
                      try {
                        await block.updateComment(
                          comment.id,
                          data.text,
                          data.mentions ?? []
                        );
                        setEditingId(undefined);
                      } catch {
                        addErrorMessage(t('Unable to update the comment.'));
                        throw new Error('comment_update_failed');
                      }
                    }}
                  />
                ) : (
                  <CommentContent>
                    <Flex align="center" justify="between" gap="xs">
                      <CommentAuthor>{author?.name ?? t('Former member')}</CommentAuthor>
                      <CommentActions gap="xs" align="center">
                        <ReactionBar
                          reactions={comment.reactions}
                          disabled={disabled || Boolean(comment.deletedAt)}
                          onToggle={async (reaction, enabled) => {
                            try {
                              await block.toggleCommentReaction(
                                comment.id,
                                reaction,
                                enabled
                              );
                            } catch {
                              addErrorMessage(t('Unable to update the reaction.'));
                            }
                          }}
                        />
                        {mayEdit ? (
                          <Button
                            size="xs"
                            variant="transparent"
                            icon={<IconEdit />}
                            aria-label={t('Edit comment')}
                            onClick={() => {
                              block.editExistingCommentDraft(
                                comment.id,
                                comment.body ?? '',
                                initialMentions.map(([id]) => id)
                              );
                              setEditingId(comment.id);
                            }}
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
                                onConfirm: async () => {
                                  try {
                                    await block.deleteComment(comment.id);
                                  } catch {
                                    addErrorMessage(t('Unable to delete the comment.'));
                                  }
                                },
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
                  </CommentContent>
                )}
              </Comment>
            );
          })}
          {comments.length === 0 && block.commentsLoadState !== 'loading' ? (
            <EmptyComments>
              <Text size="sm" variant="muted">
                {t('No comments yet.')}
              </Text>
            </EmptyComments>
          ) : null}
          {block.commentsNextCursor ? (
            <Button
              size="xs"
              busy={block.commentsLoadState === 'loading'}
              onClick={() => void block.loadMoreComments()}
            >
              {t('Load more comments')}
            </Button>
          ) : null}
          {disabled ? null : (
            <CommentComposer>
              <CompactNoteInput
                controlled
                text={block.commentDraft}
                placeholder={t('Write a comment… Tag with @ or #')}
                onChange={event => block.editCommentDraft(event.target.value)}
                onCreate={async data => {
                  try {
                    await block.createComment(data.text, data.mentions ?? []);
                  } catch {
                    addErrorMessage(t('Unable to add the comment.'));
                    throw new Error('comment_create_failed');
                  }
                }}
              />
            </CommentComposer>
          )}
        </PopoverBody>
      </PopoverPanel>
    );
  }
);

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
