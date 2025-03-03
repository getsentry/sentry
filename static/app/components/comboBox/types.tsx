import type {SelectValue} from 'sentry/types/core';

export type SelectKey = string | number;

export interface ComboBoxOption<Value extends SelectKey> extends SelectValue<Value> {
  label: string;
  /**
   * Whether to hide the checkbox/checkmark. Available for backward compatibility only.
   * If true, an alternative selection state indicator must be present.
   *
   * @deprecated
   */
  hideCheck?: boolean;
}

export interface ComboBoxSection<Value extends SelectKey> {
  options: Array<ComboBoxOption<Value>>;
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
  label?: string;
  /**
   * Whether to show a "Select All"/"Unselect All" button in the section header (only
   * applicable in multiple-selection mode).
   */
  showToggleAllButton?: boolean;
}

export type ComboBoxOptionOrSection<Value extends SelectKey> =
  | ComboBoxOption<Value>
  | ComboBoxSection<Value>;

export interface ComboBoxOptionWithKey<Value extends SelectKey>
  extends ComboBoxOption<Value> {
  /**
   * Key to identify this section. If not specified, the section's index will
   * be used.
   */
  key: SelectKey;
}

export interface ComboBoxSectionWithKey<Value extends SelectKey>
  extends ComboBoxSection<Value> {
  /**
   * Key to identify this section. If not specified, the section's index will
   * be used.
   */
  key: SelectKey;
  options: Array<ComboBoxOptionWithKey<Value>>;
}

/**
 * Select option/section type used for internal selection manager. DO NOT import in
 * other components. Import `SelectOptionOrSection` instead.
 */
export type ComboBoxOptionOrSectionWithKey<Value extends SelectKey> =
  | ComboBoxOptionWithKey<Value>
  | ComboBoxSectionWithKey<Value>;
