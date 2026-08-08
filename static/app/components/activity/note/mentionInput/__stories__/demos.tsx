import {useMemo, useState} from 'react';

import {TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {CodeBlock} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  MentionComposer,
  MentionInput,
  type MentionSource,
  type MentionSuggestion,
  type MentionValue,
} from 'sentry/components/activity/note/mentionInput';
import type {NoteType} from 'sentry/types/alerts';
import type {Actor} from 'sentry/types/core';
import type {Team} from 'sentry/types/organization';

type DemoMentionEntity = {kind: 'member'; user: Actor} | {kind: 'team'; team: Team};

const PEOPLE = ['Alice Example', 'Alex Engineer', 'Sam Designer'].map((name, index) => ({
  id: `user:${index + 1}`,
  label: name,
  payload: {
    kind: 'member',
    user: {id: String(index + 1), name, type: 'user'},
  } satisfies DemoMentionEntity,
}));

const TEAMS = ['frontend', 'design-systems', 'performance'].map((slug, index) => {
  const team = {
    id: String(index + 1),
    slug,
    name: slug,
    avatar: {avatarType: 'letter_avatar', avatarUuid: null},
    access: [],
    externalTeams: [],
    flags: {'idp:provisioned': false},
    hasAccess: true,
    isMember: true,
    isPending: false,
    memberCount: 8,
    teamRole: null,
  } satisfies Team;

  return {
    id: `team:${team.id}`,
    label: `#${team.slug}`,
    payload: {kind: 'team', team} satisfies DemoMentionEntity,
  };
});

const STATIC_SOURCES: readonly MentionSource[] = [
  {
    id: 'members',
    label: 'Members',
    trigger: '@',
    getSuggestions: query =>
      PEOPLE.filter(suggestion =>
        suggestion.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())
      ),
    getReplacement: suggestion => `@${suggestion.label}`,
    getMarkup: (_suggestion, replacement) => `**${replacement}**`,
    renderMention: (suggestion, replacement) => (
      <DemoMentionIdentity suggestion={suggestion} text={replacement} />
    ),
    renderSuggestion: suggestion => (
      <DemoMentionIdentity suggestion={suggestion} description="Member" />
    ),
  },
  {
    id: 'teams',
    label: 'Teams',
    trigger: '#',
    getSuggestions: query =>
      TEAMS.filter(suggestion =>
        suggestion.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())
      ),
    getReplacement: suggestion => suggestion.label,
    getMarkup: (_suggestion, replacement) => `**${replacement}**`,
    renderMention: (suggestion, replacement) => (
      <DemoMentionIdentity suggestion={suggestion} text={replacement} />
    ),
    renderSuggestion: suggestion => (
      <DemoMentionIdentity suggestion={suggestion} description="Team" />
    ),
  },
];

const RESTORED_VALUE = 'Continue with @Alice Example on the checkout regression.';
const RESTORED_MENTION_TEXT = `@${PEOPLE[0]!.label}`;
const RESTORED_MENTION_START = RESTORED_VALUE.indexOf(RESTORED_MENTION_TEXT);
const RESTORED_MENTIONS = [
  {
    id: PEOPLE[0]!.id,
    sourceId: 'members',
    start: RESTORED_MENTION_START,
    end: RESTORED_MENTION_START + RESTORED_MENTION_TEXT.length,
    text: RESTORED_MENTION_TEXT,
    markup: `**${RESTORED_MENTION_TEXT}**`,
    suggestion: PEOPLE[0]!,
  },
] satisfies readonly MentionValue[];

function DemoMentionIdentity({
  suggestion,
  description,
  text = suggestion.label,
}: {
  suggestion: MentionSuggestion;
  description?: string;
  text?: string;
}) {
  const payload = suggestion.payload as DemoMentionEntity | undefined;

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
      <Stack as="span" gap="0">
        <Text as="span" size="sm">
          {text}
        </Text>
        {description ? (
          <Text as="span" size="xs" variant="muted">
            {description}
          </Text>
        ) : null}
      </Stack>
    </Flex>
  );
}

function waitForDelay(delay: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, delay);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException('Request aborted', 'AbortError'));
      },
      {once: true}
    );
  });
}

export function MentionInputDemo() {
  const [value, setValue] = useState(
    'The regression is isolated to the checkout flow.\nAssign it to '
  );
  const [mentions, setMentions] = useState<readonly MentionValue[]>([]);

  return (
    <Stack gap="md" width="100%" maxWidth="720px">
      <MentionInput
        aria-label="Comment"
        minHeight={120}
        sources={STATIC_SOURCES}
        value={value}
        mentions={mentions}
        onValueChange={(nextValue, nextMentions) => {
          setValue(nextValue);
          setMentions(nextMentions);
        }}
      />
    </Stack>
  );
}

export function RestoredMentionInputDemo() {
  const [value, setValue] = useState(RESTORED_VALUE);
  const [mentions, setMentions] = useState<readonly MentionValue[]>(RESTORED_MENTIONS);

  return (
    <Stack gap="md" width="100%" maxWidth="720px">
      <MentionInput
        aria-label="Restored comment"
        minHeight={100}
        sources={STATIC_SOURCES}
        value={value}
        mentions={mentions}
        onValueChange={(nextValue, nextMentions) => {
          setValue(nextValue);
          setMentions(nextMentions);
        }}
      />
    </Stack>
  );
}

export function AsyncMentionInputDemo() {
  const [value, setValue] = useState('Search remote members with ');
  const [mentions, setMentions] = useState<readonly MentionValue[]>([]);
  const sources = useMemo<readonly MentionSource[]>(
    () => [
      {
        id: 'remote-members',
        label: 'Remote members',
        trigger: '@',
        getSuggestions: async (query, {signal}) => {
          await waitForDelay(500, signal);
          if (query.toLocaleLowerCase() === 'error') {
            throw new Error('Simulated request failure');
          }
          return PEOPLE.filter(suggestion =>
            suggestion.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())
          );
        },
        getReplacement: suggestion => `@${suggestion.label}`,
        getMarkup: (_suggestion, replacement) => `**${replacement}**`,
        renderMention: (suggestion, replacement) => (
          <DemoMentionIdentity suggestion={suggestion} text={replacement} />
        ),
        renderSuggestion: suggestion => (
          <DemoMentionIdentity suggestion={suggestion} description="Remote member" />
        ),
      },
    ],
    []
  );

  return (
    <Stack gap="md" width="100%" maxWidth="720px">
      <MentionInput
        aria-label="Remote member search"
        sources={sources}
        value={value}
        mentions={mentions}
        onValueChange={(nextValue, nextMentions) => {
          setValue(nextValue);
          setMentions(nextMentions);
        }}
      />
    </Stack>
  );
}

export function MentionComposerDemo() {
  const [submission, setSubmission] = useState<NoteType | null>(null);

  return (
    <Stack gap="md" width="100%" maxWidth="720px">
      <MentionComposer
        sources={STATIC_SOURCES}
        onSubmit={data => {
          setSubmission(data);
          return Promise.resolve();
        }}
      />
      <CodeBlock language="json">
        {JSON.stringify(submission ?? {text: '', mentions: []}, null, 2)}
      </CodeBlock>
    </Stack>
  );
}
