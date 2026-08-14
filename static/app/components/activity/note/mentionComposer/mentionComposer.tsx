import {useCallback, useMemo, useState} from 'react';

import {TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {MentionInput} from 'sentry/components/mentionInput/mentionInput';
import type {MentionInputValue} from 'sentry/components/mentionInput/model';
import type {MentionSource} from 'sentry/components/mentionInput/types';
import {IconMarkdown} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {NoteType} from 'sentry/types/alerts';
import type {Member, Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {memberUsersQueryOptions} from 'sentry/utils/members/shared';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';

interface MentionComposerProps {
  initialValue?: string;
  minHeight?: number;
  onSubmit?: (data: NoteType) => Promise<void>;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  variant?: 'compact' | 'full';
}

type EditorMode = 'write' | 'preview';

type MentionEntity = {kind: 'member'; user: User} | {kind: 'team'; team: Team};

export function MentionComposer(props: MentionComposerProps) {
  const organization = useOrganization();
  const {teams} = useTeams();

  const teamSuggestions = useMemo(
    () => teams.map(team => ({kind: 'team', team}) as const satisfies MentionEntity),
    [teams]
  );

  const sources = useMemo(
    () =>
      [
        {
          id: 'members',
          label: t('Members'),
          trigger: '@',
          queryOptions: query => getMemberMentionQueryOptions(organization.slug, query),
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
      ] satisfies ReadonlyArray<MentionSource<MentionEntity>>,
    [organization.slug, teamSuggestions]
  );

  return <Composer {...props} sources={sources} />;
}

function getMemberMentionQueryOptions(orgSlug: string, query: string) {
  const options = memberUsersQueryOptions({orgSlug, search: query.trim()});

  return {
    ...options,
    select: (response: ApiResponse<Member[]>): readonly MentionEntity[] =>
      options
        .select(response)
        .map(user => ({kind: 'member', user}) as const satisfies MentionEntity),
  };
}

function MentionIdentity({suggestion}: {suggestion: MentionEntity}) {
  const label = getMentionLabel(suggestion);
  const email = suggestion.kind === 'member' ? suggestion.user.email : null;

  return (
    <Flex as="span" align="center" gap="xs">
      <Flex as="span" align="center" aria-hidden="true">
        {suggestion.kind === 'member' ? (
          <UserAvatar user={suggestion.user} size={16} hasTooltip={false} />
        ) : (
          <TeamAvatar team={suggestion.team} size={16} hasTooltip={false} />
        )}
      </Flex>
      <Stack as="span" minWidth="0">
        <Text as="span" size="sm" ellipsis>
          {label}
        </Text>
        {email && email !== label ? (
          <Text as="span" size="xs" variant="muted" ellipsis>
            {email}
          </Text>
        ) : null}
      </Stack>
    </Flex>
  );
}

function getMentionLabel(suggestion: MentionEntity): string {
  switch (suggestion.kind) {
    case 'member':
      return (
        suggestion.user.name ||
        suggestion.user.email ||
        suggestion.user.username ||
        suggestion.user.id
      );
    case 'team':
      return `#${suggestion.team.slug}`;
  }
}

function getMentionId(suggestion: MentionEntity): string {
  switch (suggestion.kind) {
    case 'member':
      return `user:${suggestion.user.id}`;
    case 'team':
      return `team:${suggestion.team.id}`;
  }
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

function Composer({
  sources,
  initialValue = '',
  minHeight = 140,
  onValueChange,
  onSubmit,
  placeholder = t('Add a comment.\nTag users with @, or teams with #'),
  variant = 'full',
}: MentionComposerProps & {
  sources: ReadonlyArray<MentionSource<MentionEntity>>;
}) {
  const [editorMode, setEditorMode] = useState<EditorMode>('write');
  const [hasFocusedEditor, setHasFocusedEditor] = useState(false);
  const initialEditorValue: MentionInputValue = {text: initialValue, mentions: []};
  const isCompact = variant === 'compact';

  const submitNote = useCallback(
    async (value: MentionInputValue) => {
      const validMentionIds = value.mentions.flatMap(mention =>
        value.text.slice(mention.start, mention.end) === mention.text ? mention.id : []
      );
      const uniqueMentionIds = [...new Set(validMentionIds)];
      const data = {
        text: serializeNoteMentions(value),
        mentions: uniqueMentionIds,
      };

      await onSubmit?.(data);
    },
    [onSubmit]
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      value: initialEditorValue,
    },
    onSubmit: ({value}) => submitNote(value.value),
  });

  return (
    <form.AppForm form={form}>
      <form.AppField name="value">
        {field =>
          editorMode === 'write' || isCompact ? (
            <field.Base<HTMLDivElement>>
              {({ref, ...fieldProps}) => (
                <MentionInput
                  {...fieldProps}
                  ref={ref}
                  aria-label={t('Add a comment')}
                  sources={sources}
                  placeholder={placeholder}
                  onChange={nextValue => {
                    field.handleChange(nextValue);
                    onValueChange?.(nextValue.text);
                  }}
                  onFocus={() => setHasFocusedEditor(true)}
                  onKeyDown={event => {
                    if (
                      event.key === 'Enter' &&
                      (event.metaKey || event.ctrlKey) &&
                      field.state.value.text.trim() !== ''
                    ) {
                      event.preventDefault();
                      form.handleSubmit();
                    }
                  }}
                  value={field.state.value}
                  minHeight={isCompact ? undefined : minHeight}
                  size={isCompact ? 'sm' : undefined}
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
              <Markdown raw={serializeNoteMentions(field.state.value)} />
            </Container>
          )
        }
      </form.AppField>
      {hasFocusedEditor && (
        <Flex
          align="center"
          justify={isCompact ? 'end' : 'between'}
          gap="md"
          paddingTop="sm"
        >
          {!isCompact && (
            <EditorControls mode={editorMode} onModeChange={setEditorMode} />
          )}
          <form.Subscribe selector={state => state.values.value.text.trim() === ''}>
            {isEmpty => (
              <form.SubmitButton
                size="xs"
                disabled={isEmpty}
                aria-label={isCompact ? t('Submit comment') : undefined}
              >
                {t('Comment')}
              </form.SubmitButton>
            )}
          </form.Subscribe>
        </Flex>
      )}
    </form.AppForm>
  );
}

function EditorControls({
  mode,
  onModeChange,
}: {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
}) {
  return (
    <Flex align="center" gap="md">
      <SegmentedControl<EditorMode>
        aria-label={t('Comment editor mode')}
        size="xs"
        value={mode}
        onChange={onModeChange}
      >
        <SegmentedControl.Item key="write">{t('Write')}</SegmentedControl.Item>
        <SegmentedControl.Item key="preview">{t('Preview')}</SegmentedControl.Item>
      </SegmentedControl>
      <Flex as="span" align="center" gap="xs" display={{zero: 'none', sm: 'inline-flex'}}>
        <IconMarkdown size="sm" variant="muted" />
        <Text as="span" size="sm" variant="muted">
          {t('Markdown supported')}
        </Text>
      </Flex>
    </Flex>
  );
}
