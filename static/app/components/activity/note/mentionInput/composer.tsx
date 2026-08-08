import {useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion';
import {z} from 'zod';

import {TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {IconMarkdown} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {NoteType} from 'sentry/types/alerts';
import type {Team} from 'sentry/types/organization';
import type {AvatarUser} from 'sentry/types/user';
import {useOrganizationMemberSearch} from 'sentry/utils/members/useOrganizationMemberSearch';
import {useTeams} from 'sentry/utils/useTeams';

import {
  MentionInput,
  type MentionSource,
  type MentionSuggestion,
  type MentionValue,
  serializeMentions,
} from './mentionInput';

export interface MentionComposerProps {
  initialValue?: string;
  minHeight?: number;
  onSubmit?: (data: NoteType) => Promise<void>;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  /**
   * Overrides the organization member and team sources.
   */
  sources?: readonly MentionSource[];
}

type EditorMode = 'write' | 'preview';

type MentionEntity = {kind: 'member'; user: AvatarUser} | {kind: 'team'; team: Team};

const mentionComposerSchema = z.object({
  text: z.string(),
});

/**
 * Composes MentionInput with the note editor controls. Passing `sources` makes
 * the component data-agnostic; omitting them connects organization data.
 */
export function MentionComposer(props: MentionComposerProps) {
  if (props.sources) {
    return <Composer {...props} sources={props.sources} />;
  }

  return <ConnectedMentionComposer {...props} />;
}

function ConnectedMentionComposer(props: Omit<MentionComposerProps, 'sources'>) {
  const {members, onSearch: searchMembers} = useOrganizationMemberSearch();
  const {teams} = useTeams();

  const memberSuggestions = useMemo<readonly MentionSuggestion[]>(
    () =>
      members.map(user => ({
        id: `user:${user.id}`,
        label: user.name || user.email || user.username || user.id,
        payload: {kind: 'member', user} satisfies MentionEntity,
      })),
    [members]
  );
  const teamSuggestions = useMemo<readonly MentionSuggestion[]>(
    () =>
      teams.map(team => ({
        id: `team:${team.id}`,
        label: `#${team.slug}`,
        payload: {kind: 'team', team} satisfies MentionEntity,
      })),
    [teams]
  );

  const sources = useMemo<readonly MentionSource[]>(
    () => [
      {
        id: 'members',
        label: t('Members'),
        trigger: '@',
        getSuggestions: query => {
          void searchMembers(query.trim());
          const normalizedQuery = query.trim().toLocaleLowerCase();

          return memberSuggestions.filter(suggestion =>
            suggestion.label.toLocaleLowerCase().includes(normalizedQuery)
          );
        },
        getReplacement: suggestion => `@${suggestion.label}`,
        getMarkup: (_suggestion, replacement) => `**${replacement}**`,
        renderMention: (suggestion, replacement) => (
          <MentionIdentity suggestion={suggestion} text={replacement} />
        ),
        renderSuggestion: suggestion => <MentionIdentity suggestion={suggestion} />,
      },
      {
        id: 'teams',
        label: t('Teams'),
        trigger: '#',
        getSuggestions: query => {
          const normalizedQuery = query.trim().toLocaleLowerCase();
          return teamSuggestions.filter(suggestion =>
            suggestion.label.toLocaleLowerCase().includes(normalizedQuery)
          );
        },
        getReplacement: suggestion => suggestion.label,
        getMarkup: (_suggestion, replacement) => `**${replacement}**`,
        renderMention: (suggestion, replacement) => (
          <MentionIdentity suggestion={suggestion} text={replacement} />
        ),
        renderSuggestion: suggestion => <MentionIdentity suggestion={suggestion} />,
      },
    ],
    [memberSuggestions, searchMembers, teamSuggestions]
  );

  return <Composer {...props} sources={sources} />;
}

function MentionIdentity({
  suggestion,
  text = suggestion.label,
}: {
  suggestion: MentionSuggestion;
  text?: string;
}) {
  const payload = suggestion.payload as MentionEntity | undefined;

  return (
    <Flex as="span" align="center" gap="xs">
      {payload?.kind === 'member' ? (
        <span aria-hidden="true">
          <UserAvatar user={payload.user} size={16} hasTooltip={false} />
        </span>
      ) : payload?.kind === 'team' ? (
        <span aria-hidden="true">
          <TeamAvatar team={payload.team} size={16} hasTooltip={false} />
        </span>
      ) : null}
      <Text as="span" size="sm">
        {text}
      </Text>
    </Flex>
  );
}

function Composer({
  sources,
  initialValue = '',
  minHeight = 140,
  onValueChange,
  onSubmit,
  placeholder = t('Add a comment.\nTag users with @, or teams with #'),
}: MentionComposerProps & {sources: readonly MentionSource[]}) {
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const [mentions, setMentions] = useState<readonly MentionValue[]>([]);
  const [editorMode, setEditorMode] = useState<EditorMode>('write');

  const [areControlsVisible, setAreControlsVisible] = useState(false);

  const submitNote = useCallback(
    async (value: string) => {
      const validMentionIds = mentions.flatMap(mention =>
        value.slice(mention.start, mention.end) === mention.text ? mention.id : []
      );
      const uniqueMentionIds = [...new Set(validMentionIds)];
      const data = {
        text: serializeMentions(value, mentions),
        mentions: uniqueMentionIds,
      };

      await onSubmit?.(data);
    },
    [mentions, onSubmit]
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {text: initialValue},
    validators: {onDynamic: mentionComposerSchema},
    onSubmit: ({value}) => submitNote(value.text),
  });

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
      <form.AppField name="text">
        {field =>
          editorMode === 'write' ? (
            <field.Base<HTMLDivElement>>
              {({ref, ...fieldProps}) => (
                <MentionInput
                  {...fieldProps}
                  ref={ref}
                  aria-label={t('Add a comment')}
                  sources={sources}
                  mentions={mentions}
                  placeholder={placeholder}
                  onValueChange={(value, nextMentions) => {
                    setAreControlsVisible(true);
                    setMentions(nextMentions);
                    field.handleChange(value);
                    onValueChange?.(value);
                  }}
                  onFocus={() => setAreControlsVisible(true)}
                  onKeyDown={event => {
                    if (
                      event.key === 'Enter' &&
                      (event.metaKey || event.ctrlKey) &&
                      field.state.value.trim() !== ''
                    ) {
                      event.preventDefault();
                      form.handleSubmit();
                    }
                  }}
                  value={field.state.value}
                  minHeight={minHeight}
                />
              )}
            </field.Base>
          ) : (
            <Container
              background="primary"
              border="primary"
              radius="md"
              padding="lg"
              maxHeight="1000px"
              maxWidth="100%"
              minHeight={`${minHeight}px`}
              overflow="auto"
            >
              <Markdown raw={serializeMentions(field.state.value, mentions)} />
            </Container>
          )
        }
      </form.AppField>
      <AnimatePresence initial={false}>
        {areControlsVisible ? (
          <MotionControls key="composer-controls" {...controlsAnimation}>
            <Flex align="center" justify="between" gap="md" paddingTop="sm">
              <Flex align="center" gap="md">
                <SegmentedControl<EditorMode>
                  aria-label={t('Comment editor mode')}
                  size="xs"
                  value={editorMode}
                  onChange={setEditorMode}
                >
                  <SegmentedControl.Item key="write">{t('Write')}</SegmentedControl.Item>
                  <SegmentedControl.Item key="preview">
                    {t('Preview')}
                  </SegmentedControl.Item>
                </SegmentedControl>
                <Flex
                  as="span"
                  align="center"
                  gap="xs"
                  display={{zero: 'none', sm: 'inline-flex'}}
                >
                  <IconMarkdown size="sm" variant="muted" />
                  <Text as="span" size="sm" variant="muted">
                    {t('Markdown supported')}
                  </Text>
                </Flex>
              </Flex>
              <form.Subscribe selector={state => state.values.text.trim() === ''}>
                {isEmpty => (
                  <form.SubmitButton size="xs" disabled={isEmpty}>
                    {t('Comment')}
                  </form.SubmitButton>
                )}
              </form.Subscribe>
            </Flex>
          </MotionControls>
        ) : null}
      </AnimatePresence>
    </form.AppForm>
  );
}

const MotionControls = styled(motion.div)`
  overflow: hidden;
  isolation: isolate;
`;
