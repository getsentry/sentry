import {useMemo, useState} from 'react';

import {TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  type Mention,
  MentionInput,
  type MentionInputValue,
  type MentionSource,
} from 'sentry/components/mentionInput';
import type {Actor} from 'sentry/types/core';
import type {Team} from 'sentry/types/organization';

type IdentitySuggestion =
  | {id: string; kind: 'member'; label: string; user: Actor}
  | {id: string; kind: 'team'; label: string; team: Team};

interface ServiceSuggestion {
  id: string;
  name: string;
}

const PEOPLE: readonly IdentitySuggestion[] = [
  'Alice Example',
  'Alex Engineer',
  'Sam Designer',
].map((name, index) => ({
  id: `user:${index + 1}`,
  kind: 'member',
  label: name,
  user: {id: String(index + 1), name, type: 'user'},
}));

const TEAMS: readonly IdentitySuggestion[] = [
  'frontend',
  'design-systems',
  'performance',
].map((slug, index) => {
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

  return {id: `team:${team.id}`, kind: 'team', label: `#${team.slug}`, team};
});

const IDENTITY_SOURCES: ReadonlyArray<MentionSource<IdentitySuggestion>> = [
  {
    id: 'members',
    label: 'Members',
    trigger: '@',
    getSuggestions: query =>
      PEOPLE.filter(suggestion =>
        suggestion.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())
      ),
    getId: suggestion => suggestion.id,
    getText: suggestion => `@${suggestion.label}`,
    renderSuggestion: suggestion => (
      <SuggestionIdentity suggestion={suggestion} description="Member" />
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
    getId: suggestion => suggestion.id,
    getText: suggestion => suggestion.label,
    renderSuggestion: suggestion => (
      <SuggestionIdentity suggestion={suggestion} description="Team" />
    ),
  },
];

const RESTORED_TEXT = 'Continue with @Alice Example on the checkout regression.';
const RESTORED_MENTION_TEXT = `@${PEOPLE[0]!.label}`;
const RESTORED_MENTION_START = RESTORED_TEXT.indexOf(RESTORED_MENTION_TEXT);
const RESTORED_MENTIONS = [
  {
    id: PEOPLE[0]!.id,
    sourceId: 'members',
    start: RESTORED_MENTION_START,
    end: RESTORED_MENTION_START + RESTORED_MENTION_TEXT.length,
    text: RESTORED_MENTION_TEXT,
    value: PEOPLE[0]!,
  },
] satisfies ReadonlyArray<Mention<IdentitySuggestion>>;

function SuggestionIdentity({
  suggestion,
  description,
}: {
  description: string;
  suggestion: IdentitySuggestion;
}) {
  return (
    <Flex as="span" align="center" gap="xs">
      <span aria-hidden="true">
        {suggestion.kind === 'member' ? (
          <UserAvatar user={suggestion.user} size={16} hasTooltip={false} />
        ) : (
          <TeamAvatar team={suggestion.team} size={16} hasTooltip={false} />
        )}
      </span>
      <Stack as="span" gap="0">
        <Text as="span" size="sm">
          {suggestion.label}
        </Text>
        <Text as="span" size="xs" variant="muted">
          {description}
        </Text>
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
  const [value, setValue] = useState<MentionInputValue<IdentitySuggestion>>({
    text: 'The regression is isolated to the checkout flow.\nAssign it to ',
    mentions: [],
  });

  return (
    <Stack gap="md" width="100%" maxWidth="720px">
      <MentionInput
        aria-label="Comment"
        minHeight={120}
        sources={IDENTITY_SOURCES}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}

export function RestoredMentionInputDemo() {
  const [value, setValue] = useState<MentionInputValue<IdentitySuggestion>>({
    text: RESTORED_TEXT,
    mentions: RESTORED_MENTIONS,
  });

  return (
    <Stack gap="md" width="100%" maxWidth="720px">
      <MentionInput
        aria-label="Restored comment"
        minHeight={100}
        sources={IDENTITY_SOURCES}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}

export function AsyncMentionInputDemo() {
  const [value, setValue] = useState<MentionInputValue<IdentitySuggestion>>({
    text: 'Search remote members with ',
    mentions: [],
  });
  const sources = useMemo<ReadonlyArray<MentionSource<IdentitySuggestion>>>(
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
        getId: suggestion => suggestion.id,
        getText: suggestion => `@${suggestion.label}`,
        renderSuggestion: suggestion => (
          <SuggestionIdentity suggestion={suggestion} description="Remote member" />
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
        onChange={setValue}
      />
    </Stack>
  );
}

export function CustomSourceDemo() {
  const [value, setValue] = useState<MentionInputValue<ServiceSuggestion>>({
    text: 'Route this trace to ',
    mentions: [],
  });
  const sources = useMemo<ReadonlyArray<MentionSource<ServiceSuggestion>>>(
    () => [
      {
        id: 'services',
        label: 'Services',
        trigger: '~',
        getSuggestions: query =>
          [
            {id: 'checkout', name: 'checkout'},
            {id: 'payments', name: 'payments'},
            {id: 'profiles', name: 'profiles'},
          ].filter(service => service.name.includes(query.toLocaleLowerCase())),
        getId: service => service.id,
        getText: service => `~${service.name}`,
        renderSuggestion: service => service.name,
      },
    ],
    []
  );

  return (
    <Stack gap="md" width="100%" maxWidth="720px">
      <MentionInput
        aria-label="Service routing"
        sources={sources}
        value={value}
        onChange={setValue}
        getMentionTextProps={() => ({bold: false, monospace: true, variant: 'accent'})}
      />
    </Stack>
  );
}
