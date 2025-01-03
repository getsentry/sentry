import {useCallback, useMemo, useState} from 'react';
import type {MentionsInputProps} from 'react-mentions';
import {Mention, MentionsInput} from 'react-mentions';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {IconMarkdown} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import textStyles from 'sentry/styles/text';
import type {NoteType} from 'sentry/types/alerts';
import domId from 'sentry/utils/domId';
import marked from 'sentry/utils/marked';
import {useMembers} from 'sentry/utils/useMembers';
import {useTeams} from 'sentry/utils/useTeams';

import {mentionStyle} from './mentionStyle';
import type {CreateError, MentionChangeEvent, Mentioned} from './types';

type Props = {
  /**
   * Is the note saving?
   */
  busy?: boolean;
  /**
   * Display an error message
   */
  error?: boolean;
  errorJSON?: CreateError | null;
  /**
   * Minimum height of the edit area
   */
  minHeight?: number;
  /**
   * This is the id of the server's note object and is meant to indicate that
   * you are editing an existing item
   */
  noteId?: string;
  onChange?: (e: MentionChangeEvent, extra: {updating?: boolean}) => void;
  onCreate?: (data: NoteType) => void;
  onEditFinish?: () => void;
  onUpdate?: (data: NoteType) => void;
  placeholder?: string;
  /**
   * The note text itself
   */
  text?: string;
};

function NoteInput({
  text,
  onCreate,
  onChange,
  onUpdate,
  onEditFinish,
  noteId,
  errorJSON,
  busy = false,
  placeholder = t('Add a comment.\nTag users with @, or teams with #'),
  minHeight = 140,
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

  const handleCancel = useCallback(
    (e: React.MouseEvent<Element>) => {
      e.preventDefault();
      onEditFinish?.();
    },
    [onEditFinish]
  );

  const handleSubmit = useCallback(
    (e: React.MouseEvent<HTMLFormElement>) => {
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

  const handleChange: MentionsInputProps['onChange'] = useCallback(
    (e: MentionChangeEvent) => {
      setValue(e.target.value);
      onChange?.(e, {updating: existingItem});
    },
    [existingItem, onChange]
  );

  const handleKeyDown: MentionsInputProps['onKeyDown'] = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Auto submit the form on [meta,ctrl] + Enter
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) {
        submitForm();
      }
    },
    [canSubmit, submitForm]
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
      <Tabs>
        <StyledTabList>
          <TabList.Item key="edit">{existingItem ? t('Edit') : t('Write')}</TabList.Item>
          <TabList.Item key="preview">{t('Preview')}</TabList.Item>
        </StyledTabList>
        <NoteInputPanel>
          <TabPanels.Item key="edit">
            <MentionsInput
              aria-errormessage={errorMessage ? errorId : undefined}
              style={mentionStyle({theme, minHeight})}
              placeholder={placeholder}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              value={value}
              required
              autoFocus
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
          </TabPanels.Item>
          <TabPanels.Item key="preview">
            <NotePreview
              minHeight={minHeight}
              dangerouslySetInnerHTML={{__html: marked(cleanMarkdown)}}
            />
          </TabPanels.Item>
        </NoteInputPanel>
      </Tabs>
      <Footer>
        {errorMessage ? (
          <div id={errorId}>
            {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
          </div>
        ) : (
          <MarkdownIndicator>
            <IconMarkdown /> {t('Markdown supported')}
          </MarkdownIndicator>
        )}
        <div>
          {existingItem && (
            <FooterButton priority="danger" onClick={handleCancel}>
              {t('Cancel')}
            </FooterButton>
          )}
          <FooterButton
            error={!!errorMessage}
            type="submit"
            disabled={busy || !canSubmit}
          >
            {existingItem ? t('Save Comment') : t('Post Comment')}
          </FooterButton>
        </div>
      </Footer>
    </NoteInputForm>
  );
}

export {NoteInput};

type NotePreviewProps = {
  minHeight: Props['minHeight'];
  theme: Theme;
};

// This styles both the note preview and the note editor input
const getNotePreviewCss = (p: NotePreviewProps) => {
  const {minHeight, padding, overflow, border} = mentionStyle(p)['&multiLine'].input;

  return `
  max-height: 1000px;
  max-width: 100%;
  ${(minHeight && `min-height: ${minHeight}px`) || ''};
  padding: ${padding};
  overflow: ${overflow};
  border: ${border};
`;
};

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

const StyledTabList = styled(TabList)`
  padding: 0 ${space(2)};
  padding-top: ${space(0.5)};
`;

const NoteInputForm = styled('form')<{error?: string}>`
  transition: padding 0.2s ease-in-out;

  ${p => getNoteInputErrorStyles(p)};
`;

const NoteInputPanel = styled(TabPanels)`
  ${textStyles}
`;

const Footer = styled('div')`
  display: flex;
  border-top: 1px solid ${p => p.theme.border};
  justify-content: space-between;
  padding-left: ${space(1.5)};
`;

const FooterButton = styled(Button)<{error?: boolean}>`
  margin: -1px -1px -1px;
  border-radius: 0 0 ${p => p.theme.borderRadius};

  ${p =>
    p.error &&
    `
  &, &:active, &:focus, &:hover {
  border-bottom-color: ${p.theme.error};
  border-right-color: ${p.theme.error};
  }
  `}
`;

const ErrorMessage = styled('span')`
  display: flex;
  align-items: center;
  height: 100%;
  color: ${p => p.theme.error};
  font-size: 0.9em;
`;

const MarkdownIndicator = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  color: ${p => p.theme.subText};
`;

const NotePreview = styled('div')<{minHeight: Props['minHeight']}>`
  ${p => getNotePreviewCss(p)};
`;
