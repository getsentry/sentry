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

export const selectControlStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: '32px',
    padding: 0,
  }),
};
