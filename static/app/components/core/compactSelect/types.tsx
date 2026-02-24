import type {SelectValue} from 'sentry/types/core';

export type SelectKey = string | number;

export interface SelectOption<Value extends SelectKey> extends SelectValue<Value> {
  /**
   * Whether to hide the checkbox/checkmark. Available for backward compatibility only.
   * If true, an alternative selection state indicator must be present.
   *
   * @deprecated
   */
  hideCheck?: boolean;
}

export interface SelectSection<Value extends SelectKey> {
  options: Array<SelectOption<Value>>;
  /**
   * When true, all options inside this section will be disabled.
   */
  disabled?: boolean;
  /**
   * Optional key to identify this section. If not specified, the section's index will
   * be used.
   */
  key?: SelectKey;
  /**
   * Title to display in the section header.
   */
  label?: React.ReactNode;
  /**
   * Whether to show a "Select All"/"Unselect All" button in the section header (only
   * applicable in multiple-selection mode).
   */
  showToggleAllButton?: boolean;
}

export type SelectOptionOrSection<Value extends SelectKey> =
  | SelectOption<Value>
  | SelectSection<Value>;

/**
 * The result of a custom `searchMatcher` function. Returning this (instead of a plain
 * boolean) allows callers to influence how matching options are sorted: options with a
 * higher `score` are shown first. To hide an option, return `{score: 0}.
 */
export interface SearchMatchResult {
  /**
   * Match quality score. Higher values cause the option to appear earlier in the list.
   * Options that match but return no score maintain their original order relative to
   * each other.
   */
  score: number;
}

/**
 * Configuration for CompactSelect's search/filter behavior. Providing this prop
 * implicitly enables the search input.
 */
export interface SearchConfig<Value extends SelectKey> {
  /**
   * Controls client-side option filtering:
   * - Omitted: default case-insensitive substring filter
   * - Function: custom matcher (receives option + search string, returns SearchMatchResult)
   * - `false`: disables client-side filtering entirely (use with `onChange` for server-side search)
   */
  filter?:
    | ((option: SelectOptionWithKey<Value>, search: string) => SearchMatchResult)
    | false;
  /**
   * Called when the search input value changes.
   */
  onChange?: (value: string) => void;
  /**
   * Placeholder text for the search input. Defaults to 'Search…'.
   */
  placeholder?: string;
}

export interface SelectOptionWithKey<
  Value extends SelectKey,
> extends SelectOption<Value> {
  /**
   * Key to identify this section. If not specified, the section's index will
   * be used.
   */
  key: SelectKey;
}

export interface SelectSectionWithKey<
  Value extends SelectKey,
> extends SelectSection<Value> {
  /**
   * Key to identify this section. If not specified, the section's index will
   * be used.
   */
  key: SelectKey;
  options: Array<SelectOptionWithKey<Value>>;
}

/**
 * Select option/section type used for internal selection manager. DO NOT import in
 * other components. Import `SelectOptionOrSection` instead.
 */
export type SelectOptionOrSectionWithKey<Value extends SelectKey> =
  | SelectOptionWithKey<Value>
  | SelectSectionWithKey<Value>;
