import {useState} from 'react';
import {queryOptions} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';

import {MentionInput} from 'sentry/components/mentionInput/mentionInput';
import type {MentionInputValue} from 'sentry/components/mentionInput/model';
import type {MentionSource} from 'sentry/components/mentionInput/types';

interface Suggestion {
  id: string;
  label: string;
}

const ALICE = {id: 'user:1', label: 'Alice Example'};
const PEOPLE = [
  ALICE,
  {id: 'user:2', label: 'Alex Engineer'},
  {id: 'user:3', label: 'Sam Designer'},
];

const TEAMS = [
  {id: 'team:1', label: '#frontend'},
  {id: 'team:2', label: '#design-systems'},
  {id: 'team:3', label: '#performance'},
];

const SOURCES = [
  {
    id: 'members',
    label: 'Members',
    trigger: '@',
    getSuggestions: query => filterSuggestions(PEOPLE, query),
    getId: suggestion => suggestion.id,
    getText: suggestion => `@${suggestion.label}`,
  },
  {
    id: 'teams',
    label: 'Teams',
    trigger: '#',
    getSuggestions: query => filterSuggestions(TEAMS, query),
    getId: suggestion => suggestion.id,
    getText: suggestion => suggestion.label,
  },
] satisfies ReadonlyArray<MentionSource<Suggestion>>;

const RESTORED_TEXT = 'Continue with @Alice Example on the checkout regression.';
const RESTORED_MENTION_TEXT = '@Alice Example';
const RESTORED_MENTION_START = RESTORED_TEXT.indexOf(RESTORED_MENTION_TEXT);
const RESTORED_MENTIONS = [
  {
    id: ALICE.id,
    sourceId: 'members',
    start: RESTORED_MENTION_START,
    end: RESTORED_MENTION_START + RESTORED_MENTION_TEXT.length,
    text: RESTORED_MENTION_TEXT,
  },
];

const REMOTE_SOURCES = [
  {
    id: 'remote-members',
    label: 'Remote members',
    trigger: '@',
    queryOptions: (query: string) =>
      queryOptions({
        queryKey: ['mention-input-story', 'remote-members', query],
        queryFn: async () => {
          await waitForDelay(500);
          return filterSuggestions(PEOPLE, query);
        },
        staleTime: Infinity,
      }),
    getId: (suggestion: Suggestion) => suggestion.id,
    getText: (suggestion: Suggestion) => `@${suggestion.label}`,
  },
];

function filterSuggestions(suggestions: readonly Suggestion[], query: string) {
  const normalizedQuery = query.toLocaleLowerCase();
  return suggestions.filter(suggestion =>
    suggestion.label.toLocaleLowerCase().includes(normalizedQuery)
  );
}

function waitForDelay(delay: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, delay));
}

export function MentionInputDemo() {
  const [value, setValue] = useState<MentionInputValue>({
    text: 'The regression is isolated to the checkout flow.\nAssign it to ',
    mentions: [],
  });

  return (
    <Stack width="100%" maxWidth="720px">
      <MentionInput
        aria-label="Comment"
        minHeight={120}
        sources={SOURCES}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}

export function RestoredMentionInputDemo() {
  const [value, setValue] = useState<MentionInputValue>({
    text: RESTORED_TEXT,
    mentions: RESTORED_MENTIONS,
  });

  return (
    <Stack width="100%" maxWidth="720px">
      <MentionInput
        aria-label="Restored comment"
        minHeight={100}
        sources={SOURCES}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}

export function AsyncMentionInputDemo() {
  const [value, setValue] = useState<MentionInputValue>({
    text: 'Search remote members with ',
    mentions: [],
  });

  return (
    <Stack width="100%" maxWidth="720px">
      <MentionInput
        aria-label="Remote member search"
        sources={REMOTE_SOURCES}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}
