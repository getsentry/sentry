import {MenuListItemProps} from 'sentry/components/menuListItem';

export interface SelectOption<Value extends React.Key> extends MenuListItemProps {
  /**
   * The option's value, must be unique within the selector.
   */
  value: Value;
}

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
   * Title to display on top of section.
   */
  label?: React.ReactNode;
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
