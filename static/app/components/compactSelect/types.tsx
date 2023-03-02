import {SelectValue} from 'sentry/types';

export interface SelectOption<Value extends React.Key> extends SelectValue<Value> {}

export interface SelectSection<Value extends React.Key> {
  options: SelectOption<Value>[];
  /**
   * When true, all options inside this section will be disabled.
   */
  disabled?: boolean;
  /**
   * Optional key to identify this section. If not specified, the section's index will
   * be used.
   */
  key?: React.Key;
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

export type SelectOptionOrSection<Value extends React.Key> =
  | SelectOption<Value>
  | SelectSection<Value>;

/**
 * Select option/section type used for internal selection manager. DO NOT import in
 * other components. Import `SelectOptionOrSection` instead.
 */
export type SelectOptionOrSectionWithKey<Value extends React.Key> =
  SelectOptionOrSection<Value> & {key?: React.Key};
