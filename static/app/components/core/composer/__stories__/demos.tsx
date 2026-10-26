import {useState} from 'react';
import styled from '@emotion/styled';
import {queryOptions} from '@tanstack/react-query';

import {UserAvatar} from '@sentry/scraps/avatar';
import {
  Composer,
  type ComposerActions,
  type ComposerPlugin,
  type ComposerSource,
  type ComposerValue,
  type Mention,
} from '@sentry/scraps/composer';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

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

function filterSuggestions(suggestions: readonly Suggestion[], query: string) {
  const normalizedQuery = query.toLocaleLowerCase();
  return suggestions.filter(suggestion =>
    suggestion.label.toLocaleLowerCase().includes(normalizedQuery)
  );
}

function makeMention(text: string, mentionText: string, id: string, sourceId: string) {
  const start = text.indexOf(mentionText);
  return {id, sourceId, start, end: start + mentionText.length, text: mentionText};
}

/**
 * Keeps the `@` glyph so the avatar takes exactly its width, and the name
 * keeps exactly the width of the rest of the mention.
 */
const TriggerSlot = styled('span')`
  position: relative;
  color: transparent;

  & > * {
    position: absolute;
    inset: 0;
    margin: auto;
  }
`;

function MemberMention({mention}: {mention: Mention}) {
  const person = PEOPLE.find(item => item.id === mention.id);
  return (
    <span>
      <TriggerSlot>
        {mention.text.charAt(0)}
        <UserAvatar
          size={12}
          hasTooltip={false}
          user={{type: 'user', id: mention.id, name: person?.label ?? mention.text}}
        />
      </TriggerSlot>
      {mention.text.slice(1)}
    </span>
  );
}

const MEMBER_SOURCE = {
  id: 'members',
  label: 'Members',
  trigger: '@',
  getSuggestions: query => filterSuggestions(PEOPLE, query),
  getId: suggestion => suggestion.id,
  getText: suggestion => `@${suggestion.label}`,
  renderMention: mention => <MemberMention mention={mention} />,
} satisfies ComposerSource<Suggestion>;

const TEAM_SOURCE = {
  id: 'teams',
  label: 'Teams',
  trigger: '#',
  getSuggestions: query => filterSuggestions(TEAMS, query),
  getId: suggestion => suggestion.id,
  getText: suggestion => suggestion.label,
} satisfies ComposerSource<Suggestion>;

const MENTION_PLUGIN: ComposerPlugin = {
  id: 'mentions',
  getSources: () => [MEMBER_SOURCE, TEAM_SOURCE],
};

const SHARED_TRIGGER_PLUGIN: ComposerPlugin = {
  id: 'shared-trigger',
  getSources: () => [MEMBER_SOURCE, {...TEAM_SOURCE, trigger: '@'}],
};

const RESTORED_TEXT = 'Continue with @Alice Example on the checkout regression.';
const RESTORED_MENTIONS = [
  makeMention(RESTORED_TEXT, '@Alice Example', ALICE.id, 'members'),
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
          if (query.startsWith('fail')) {
            throw new Error('Unable to reach the member directory');
          }
          return filterSuggestions(PEOPLE, query);
        },
        retry: false,
        staleTime: Infinity,
      }),
    getId: (suggestion: Suggestion) => suggestion.id,
    getText: (suggestion: Suggestion) => `@${suggestion.label}`,
  },
];

const REMOTE_PLUGIN: ComposerPlugin = {
  id: 'remote-members',
  getSources: () => REMOTE_SOURCES,
};

interface CommandSuggestion {
  description: string;
  id: 'clear' | 'snippet';
  title: string;
}

const COMMANDS: readonly CommandSuggestion[] = [
  {id: 'clear', title: 'clear', description: 'Clear the composer'},
  {id: 'snippet', title: 'snippet', description: 'Insert a saved reply'},
];

const COMMAND_PLUGIN: ComposerPlugin = {
  id: 'commands',
  getSources: () =>
    [
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
    ] satisfies ReadonlyArray<ComposerSource<CommandSuggestion>>,
};

function waitForDelay(delay: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, delay));
}

/** Shows the controlled value so each demo's text and mention ranges are visible. */
function ValueInspector({value}: {value: ComposerValue}) {
  return (
    <Container background="secondary" border="primary" radius="md" padding="sm md">
      <Text as="div" monospace size="xs" variant="muted" wrap="pre-wrap">
        {JSON.stringify(value, null, 2)}
      </Text>
    </Container>
  );
}

function useComposerValue(text: string, mentions: readonly Mention[] = []) {
  return useState<ComposerValue>({text, mentions});
}

export function ComposerDemo() {
  const [value, setValue] = useComposerValue(
    'The regression is isolated to the checkout flow.\nAssign it to '
  );

  return (
    <Stack width="100%" maxWidth="720px" gap="md">
      <Composer
        aria-label="Comment"
        minHeight={120}
        placeholder="Type @ for people or # for teams"
        plugins={[MENTION_PLUGIN]}
        value={value}
        onChange={setValue}
      />
      <ValueInspector value={value} />
    </Stack>
  );
}

const INLINE_TEXT =
  'Ask @Alice Example and #design-systems to review, then loop in @Sam Designer.';

export function InlineMentionsDemo() {
  const [value, setValue] = useComposerValue(INLINE_TEXT, [
    makeMention(INLINE_TEXT, '@Alice Example', 'user:1', 'members'),
    makeMention(INLINE_TEXT, '#design-systems', 'team:2', 'teams'),
    makeMention(INLINE_TEXT, '@Sam Designer', 'user:3', 'members'),
  ]);

  return (
    <Flex gap="xl" wrap="wrap" width="100%">
      <Stack gap="sm" width="100%" maxWidth="480px">
        <Text size="sm" variant="muted">
          Wide
        </Text>
        <Composer
          aria-label="Inline mentions"
          plugins={[MENTION_PLUGIN]}
          value={value}
          onChange={setValue}
        />
      </Stack>
      <Stack gap="sm" width="220px">
        <Text size="sm" variant="muted">
          Narrow: wrapped mentions fall back to text
        </Text>
        <Composer
          aria-label="Inline mentions in a narrow editor"
          plugins={[MENTION_PLUGIN]}
          value={value}
          onChange={setValue}
        />
      </Stack>
    </Flex>
  );
}

const ATOMIC_TEXT = 'Pair @Alice Example with @Alex Engineer on #performance today.';

export function AtomicMentionsDemo() {
  const [value, setValue] = useComposerValue(ATOMIC_TEXT, [
    makeMention(ATOMIC_TEXT, '@Alice Example', 'user:1', 'members'),
    makeMention(ATOMIC_TEXT, '@Alex Engineer', 'user:2', 'members'),
    makeMention(ATOMIC_TEXT, '#performance', 'team:3', 'teams'),
  ]);

  return (
    <Stack width="100%" maxWidth="720px" gap="md">
      <Composer
        aria-label="Atomic mentions"
        plugins={[MENTION_PLUGIN]}
        value={value}
        onChange={setValue}
      />
      <ValueInspector value={value} />
    </Stack>
  );
}

export function SharedTriggerDemo() {
  const [value, setValue] = useComposerValue('Who owns this? ');

  return (
    <Stack width="100%" maxWidth="720px" gap="md">
      <Composer
        aria-label="Shared trigger"
        placeholder="Type @ for people and teams"
        plugins={[SHARED_TRIGGER_PLUGIN]}
        value={value}
        onChange={setValue}
      />
      <ValueInspector value={value} />
    </Stack>
  );
}

export function RestoredComposerDemo() {
  const [value, setValue] = useComposerValue(RESTORED_TEXT, RESTORED_MENTIONS);

  return (
    <Stack width="100%" maxWidth="720px">
      <Composer
        aria-label="Restored comment"
        minHeight={100}
        plugins={[MENTION_PLUGIN]}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}

export function AsyncComposerDemo() {
  const [value, setValue] = useComposerValue('Search remote members with ');

  return (
    <Stack width="100%" maxWidth="720px">
      <Composer
        aria-label="Remote member search"
        plugins={[REMOTE_PLUGIN]}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}

export function CommandComposerDemo() {
  const [value, setValue] = useComposerValue('');

  return (
    <Stack width="100%" maxWidth="720px">
      <Composer
        aria-label="Command input"
        placeholder="Type / for commands"
        plugins={[COMMAND_PLUGIN]}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}

const LONG_TEXT = Array.from(
  {length: 12},
  (_, index) => `Line ${index + 1}: checkout latency is above the threshold.`
).join('\n');

export function ScrollingComposerDemo() {
  const [value, setValue] = useComposerValue(`${LONG_TEXT}\nEscalate to `);

  return (
    <Stack width="100%" maxWidth="720px">
      <Composer
        aria-label="Scrolling comment"
        plugins={[MENTION_PLUGIN]}
        style={{maxHeight: 140}}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}

export function SizesComposerDemo() {
  const [value, setValue] = useComposerValue('Ping @Alice Example', [
    makeMention('Ping @Alice Example', '@Alice Example', 'user:1', 'members'),
  ]);

  return (
    <Stack width="100%" maxWidth="480px" gap="md">
      {(['xs', 'sm', 'md'] as const).map(size => (
        <Composer
          key={size}
          aria-label={`Size ${size}`}
          size={size}
          plugins={[MENTION_PLUGIN]}
          value={value}
          onChange={setValue}
        />
      ))}
      <Composer
        aria-label="Disabled"
        disabled
        plugins={[MENTION_PLUGIN]}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}

export function SubmitComposerDemo() {
  const [value, setValue] = useComposerValue('');
  const [sent, setSent] = useState<readonly ComposerValue[]>([]);

  return (
    <Stack width="100%" maxWidth="720px" gap="md">
      <Composer
        aria-label="Message"
        placeholder="Press Enter to send, Shift+Enter for a new line"
        plugins={[MENTION_PLUGIN]}
        value={value}
        onChange={setValue}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && value.text.trim() !== '') {
            event.preventDefault();
            setSent(previous => [...previous, value]);
            setValue({text: '', mentions: []});
          }
        }}
      />
      {sent.map((message, index) => (
        <ValueInspector key={index} value={message} />
      ))}
    </Stack>
  );
}
