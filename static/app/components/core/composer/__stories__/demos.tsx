import {useState} from 'react';
import {IconGroup} from '@sentry/icons/group';
import {queryOptions} from '@tanstack/react-query';

import {UserAvatar} from '@sentry/scraps/avatar';
import {CodeBlock} from '@sentry/scraps/code';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {
  Composer,
  type ComposerActions,
  type ComposerMentionActions,
  type ComposerPlugin,
  type ComposerSource,
  type ComposerValue,
  type MentionData,
} from '@sentry/scraps/composer';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
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

function waitForDelay(delay: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, delay));
}

const MEMBER_SOURCE = {
  id: 'members',
  label: 'Members',
  trigger: '@',
  getSuggestions: query => filterSuggestions(PEOPLE, query),
  getId: suggestion => suggestion.id,
  getText: suggestion => `@${suggestion.label}`,
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

function MemberMention({id, text}: {id: string; text: string}) {
  const person = PEOPLE.find(candidate => candidate.id === id);
  return (
    <Flex as="span" display="inline-flex" align="center" gap="xs">
      <UserAvatar size={14} user={{id, name: person?.label ?? text, type: 'user'}} />
      {text}
    </Flex>
  );
}

function TeamMention({text}: {text: string}) {
  return (
    <Flex as="span" display="inline-flex" align="center" gap="xs">
      <IconGroup size="xs" />
      {text}
    </Flex>
  );
}

const INLINE_COMPONENT_PLUGIN: ComposerPlugin = {
  id: 'mentions-with-avatars',
  getSources: () => [
    {...MEMBER_SOURCE, renderMention: mention => <MemberMention {...mention} />},
    {...TEAM_SOURCE, renderMention: mention => <TeamMention {...mention} />},
  ],
};

function SwappableMemberMention({
  actions,
  mention,
}: {
  actions: ComposerMentionActions;
  mention: MentionData;
}) {
  // The select's wrapper is a block, so an inline-flex parent keeps it in the line.
  return (
    <Flex as="span" display="inline-flex">
      <CompactSelect
        clearable
        search
        size="xs"
        strategy="fixed"
        value={mention.id}
        options={PEOPLE.map(person => ({value: person.id, label: person.label}))}
        trigger={props => (
          <OverlayTrigger.Button
            {...props}
            size="zero"
            variant="transparent"
            aria-label={`Change mention: ${mention.text}`}
          >
            <MemberMention {...mention} />
          </OverlayTrigger.Button>
        )}
        onChange={option => {
          const person = PEOPLE.find(candidate => candidate.id === option?.value);
          if (person) {
            actions.replace({
              id: person.id,
              sourceId: 'members',
              text: `@${person.label}`,
            });
          } else {
            actions.remove();
          }
        }}
      />
    </Flex>
  );
}

const INTERACTIVE_MENTION_PLUGIN: ComposerPlugin = {
  id: 'swappable-mentions',
  getSources: () => [
    {
      ...MEMBER_SOURCE,
      renderMention: (mention, actions) => (
        <SwappableMemberMention actions={actions} mention={mention} />
      ),
    },
  ],
};

const SHARED_TRIGGER_PLUGIN: ComposerPlugin = {
  id: 'shared-trigger',
  getSources: () => [
    {...MEMBER_SOURCE, renderMention: mention => <MemberMention {...mention} />},
    {
      ...TEAM_SOURCE,
      trigger: '@',
      getText: suggestion => `@${suggestion.label.slice(1)}`,
      renderSuggestion: suggestion => (
        <Flex as="span" align="center" gap="xs">
          <IconGroup size="xs" />
          {suggestion.label}
        </Flex>
      ),
      renderMention: mention => <TeamMention {...mention} />,
    } satisfies ComposerSource<Suggestion>,
  ],
};

const RESTORED_TEXT =
  'Continue with @Alice Example on the checkout regression.\nLoop in #performance once the fix is ready.';
const RESTORED_MENTIONS = [
  {text: '@Alice Example', id: ALICE.id, sourceId: 'members'},
  {text: '#performance', id: 'team:3', sourceId: 'teams'},
].map(mention => {
  const start = RESTORED_TEXT.indexOf(mention.text);
  return {...mention, start, end: start + mention.text.length};
});

const REMOTE_PLUGIN: ComposerPlugin = {
  id: 'remote-members',
  getSources: () => [
    {
      id: 'remote-members',
      label: 'Remote members',
      trigger: '@',
      queryOptions: (query: string) =>
        queryOptions({
          queryKey: ['composer-story', 'remote-members', query],
          queryFn: async () => {
            await waitForDelay(800);
            if (query.toLocaleLowerCase().startsWith('err')) {
              throw new Error('Search failed');
            }
            return filterSuggestions(PEOPLE, query);
          },
          retry: false,
          staleTime: Infinity,
        }),
      getId: (suggestion: Suggestion) => suggestion.id,
      getText: (suggestion: Suggestion) => `@${suggestion.label}`,
      renderMention: mention => <MemberMention {...mention} />,
    } satisfies ComposerSource<Suggestion>,
  ],
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
        renderSuggestion: (suggestion: CommandSuggestion) => (
          <Stack as="span">
            <Text>/{suggestion.title}</Text>
            <Text size="sm" variant="muted">
              {suggestion.description}
            </Text>
          </Stack>
        ),
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

const LONG_TEXT = Array.from(
  {length: 12},
  (_, index) =>
    `Line ${index + 1}: the checkout regression reproduces on every retry after the cache warms.`
).join('\n');

function ValuePreview({value}: {value: ComposerValue}) {
  return (
    <CodeBlock language="json" hideCopyButton>
      {JSON.stringify(value, null, 2)}
    </CodeBlock>
  );
}

function useComposerValue(initialValue: ComposerValue = {text: '', mentions: []}) {
  return useState<ComposerValue>(initialValue);
}

export function ComposerDemo() {
  const [value, setValue] = useComposerValue({
    text: 'The regression is isolated to the checkout flow.\nAssign it to ',
    mentions: [],
  });

  return (
    <Stack width="100%" maxWidth="720px" gap="md">
      <Composer
        aria-label="Comment"
        minHeight={120}
        plugins={[MENTION_PLUGIN]}
        value={value}
        onChange={setValue}
      />
      <ValuePreview value={value} />
    </Stack>
  );
}

export function InlineComponentComposerDemo() {
  const [value, setValue] = useComposerValue({
    text: RESTORED_TEXT,
    mentions: RESTORED_MENTIONS,
  });

  return (
    <Stack width="100%" maxWidth="720px" gap="md">
      <Composer
        aria-label="Comment with avatars"
        minHeight={100}
        plugins={[INLINE_COMPONENT_PLUGIN]}
        value={value}
        onChange={setValue}
      />
      <ValuePreview value={value} />
    </Stack>
  );
}

export function InteractiveMentionComposerDemo() {
  const [value, setValue] = useComposerValue({
    text: 'Pairing with @Alice Example on the checkout regression.',
    mentions: [
      {id: ALICE.id, sourceId: 'members', text: '@Alice Example', start: 13, end: 27},
    ],
  });

  return (
    <Stack width="100%" maxWidth="720px" gap="md">
      <Composer
        aria-label="Comment with swappable mentions"
        minHeight={80}
        plugins={[INTERACTIVE_MENTION_PLUGIN]}
        value={value}
        onChange={setValue}
      />
      <ValuePreview value={value} />
    </Stack>
  );
}

export function SharedTriggerComposerDemo() {
  const [value, setValue] = useComposerValue({text: 'Ask ', mentions: []});

  return (
    <Stack width="100%" maxWidth="720px">
      <Composer
        aria-label="Members and teams"
        placeholder="Type @ to mention a member or team"
        plugins={[SHARED_TRIGGER_PLUGIN]}
        value={value}
        onChange={setValue}
      />
    </Stack>
  );
}

export function RestoredComposerDemo() {
  const [value, setValue] = useComposerValue({
    text: RESTORED_TEXT,
    mentions: RESTORED_MENTIONS,
  });

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
  const [value, setValue] = useComposerValue({
    text: 'Search remote members with ',
    mentions: [],
  });

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
  const [value, setValue] = useComposerValue();

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

export function SubmitComposerDemo() {
  const [value, setValue] = useComposerValue();
  const [sent, setSent] = useState<string[]>([]);

  return (
    <Stack width="100%" maxWidth="720px" gap="md">
      <Composer
        aria-label="Message"
        placeholder="Enter sends, Shift+Enter adds a line"
        plugins={[MENTION_PLUGIN, COMMAND_PLUGIN]}
        value={value}
        onChange={setValue}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && value.text.trim() !== '') {
            event.preventDefault();
            setSent(messages => [...messages, value.text]);
            setValue({text: '', mentions: []});
          }
        }}
      />
      {sent.length > 0 ? (
        <Stack gap="xs">
          {sent.map((message, index) => (
            <Text key={index} as="p" size="sm" variant="muted">
              Sent: {message}
            </Text>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

export function SizesComposerDemo() {
  const [small, setSmall] = useComposerValue();
  const [medium, setMedium] = useComposerValue();
  const [long, setLong] = useComposerValue({text: LONG_TEXT, mentions: []});

  return (
    <Stack width="100%" maxWidth="720px" gap="md">
      <Composer
        aria-label="Small composer"
        placeholder="Small"
        plugins={[MENTION_PLUGIN]}
        size="sm"
        value={small}
        onChange={setSmall}
      />
      <Composer
        aria-label="Medium composer"
        placeholder="Medium"
        plugins={[MENTION_PLUGIN]}
        size="md"
        value={medium}
        onChange={setMedium}
      />
      <Composer
        aria-label="Long composer"
        plugins={[MENTION_PLUGIN]}
        style={{maxHeight: 160}}
        value={long}
        onChange={setLong}
      />
    </Stack>
  );
}
