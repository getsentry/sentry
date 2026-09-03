import {useState} from 'react';
import {queryOptions} from '@tanstack/react-query';

import {
  Composer,
  type ComposerActions,
  type ComposerValue,
  type ComposerSource,
} from '@sentry/scraps/composer';
import {Stack} from '@sentry/scraps/layout';

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
] satisfies ReadonlyArray<ComposerSource<Suggestion>>;

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
        queryKey: ['composer-story', 'remote-members', query],
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

interface CommandSuggestion {
  description: string;
  id: 'clear' | 'snippet';
  title: string;
}

const COMMANDS: readonly CommandSuggestion[] = [
  {id: 'clear', title: 'clear', description: 'Clear the composer'},
  {id: 'snippet', title: 'snippet', description: 'Insert a saved reply'},
];

const COMMAND_SOURCES = [
  {
    id: 'commands',
    label: 'Commands',
    trigger: '/',
    restrictToStart: true,
    getSuggestions: (query: string) =>
      COMMANDS.filter(command => command.title.startsWith(query)),
    getId: (suggestion: CommandSuggestion) => suggestion.id,
    renderSuggestion: (suggestion: CommandSuggestion) => `/${suggestion.title}`,
    onSelect: (suggestion: CommandSuggestion, actions: ComposerActions) => {
      if (suggestion.id === 'clear') {
        actions.clear();
      } else {
        actions.insertText("Thanks for reaching out — I'll take a look shortly.");
      }
    },
  },
] satisfies ReadonlyArray<ComposerSource<CommandSuggestion>>;

function filterSuggestions(suggestions: readonly Suggestion[], query: string) {
  const normalizedQuery = query.toLocaleLowerCase();
  return suggestions.filter(suggestion =>
    suggestion.label.toLocaleLowerCase().includes(normalizedQuery)
  );
}

function waitForDelay(delay: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, delay));
}

export function ComposerDemo() {
  const [value, setValue] = useState<ComposerValue>({
    text: 'The regression is isolated to the checkout flow.\nAssign it to ',
    mentions: [],
  });

  return (
    <Stack width="100%" maxWidth="720px">
      <Composer
        aria-label="Comment"
        minHeight={120}
        sources={SOURCES}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}

export function RestoredComposerDemo() {
  const [value, setValue] = useState<ComposerValue>({
    text: RESTORED_TEXT,
    mentions: RESTORED_MENTIONS,
  });

  return (
    <Stack width="100%" maxWidth="720px">
      <Composer
        aria-label="Restored comment"
        minHeight={100}
        sources={SOURCES}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}

export function AsyncComposerDemo() {
  const [value, setValue] = useState<ComposerValue>({
    text: 'Search remote members with ',
    mentions: [],
  });

  return (
    <Stack width="100%" maxWidth="720px">
      <Composer
        aria-label="Remote member search"
        sources={REMOTE_SOURCES}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}

export function CommandComposerDemo() {
  const [value, setValue] = useState<ComposerValue>({text: '', mentions: []});

  return (
    <Stack width="100%" maxWidth="720px">
      <Composer
        aria-label="Command input"
        placeholder="Type / for commands"
        sources={COMMAND_SOURCES}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}
