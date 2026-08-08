import {useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQueryClient} from '@tanstack/react-query';
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion';
import uniqBy from 'lodash/uniqBy';
import {z} from 'zod';

import {TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {
  type Mention,
  MentionInput,
  type MentionInputValue,
  type MentionSource,
} from 'sentry/components/mentionInput';
import {IconMarkdown} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {NoteType} from 'sentry/types/alerts';
import type {Member, Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {
  memberUsersQueryOptions,
  selectUsersFromMembers,
} from 'sentry/utils/members/shared';
import {useMembers} from 'sentry/utils/members/useMembers';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';

export interface MentionComposerProps<T = MentionEntity> {
  initialValue?: string;
  minHeight?: number;
  onSubmit?: (data: NoteType) => Promise<void>;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  /**
   * Overrides the organization member and team sources.
   */
  sources?: ReadonlyArray<MentionSource<T>>;
}

type EditorMode = 'write' | 'preview';

export type MentionEntity = {kind: 'member'; user: User} | {kind: 'team'; team: Team};

const mentionComposerSchema = z.object({
  text: z.string(),
});

/**
 * Composes MentionInput with the note editor controls. Passing `sources` makes
 * the component data-agnostic; omitting them connects organization data.
 */
export function MentionComposer<T = MentionEntity>({
  sources,
  ...props
}: MentionComposerProps<T>) {
  if (sources) {
    return <Composer {...props} sources={sources} />;
  }

  return <ConnectedMentionComposer {...props} />;
}

function ConnectedMentionComposer(props: Omit<MentionComposerProps, 'sources'>) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {data: members = []} = useMembers();
  const {teams} = useTeams();

  const memberSuggestions = useMemo<readonly MentionEntity[]>(
    () => members.map(user => ({kind: 'member', user})),
    [members]
  );
  const teamSuggestions = useMemo<readonly MentionEntity[]>(
    () => teams.map(team => ({kind: 'team', team})),
    [teams]
  );

  const sources = useMemo<ReadonlyArray<MentionSource<MentionEntity>>>(
    () => [
      {
        id: 'members',
        label: t('Members'),
        trigger: '@',
        getSuggestions: async (query, {signal}) => {
          const search = query.trim();
          if (!search) {
            return memberSuggestions;
          }

          signal.throwIfAborted();
          const response = await queryClient.fetchQuery(
            memberUsersQueryOptions({orgSlug: organization.slug, search})
          );
          signal.throwIfAborted();

          return uniqBy([...getMemberUsers(response), ...members], user => user.id).map(
            user => ({kind: 'member', user}) satisfies MentionEntity
          );
        },
        getId: getMentionId,
        getText: suggestion => `@${getMentionLabel(suggestion)}`,
        renderSuggestion: suggestion => <MentionIdentity suggestion={suggestion} />,
      },
      {
        id: 'teams',
        label: t('Teams'),
        trigger: '#',
        getSuggestions: query => {
          const normalizedQuery = query.trim().toLocaleLowerCase();
          return teamSuggestions.filter(suggestion =>
            getMentionLabel(suggestion).toLocaleLowerCase().includes(normalizedQuery)
          );
        },
        getId: getMentionId,
        getText: getMentionLabel,
        renderSuggestion: suggestion => <MentionIdentity suggestion={suggestion} />,
      },
    ],
    [memberSuggestions, members, organization.slug, queryClient, teamSuggestions]
  );

  return <Composer {...props} sources={sources} />;
}

function MentionIdentity({suggestion}: {suggestion: MentionEntity}) {
  return (
    <Flex as="span" align="center" gap="xs">
      {suggestion.kind === 'member' ? (
        <span aria-hidden="true">
          <UserAvatar user={suggestion.user} size={16} hasTooltip={false} />
        </span>
      ) : (
        <span aria-hidden="true">
          <TeamAvatar team={suggestion.team} size={16} hasTooltip={false} />
        </span>
      )}
      <Text as="span" size="sm">
        {getMentionLabel(suggestion)}
      </Text>
    </Flex>
  );
}

function getMentionLabel(suggestion: MentionEntity): string {
  return suggestion.kind === 'member'
    ? suggestion.user.name ||
        suggestion.user.email ||
        suggestion.user.username ||
        suggestion.user.id
    : `#${suggestion.team.slug}`;
}

function getMentionId(suggestion: MentionEntity): string {
  return suggestion.kind === 'member'
    ? `user:${suggestion.user.id}`
    : `team:${suggestion.team.id}`;
}

function getMemberUsers(response: ApiResponse<Member[]> | User[]): User[] {
  return Array.isArray(response) ? response : selectUsersFromMembers(response.json);
}

function serializeNoteMentions(value: MentionInputValue): string {
  let text = value.text;

  for (const mention of value.mentions.toSorted((a, b) => b.start - a.start)) {
    if (value.text.slice(mention.start, mention.end) !== mention.text) {
      continue;
    }

    text = text.slice(0, mention.start) + `**${mention.text}**` + text.slice(mention.end);
  }

  return text;
}

function Composer<T>({
  sources,
  initialValue = '',
  minHeight = 140,
  onValueChange,
  onSubmit,
  placeholder = t('Add a comment.\nTag users with @, or teams with #'),
}: Omit<MentionComposerProps<T>, 'sources'> & {
  sources: ReadonlyArray<MentionSource<T>>;
}) {
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const [mentions, setMentions] = useState<readonly Mention[]>([]);
  const [editorMode, setEditorMode] = useState<EditorMode>('write');

  const [areControlsVisible, setAreControlsVisible] = useState(false);

  const submitNote = useCallback(
    async (value: string) => {
      const validMentionIds = mentions.flatMap(mention =>
        value.slice(mention.start, mention.end) === mention.text ? mention.id : []
      );
      const mentionValue = {text: value, mentions};
      const uniqueMentionIds = [...new Set(validMentionIds)];
      const data = {
        text: serializeNoteMentions(mentionValue),
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
                  placeholder={placeholder}
                  onChange={nextValue => {
                    setAreControlsVisible(true);
                    setMentions(nextValue.mentions);
                    field.handleChange(nextValue.text);
                    onValueChange?.(nextValue.text);
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
                  value={{text: field.state.value, mentions}}
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
              <Markdown
                raw={serializeNoteMentions({text: field.state.value, mentions})}
              />
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
