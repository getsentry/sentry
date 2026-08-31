import type React from 'react';
import type {AnyUseQueryOptions} from '@tanstack/react-query';

import type {FormSize} from 'sentry/utils/theme';

import type {ComposerValue} from './model';

interface ComposerSourceBase<TSuggestion> {
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

interface LocalComposerSource<TSuggestion> extends ComposerSourceBase<TSuggestion> {
  /** Filters local suggestions for the text between the trigger and caret. */
  getSuggestions: (query: string) => readonly TSuggestion[];
}

interface AsyncComposerSource<TSuggestion> extends ComposerSourceBase<TSuggestion> {
  /** Returns query options whose selected data is the suggestion list. */
  queryOptions: (query: string) => AnyUseQueryOptions;
}

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
