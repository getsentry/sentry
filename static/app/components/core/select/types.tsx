import type {CSSObject} from '@emotion/react';

import type {SelectValue} from '@sentry/scraps/menu';

export type {SelectValue} from '@sentry/scraps/menu';

/** Content components receive public option data, without implementation props. */
export interface SelectComponents<Option extends SelectValue<any> = SelectValue<any>> {
  Indicators?: React.ComponentType<{children: React.ReactNode}> | null;
  MultiValueLabel?: React.ComponentType<{children: React.ReactNode; option: Option}>;
  OptionLabel?: React.ComponentType<{option: Option}>;
  Value?: React.ComponentType<{option: Option}>;
}

type NonArray<T> = T extends readonly unknown[] ? never : T;

interface SingleUnclearableSelectProps<TValue, TSelection> {
  onChange: (value: NonArray<TSelection>) => void;
  value: NonArray<TValue> | null;
  clearable?: false;
  multiple?: false;
}

interface SingleClearableSelectProps<TValue, TSelection> {
  clearable: true;
  onChange: (value: NonArray<TSelection> | null) => void;
  value: NonArray<TValue> | null;
  multiple?: false;
}

interface MultipleSelectProps<TValue, TSelection> {
  multiple: true;
  onChange: (value: TSelection[]) => void;
  value: TValue[];
  clearable?: boolean;
}

/**
 * Shared selection rules for selects and form fields. Core Select returns option
 * objects; form fields return raw values, so the callback payload is configurable.
 */
export type SelectSelectionProps<TValue, TSelection = TValue> =
  | SingleUnclearableSelectProps<TValue, TSelection>
  | SingleClearableSelectProps<TValue, TSelection>
  | MultipleSelectProps<TValue, TSelection>;

/** The supported imperative operations on a select. */
export interface SelectHandle {
  blur: () => void;
  focus: () => void;
}

interface SelectStyleState {
  isDisabled?: boolean;
  isSelected?: boolean;
}

type SelectStyleSlot =
  | 'container'
  | 'control'
  | 'groupHeading'
  | 'input'
  | 'menu'
  | 'menuList'
  | 'menuPortal'
  | 'multiValue'
  | 'multiValueLabel'
  | 'multiValueRemove'
  | 'option'
  | 'placeholder'
  | 'singleValue';

/** Style overrides receive CSS and selection state, without implementation components. */
export type StylesConfig<Option extends SelectValue<any> = SelectValue<any>> = {
  [Slot in SelectStyleSlot]?: (
    base: CSSObject,
    state: Slot extends
      | 'option'
      | 'singleValue'
      | 'multiValue'
      | 'multiValueLabel'
      | 'multiValueRemove'
      ? SelectStyleState & {data: Option}
      : Slot extends 'control' | 'container'
        ? Pick<SelectStyleState, 'isDisabled'>
        : unknown
  ) => CSSObject;
};
