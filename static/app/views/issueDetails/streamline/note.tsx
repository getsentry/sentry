import {useCallback, useMemo, useState} from 'react';
import type {MentionsInputProps} from 'react-mentions';
import {Mention, MentionsInput} from 'react-mentions';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {mentionStyle} from 'sentry/components/activity/note/mentionStyle';
import type {
  CreateError,
  MentionChangeEvent,
  Mentioned,
} from 'sentry/components/activity/note/types';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {NoteType} from 'sentry/types/alerts';
import domId from 'sentry/utils/domId';
import {useMembers} from 'sentry/utils/useMembers';
import {useTeams} from 'sentry/utils/useTeams';

type Props = {
  errorJSON?: CreateError | null;
  /**
   * This is the id of the server's note object and is meant to indicate that
   * you are editing an existing item
   */
  noteId?: string;
  onChange?: (e: MentionChangeEvent, extra: {updating?: boolean}) => void;
  onCreate?: (data: NoteType) => void;
  onUpdate?: (data: NoteType) => void;
  placeholder?: string;
  /**
   * The note text itself
   */
  text?: string;
};

function StreamlinedNoteInput({
  text,
  onCreate,
  onChange,
  onUpdate,
  noteId,
  errorJSON,
  placeholder,
}: Props) {
  const theme = useTheme();

  const {members} = useMembers();
  const {teams} = useTeams();

  const suggestMembers = members.map(member => ({
    id: `user:${member.id}`,
    display: member.name,
  }));

  const suggestTeams = teams.map(team => ({
    id: `team:${team.id}`,
    display: `#${team.slug}`,
  }));

  const [value, setValue] = useState(text ?? '');

  const [memberMentions, setMemberMentions] = useState<Mentioned[]>([]);
  const [teamMentions, setTeamMentions] = useState<Mentioned[]>([]);
  const [isSubmitVisible, setIsSubmitVisible] = useState(false);

  const canSubmit = value.trim() !== '';

  const cleanMarkdown = value
    .replace(/\[sentry\.strip:member\]/g, '@')
    .replace(/\[sentry\.strip:team\]/g, '');

  const existingItem = !!noteId;

  // each mention looks like [id, display]
  const finalizedMentions = [...memberMentions, ...teamMentions]
    .filter(mention => value.includes(mention[1]))
    .map(mention => mention[0]);

  const submitForm = useCallback(
    () =>
      existingItem
        ? onUpdate?.({text: cleanMarkdown, mentions: finalizedMentions})
        : onCreate?.({text: cleanMarkdown, mentions: finalizedMentions}),
    [existingItem, onUpdate, cleanMarkdown, finalizedMentions, onCreate]
  );

  const displaySubmitButton = useCallback(() => {
    setIsSubmitVisible(true);
  }, []);

  const handleSubmit = useCallback(
    (
      e:
        | React.FormEvent<HTMLFormElement>
        | React.KeyboardEvent<HTMLTextAreaElement>
        | React.KeyboardEvent<HTMLInputElement>
    ) => {
      e.preventDefault();
      submitForm();
    },
    [submitForm]
  );

  const handleAddMember = useCallback(
    (id: React.ReactText, display: string) =>
      setMemberMentions(existing => [...existing, [`${id}`, display]]),
    []
  );

  const handleAddTeam = useCallback(
    (id: React.ReactText, display: string) =>
      setTeamMentions(existing => [...existing, [`${id}`, display]]),
    []
  );

  const handleChange = useCallback<NonNullable<MentionsInputProps['onChange']>>(
    e => {
      setValue(e.target.value);
      onChange?.(e, {updating: existingItem});
    },
    [existingItem, onChange]
  );

  const handleKeyDown = useCallback<NonNullable<MentionsInputProps['onKeyDown']>>(
    e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) {
        handleSubmit(e);
      }
    },
    [canSubmit, handleSubmit]
  );

  const errorId = useMemo(() => domId('note-error-'), []);
  const errorMessage =
    (errorJSON &&
      (typeof errorJSON.detail === 'string'
        ? errorJSON.detail
        : errorJSON.detail?.message || t('Unable to post comment'))) ||
    null;
  return (
    <NoteInputForm data-test-id="note-input-form" noValidate onSubmit={handleSubmit}>
      <MentionsInput
        aria-label={t('Add a comment')}
        aria-errormessage={errorMessage ? errorId : undefined}
        style={{
          ...mentionStyle({theme, minHeight: 14, streamlined: true}),
          width: '100%',
        }}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={displaySubmitButton}
        value={value}
        required
      >
        <Mention
          trigger="@"
          data={suggestMembers}
          onAdd={handleAddMember}
          displayTransform={(_id, display) => `@${display}`}
          markup="**[sentry.strip:member]__display__**"
          appendSpaceOnAdd
        />
        <Mention
          trigger="#"
          data={suggestTeams}
          onAdd={handleAddTeam}
          markup="**[sentry.strip:team]__display__**"
          appendSpaceOnAdd
        />
      </MentionsInput>
      {isSubmitVisible && (
        <Button
          priority="primary"
          size="xs"
          disabled={!canSubmit}
          aria-label={t('Submit comment')}
          type="submit"
        >
          {t('Comment')}
        </Button>
      )}
    </NoteInputForm>
  );
}

export {StreamlinedNoteInput};

const getNoteInputErrorStyles = (p: {theme: Theme; error?: string}) => {
  if (!p.error) {
    return '';
  }

  return `
  color: ${p.theme.error};
  margin: -1px;
  border: 1px solid ${p.theme.error};
  border-radius: ${p.theme.borderRadius};

    &:before {
      display: block;
      content: '';
      width: 0;
      height: 0;
      border-top: 7px solid transparent;
      border-bottom: 7px solid transparent;
      border-right: 7px solid ${p.theme.red300};
      position: absolute;
      left: -7px;
      top: 12px;
    }

    &:after {
      display: block;
      content: '';
      width: 0;
      height: 0;
      border-top: 6px solid transparent;
      border-bottom: 6px solid transparent;
      border-right: 6px solid #fff;
      position: absolute;
      left: -5px;
      top: 12px;
    }
  `;
};

const NoteInputForm = styled('form')<{error?: string}>`
  display: flex;
  flex-direction: column;
  gap: ${space(0.75)};
  align-items: flex-end;
  width: 100%;
  transition: padding 0.2s ease-in-out;

  ${p => getNoteInputErrorStyles(p)};
`;
