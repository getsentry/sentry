import type {CSSObject} from '@emotion/react';
import styled from '@emotion/styled';

import {Select, type ControlProps, type SelectValue} from '@sentry/scraps/select';

export function AutomationBuilderSelect<
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
>(props: ControlProps<TValue, TOption>) {
  return <StyledSelect styles={automationBuilderSelectStyles} {...props} />;
}

const StyledSelect = styled(Select)`
  min-width: 180px;
  padding: 0;
  > div {
    padding-left: 0;
  }
  border: none;
` as typeof Select;

// react-select v4 positions the single value and placeholder absolutely, so they
// never contribute to the select's width and long labels get truncated at the
// min-width. Stacking them with the input in one grid cell lets the select grow
// to fit its value.
const inGridCell = (provided: CSSObject, state: unknown): CSSObject =>
  isMultiState(state)
    ? provided
    : {
        ...provided,
        gridArea: '1 / 1',
        position: 'static',
        transform: 'none',
        width: 'auto',
        maxWidth: '100%',
      };

// react-select passes isMulti to every style function, but the scraps
// StylesConfig state type does not include it.
function isMultiState(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'isMulti' in state &&
    state.isMulti === true
  );
}

export const selectControlStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: '32px',
    padding: 0,
  }),
};

// Kept separate from selectControlStyles because TeamSelector shallow-merges
// the styles it receives and would lose its own input and placeholder styles.
const automationBuilderSelectStyles = {
  ...selectControlStyles,
  valueContainer: (provided: CSSObject, state: unknown): CSSObject =>
    isMultiState(state) ? provided : {...provided, display: 'grid'},
  singleValue: inGridCell,
  placeholder: inGridCell,
  input: (provided: CSSObject, state: unknown): CSSObject =>
    isMultiState(state) ? provided : {...provided, gridArea: '1 / 1'},
};
