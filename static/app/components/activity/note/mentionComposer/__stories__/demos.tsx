import {Stack} from '@sentry/scraps/layout';

import {MentionComposer} from 'sentry/components/activity/note/mentionComposer/mentionComposer';
import type {MentionSource} from 'sentry/components/mentionInput/types';

interface Suggestion {
  id: string;
  label: string;
}

const SOURCES: ReadonlyArray<MentionSource<Suggestion>> = [
  {
    id: 'members',
    label: 'Members',
    trigger: '@',
    getSuggestions: query =>
      [
        {id: 'user:1', label: 'Alice Example'},
        {id: 'user:2', label: 'Alex Engineer'},
      ].filter(suggestion =>
        suggestion.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())
      ),
    getId: suggestion => suggestion.id,
    getText: suggestion => `@${suggestion.label}`,
    renderSuggestion: suggestion => suggestion.label,
  },
  {
    id: 'teams',
    label: 'Teams',
    trigger: '#',
    getSuggestions: query =>
      [
        {id: 'team:1', label: '#frontend'},
        {id: 'team:2', label: '#design-systems'},
      ].filter(suggestion =>
        suggestion.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())
      ),
    getId: suggestion => suggestion.id,
    getText: suggestion => suggestion.label,
    renderSuggestion: suggestion => suggestion.label,
  },
];

export function MentionComposerDemo() {
  return (
    <Stack width="100%" maxWidth="720px">
      <MentionComposer sources={SOURCES} onSubmit={() => Promise.resolve()} />
    </Stack>
  );
}
