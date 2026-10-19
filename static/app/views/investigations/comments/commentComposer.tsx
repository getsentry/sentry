import {useEffect, useRef, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Composer, type ComposerValue} from '@sentry/scraps/composer';
import {Flex, Stack} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useCreateInvestigationCommentMutation,
  useUpdateInvestigationCommentMutation,
} from 'sentry/views/investigations/api';
import {
  loadCommentDraft,
  saveCommentDraft,
} from 'sentry/views/investigations/comments/commentDrafts';
import type {InvestigationComment} from 'sentry/views/investigations/types';

const EMPTY_VALUE: ComposerValue = {text: '', mentions: []};

function isSubmitKey(event: React.KeyboardEvent) {
  return event.key === 'Enter' && !event.shiftKey && !event.altKey;
}

export function CommentComposer({
  investigationId,
  blockId,
  inputRef,
  alwaysShowButton = false,
}: {
  investigationId: string;
  alwaysShowButton?: boolean;
  blockId?: string;
  inputRef?: React.Ref<HTMLDivElement>;
}) {
  const organization = useOrganization();
  const [value, setValue] = useState<ComposerValue>(() =>
    blockId
      ? {text: loadCommentDraft(investigationId, blockId), mentions: []}
      : EMPTY_VALUE
  );
  const {mutate, isPending} = useCreateInvestigationCommentMutation(
    organization.slug,
    investigationId,
    {
      onSuccess: (_comment, {body: submitted}) => {
        setValue(current => (current.text.trim() === submitted ? EMPTY_VALUE : current));
        if (blockId && loadCommentDraft(investigationId, blockId).trim() === submitted) {
          saveCommentDraft(investigationId, blockId, '');
        }
      },
      onError: () => addErrorMessage(t('Unable to post comment.')),
    }
  );
  const body = value.text.trim();

  const submit = () => {
    if (!body || isPending) {
      return;
    }
    mutate({body, blockId});
  };

  return (
    <Stack gap="sm">
      <Composer
        ref={inputRef}
        aria-label={t('Add a comment')}
        placeholder={t('Add a comment…')}
        value={value}
        onChange={next => {
          setValue(next);
          if (blockId) {
            saveCommentDraft(investigationId, blockId, next.text);
          }
        }}
        plugins={[]}
        minHeight={56}
        onKeyDown={event => {
          if (isSubmitKey(event)) {
            event.preventDefault();
            submit();
          }
        }}
      />
      {body || alwaysShowButton ? (
        <Flex justify="end">
          <Button
            variant="primary"
            size="sm"
            disabled={!body || isPending}
            busy={isPending}
            onClick={submit}
          >
            {t('Comment')}
          </Button>
        </Flex>
      ) : null}
    </Stack>
  );
}

export function EditCommentForm({
  comment,
  investigationId,
  onDone,
}: {
  comment: InvestigationComment;
  investigationId: string;
  onDone: () => void;
}) {
  const organization = useOrganization();
  const inputRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<ComposerValue>({text: comment.body, mentions: []});
  const {isPending, mutate} = useUpdateInvestigationCommentMutation(
    organization.slug,
    investigationId
  );

  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.focus();
      window.getSelection()?.selectAllChildren(input);
      window.getSelection()?.collapseToEnd();
    }
  }, []);

  const body = value.text.trim();
  const canSave = !!body && body !== comment.body.trim() && !isPending;

  const save = () => {
    if (!canSave) {
      return;
    }
    mutate(
      {commentId: comment.id, body},
      {
        onSuccess: () => {
          addSuccessMessage(t('Comment updated.'));
          onDone();
        },
        onError: () => addErrorMessage(t('Unable to save comment.')),
      }
    );
  };

  return (
    <Stack gap="sm" marginTop="xs">
      <Composer
        ref={inputRef}
        aria-label={t('Edit comment')}
        value={value}
        onChange={setValue}
        plugins={[]}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            if (!isPending) {
              onDone();
            }
          } else if (isSubmitKey(event)) {
            event.preventDefault();
            save();
          }
        }}
      />
      <Flex gap="sm" justify="end">
        <Button size="xs" disabled={isPending} onClick={onDone}>
          {t('Cancel')}
        </Button>
        <Button
          size="xs"
          variant="primary"
          busy={isPending}
          disabled={!canSave}
          onClick={save}
        >
          {t('Save')}
        </Button>
      </Flex>
    </Stack>
  );
}
