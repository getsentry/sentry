import type React from 'react';
import type {AnyUseQueryOptions} from '@tanstack/react-query';

import type {FormSize} from 'sentry/utils/theme';

import type {ComposerValue} from './model';

export interface ComposerActions {
  /** Clears the editor back to empty text with no mentions. */
  clear: () => void;
  /** Inserts text at the current cursor position, replacing the trigger and its query. */
  insertText: (text: string) => void;
}

interface ComposerSourceBase<TSuggestion> {
  /** Returns a stable identity for a suggestion. */
  getId: (suggestion: TSuggestion) => string;
  /** Stable identifier for this source, such as `members` or `teams`. */
  id: string;
  /** Accessible name for this group of suggestions. */
  label: string;
  /** The character that activates this source. */
  trigger: string;
  /** Renders an option. The source text is used when this is omitted. */
  renderSuggestion?: (suggestion: TSuggestion) => React.ReactNode;
  /**
   * Restricts this trigger to matching only at the very start of the
   * editor's text, like a slash command. Omit to match anywhere in the
   * text (mid-sentence), like an @ or # mention.
   */
  restrictToStart?: boolean;
}

interface InsertComposerSelection<TSuggestion> {
  /** Returns the exact text inserted at the trigger position. */
  getText: (suggestion: TSuggestion) => string;
}

interface RunComposerSelection<TSuggestion> {
  /**
   * Handles selection directly instead of automatically inserting text —
   * for sources whose suggestions clear the editor, insert a snippet, or
   * trigger some other side effect (e.g. slash commands).
   */
  onSelect: (suggestion: TSuggestion, actions: ComposerActions) => void;
}

type ComposerSourceSelection<TSuggestion> =
  | InsertComposerSelection<TSuggestion>
  | RunComposerSelection<TSuggestion>;

type LocalComposerSourceBase<TSuggestion> = ComposerSourceBase<TSuggestion> & {
  /** Filters local suggestions for the text between the trigger and caret. */
  getSuggestions: (query: string) => readonly TSuggestion[];
};

type AsyncComposerSourceBase<TSuggestion> = ComposerSourceBase<TSuggestion> & {
  /** Returns query options whose selected data is the suggestion list. */
  queryOptions: (query: string) => AnyUseQueryOptions;
};

type LocalComposerSource<TSuggestion> = LocalComposerSourceBase<TSuggestion> &
  ComposerSourceSelection<TSuggestion>;

type AsyncComposerSource<TSuggestion> = AsyncComposerSourceBase<TSuggestion> &
  ComposerSourceSelection<TSuggestion>;

export type ComposerSource<TSuggestion> =
  | LocalComposerSource<TSuggestion>
  | AsyncComposerSource<TSuggestion>;

export interface ComposerProps<TSuggestion> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children' | 'contentEditable' | 'defaultValue' | 'onBeforeInput' | 'onChange'
> {
  /** Called with plain text and structured mention ranges after an edit. */
  onChange: (value: ComposerValue) => void;
  /** Local and queried suggestion sources. */
  sources: ReadonlyArray<ComposerSource<TSuggestion>>;
  /** Controlled editor text and structured mention ranges. */
  value: ComposerValue;
  minHeight?: number;
  /**
   * Called when the suggestion list opens or closes. Useful for consumers
   * that bind Enter to something else (e.g. submitting a form) and need to
   * defer to suggestion selection while the list is open.
   */
  onOpenChange?: (isOpen: boolean) => void;
  placeholder?: string;
  ref?: React.Ref<HTMLDivElement>;
  size?: FormSize;
}
