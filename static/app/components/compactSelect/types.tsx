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
  options: SelectOption<Value>[];
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

export interface SelectOptionWithKey<Value extends SelectKey>
  extends SelectOption<Value> {
  /**
   * Key to identify this section. If not specified, the section's index will
   * be used.
   */
  key: SelectKey;
}

export interface SelectSectionWithKey<Value extends SelectKey>
  extends SelectSection<Value> {
  /**
   * Key to identify this section. If not specified, the section's index will
   * be used.
   */
  key: SelectKey;
  options: SelectOptionWithKey<Value>[];
}

/**
 * Select option/section type used for internal selection manager. DO NOT import in
 * other components. Import `SelectOptionOrSection` instead.
 */
export type SelectOptionOrSectionWithKey<Value extends SelectKey> =
  | SelectOptionWithKey<Value>
  | SelectSectionWithKey<Value>;
