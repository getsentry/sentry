import type React from 'react';

import type {TextProps} from '@sentry/scraps/text';

import type {Mention, MentionInputValue} from './model';

export interface MentionMatch {
  /** End of the text replaced when a suggestion is selected. */
  end: number;
  /** Query passed to the source. */
  query: string;
  /** Start of the text replaced when a suggestion is selected. */
  start: number;
}

export interface MentionMatchContext {
  selectionEnd: number;
  selectionStart: number;
  text: string;
  trigger: string;
}

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
  /** Overrides the default start-or-whitespace trigger matching. */
  findMatch?: (context: MentionMatchContext) => MentionMatch | null;
  /** Returns text inserted after the mention. Defaults to one space when needed. */
  getTrailingText?: (
    suggestion: TSuggestion,
    context: {match: MentionMatch; text: string}
  ) => string;
  /** Renders an option. The source text is used when this is omitted. */
  renderSuggestion?: (suggestion: TSuggestion) => React.ReactNode;
}

type MentionTextProps = Pick<
  TextProps<'span'>,
  | 'aria-label'
  | 'bold'
  | 'className'
  | 'italic'
  | 'monospace'
  | 'strikethrough'
  | 'title'
  | 'underline'
  | 'variant'
>;

export type MentionSuggestionStatus = 'empty' | 'error' | 'loading';

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
  /** Customizes the editable inline wrapper while preserving its text. */
  getMentionTextProps?: (mention: Mention) => MentionTextProps;
  /** Maximum results displayed for the active source. */
  maxSuggestions?: number;
  minHeight?: number;
  placeholder?: string;
  ref?: React.Ref<HTMLDivElement>;
  /** Replaces the default loading, empty, and error messages. */
  renderSuggestionStatus?: (
    status: MentionSuggestionStatus,
    context: {query: string; source: MentionSource<TSuggestion>}
  ) => React.ReactNode;
}
