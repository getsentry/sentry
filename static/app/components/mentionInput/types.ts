import type React from 'react';

import type {MentionInputValue} from './model';

export interface MentionSource<TSuggestion> {
  /** Returns a stable identity for a suggestion. */
  getId: (suggestion: TSuggestion) => string;
  /**
   * Returns suggestions for the text between the trigger and the caret. Async
   * sources should observe the abort signal when their data layer supports it.
   */
  getSuggestions: (
    query: string,
    context: {signal: AbortSignal}
  ) => readonly TSuggestion[] | Promise<readonly TSuggestion[]>;
  /** Returns the exact text inserted into the editor. */
  getText: (suggestion: TSuggestion) => string;
  /** Stable identifier for this source, such as `members` or `teams`. */
  id: string;
  /** Accessible name for this group of suggestions. */
  label: string;
  /** The character that activates this source. */
  trigger: string;
  /** Renders an option. The source text is used when this is omitted. */
  renderSuggestion?: (suggestion: TSuggestion) => React.ReactNode;
}

export interface MentionInputProps<TSuggestion> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children' | 'contentEditable' | 'defaultValue' | 'onBeforeInput' | 'onChange'
> {
  /** Called with plain text and structured mention ranges after an edit. */
  onChange: (value: MentionInputValue) => void;
  /** Suggestion sources. Sources may be synchronous or asynchronous. */
  sources: ReadonlyArray<MentionSource<TSuggestion>>;
  /** Controlled editor text and structured mention ranges. */
  value: MentionInputValue;
  minHeight?: number;
  placeholder?: string;
  ref?: React.Ref<HTMLDivElement>;
}
