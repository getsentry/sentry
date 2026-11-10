import styled from '@emotion/styled';

import {Select, type ControlProps, type SelectValue} from '@sentry/scraps/select';

export function AutomationBuilderSelect<
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
>(props: ControlProps<TValue, TOption>) {
  return <StyledSelect styles={selectControlStyles} {...props} />;
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
const inGridCell = (provided: any, state: any) =>
  state.isMulti
    ? provided
    : {
        ...provided,
        gridArea: '1 / 1',
        position: 'static',
        transform: 'none',
        width: 'auto',
        maxWidth: '100%',
      };

export const selectControlStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: '32px',
    padding: 0,
  }),
  valueContainer: (provided: any, state: any) =>
    state.isMulti ? provided : {...provided, display: 'grid'},
  singleValue: inGridCell,
  placeholder: inGridCell,
  input: (provided: any, state: any) =>
    state.isMulti ? provided : {...provided, gridArea: '1 / 1'},
};
