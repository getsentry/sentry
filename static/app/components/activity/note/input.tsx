import {useCallback, useId, useState} from 'react';
import {Mention, MentionsInput} from 'react-mentions';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {IconMarkdown} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {NoteType} from 'sentry/types/alerts';
import {useMemberMentionData} from 'sentry/utils/members/useMemberMentionData';
import {useTeams} from 'sentry/utils/useTeams';

import {mentionStyle} from './mentionStyle';
import type {CreateError, MentionChangeEvent, Mentioned} from './types';

type Props = {
  /**
   * Is the note saving?
   */
  busy?: boolean;
  errorJSON?: CreateError | null;
  /**
   * Minimum height for the editor textarea and preview, in pixels.
   *
   * Defaults to 140.
   */
  minHeight?: number;
  /**
   * This is the id of the server's note object and is meant to indicate that
   * you are editing an existing item
   */
  noteId?: string;
  onCancel?: () => void;
  onChange?: (e: MentionChangeEvent, extra: {updating?: boolean}) => void;
  onCreate?: (data: NoteType) => Promise<void>;
  onUpdate?: (data: NoteType) => Promise<void>;
  placeholder?: string;
  /**
   * The note text itself
   */
  text?: string;
};

type EditorMode = 'write' | 'preview';

const noteInputSchema = z.object({
  text: z.string(),
});

export function NoteInput({
  text,
  onCreate,
  onChange,
  onUpdate,
  onCancel,
  noteId,
  errorJSON,
  busy = false,
  placeholder = t('Add a comment.\nTag users with @, or teams with #'),
  minHeight = 140,
}: Props) {
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();

  const {getMemberSuggestions} = useMemberMentionData();
  const {teams} = useTeams();

  const suggestTeams = teams.map(team => ({
    id: `team:${team.id}`,
    display: `#${team.slug}`,
  }));

  const [memberMentions, setMemberMentions] = useState<Mentioned[]>([]);
  const [teamMentions, setTeamMentions] = useState<Mentioned[]>([]);
  const [editorMode, setEditorMode] = useState<EditorMode>('write');

  const existingItem = !!noteId;
  const [areControlsVisible, setAreControlsVisible] = useState(existingItem);

  const getCleanMarkdown = (comment: string) =>
    comment
      .replace(/\[sentry\.strip:member\]/g, '@')
      .replace(/\[sentry\.strip:team\]/g, '');

  const submitNote = useCallback(
    async (comment: string) => {
      const cleanMarkdown = getCleanMarkdown(comment);
      // each mention looks like [id, display]
      const finalizedMentions = [...memberMentions, ...teamMentions]
        .filter(mention => comment.includes(mention[1]))
        .map(mention => mention[0]);

      try {
        await (existingItem
          ? onUpdate?.({text: cleanMarkdown, mentions: finalizedMentions})
          : onCreate?.({text: cleanMarkdown, mentions: finalizedMentions}));
      } catch {
        // An error indicator is surfaced by the parent component. Keep this
        // open so the user can retry without losing their draft.
      }
    },
    [existingItem, memberMentions, onCreate, onUpdate, teamMentions]
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {text: text ?? ''},
    validators: {onDynamic: noteInputSchema},
    onSubmit: ({value}) => submitNote(value.text),
  });

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    onCancel?.();
  };

  const handleAddMember = useCallback(
    (id: string | number, display: string) =>
      setMemberMentions(existing => [...existing, [`${id}`, display]]),
    []
  );

  const handleAddTeam = useCallback(
    (id: string | number, display: string) =>
      setTeamMentions(existing => [...existing, [`${id}`, display]]),
    []
  );

  const errorId = useId();
  const errorMessage =
    (errorJSON &&
      (typeof errorJSON.detail === 'string'
        ? errorJSON.detail
        : errorJSON.detail?.message || t('Unable to post comment'))) ||
    null;
  const controlsAnimation = prefersReducedMotion
    ? {
        initial: false,
        animate: {opacity: 1, height: 'auto'},
        exit: {opacity: 0, height: 0},
        transition: {duration: 0},
      }
    : {
        initial: {opacity: 0, y: -4, height: 0},
        animate: {opacity: 1, y: 0, height: 'auto'},
        exit: {opacity: 0, y: -4, height: 0},
        transition: theme.motion.framer.enter.fast,
      };

  return (
    <form.AppForm form={form}>
      <EditorSurface>
        <form.AppField name="text">
          {field => (
            <div>
              {editorMode === 'write' ? (
                <field.Base<HTMLTextAreaElement>>
                  {({ref, ...fieldProps}) => (
                    <MentionsInput
                      {...fieldProps}
                      aria-label={existingItem ? t('Edit comment') : t('Add a comment')}
                      aria-errormessage={errorMessage ? errorId : undefined}
                      inputRef={ref}
                      style={mentionStyle({theme, minHeight})}
                      placeholder={placeholder}
                      onChange={(e: MentionChangeEvent) => {
                        setAreControlsVisible(true);
                        field.handleChange(e.target.value);
                        onChange?.(e, {updating: existingItem});
                      }}
                      onFocus={() => setAreControlsVisible(true)}
                      onKeyDown={e => {
                        if (
                          e.key === 'Enter' &&
                          (e.metaKey || e.ctrlKey) &&
                          field.state.value.trim() !== ''
                        ) {
                          e.preventDefault();
                          form.handleSubmit();
                        }
                      }}
                      value={field.state.value}
                      required
                      autoFocus={existingItem}
                    >
                      <Mention
                        trigger="@"
                        data={getMemberSuggestions}
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
                        displayTransform={(_id, display) => display}
                        appendSpaceOnAdd
                      />
                    </MentionsInput>
                  )}
                </field.Base>
              ) : (
                <NotePreview style={{minHeight}}>
                  <Markdown raw={getCleanMarkdown(field.state.value)} />
                </NotePreview>
              )}
            </div>
          )}
        </form.AppField>
      </EditorSurface>
      <AnimatePresence initial={false}>
        {areControlsVisible && (
          <MotionControls key="composer-controls" {...controlsAnimation}>
            <Flex align="center" justify="between" gap="md" paddingTop="sm">
              <Flex align="center" gap="md">
                <SegmentedControl<EditorMode>
                  aria-label={t('Comment editor mode')}
                  size="xs"
                  value={editorMode}
                  onChange={setEditorMode}
                >
                  <SegmentedControl.Item key="write">
                    {existingItem ? t('Edit') : t('Write')}
                  </SegmentedControl.Item>
                  <SegmentedControl.Item key="preview">
                    {t('Preview')}
                  </SegmentedControl.Item>
                </SegmentedControl>
                <Flex as="span" align="center" gap="xs">
                  <IconMarkdown size="sm" variant="muted" />
                  <Text as="span" size="sm" variant="muted">
                    {t('Markdown supported')}
                  </Text>
                </Flex>
              </Flex>
              <Flex align="center" gap="sm">
                {errorMessage && (
                  <Flex id={errorId} align="center" height="100%">
                    <Text as="span" variant="danger" size="sm">
                      {errorMessage}
                    </Text>
                  </Flex>
                )}
                <Flex gap="sm">
                  {existingItem && (
                    <form.Subscribe selector={state => state.isSubmitting}>
                      {isSubmitting => (
                        <Button size="xs" onClick={handleCancel} disabled={isSubmitting}>
                          {t('Cancel')}
                        </Button>
                      )}
                    </form.Subscribe>
                  )}
                  <form.Subscribe selector={state => state.values.text.trim() === ''}>
                    {isEmpty => (
                      <form.SubmitButton size="xs" disabled={busy || isEmpty}>
                        {existingItem ? t('Save') : t('Comment')}
                      </form.SubmitButton>
                    )}
                  </form.Subscribe>
                </Flex>
              </Flex>
            </Flex>
          </MotionControls>
        )}
      </AnimatePresence>
    </form.AppForm>
  );
}

const EditorSurface = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;

const MotionControls = styled(motion.div)`
  overflow: hidden;
  isolation: isolate;
`;

const NotePreview = styled('div')`
  max-height: 1000px;
  max-width: 100%;
  padding: ${p => p.theme.space.lg};
  overflow: auto;
`;
