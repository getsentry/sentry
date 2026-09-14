import type React from 'react';
import type {AnyUseQueryOptions} from '@tanstack/react-query';

import type {FormSize} from 'sentry/utils/theme';

import type {MentionInputValue} from './model';

interface MentionSourceBase<TSuggestion> {
  /** Returns a stable identity for a suggestion. */
  getId: (suggestion: TSuggestion) => string;
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

interface LocalMentionSource<TSuggestion> extends MentionSourceBase<TSuggestion> {
  /** Filters local suggestions for the text between the trigger and caret. */
  getSuggestions: (query: string) => readonly TSuggestion[];
}

interface AsyncMentionSource<TSuggestion> extends MentionSourceBase<TSuggestion> {
  /** Returns query options whose selected data is the suggestion list. */
  queryOptions: (query: string) => AnyUseQueryOptions;
}

export type MentionSource<TSuggestion> =
  | LocalMentionSource<TSuggestion>
  | AsyncMentionSource<TSuggestion>;

export interface MentionInputProps<TSuggestion> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children' | 'contentEditable' | 'defaultValue' | 'onBeforeInput' | 'onChange'
> {
  /** Called with plain text and structured mention ranges after an edit. */
  onChange: (value: MentionInputValue) => void;
  /** Local and queried suggestion sources. */
  sources: ReadonlyArray<MentionSource<TSuggestion>>;
  /** Controlled editor text and structured mention ranges. */
  value: MentionInputValue;
  minHeight?: number;
  placeholder?: string;
  ref?: React.Ref<HTMLDivElement>;
  size?: FormSize;
}
